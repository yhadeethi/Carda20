import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

interface ReplitAuthUser {
  claims?: {
    sub: string;
    exp?: number;
    email?: string;
    first_name?: string;
    last_name?: string;
  };
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const sessionSecret = process.env.SESSION_SECRET;

  if (!sessionSecret) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await storage.upsertUser({
    authId: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req: any, res, next) => {
    const returnTo = req.query.returnTo as string | undefined;
    if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      req.session.returnTo = returnTo;
    }
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "select_account consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req: any, res, next) => {
    ensureStrategy(req.hostname);
    const returnTo = req.session?.returnTo || "/";
    passport.authenticate(`replitauth:${req.hostname}`, {
      failureRedirect: "/api/login",
    })(req, res, (err: any) => {
      if (err) return next(err);
      delete req.session.returnTo;
      res.redirect(returnTo);
    });
  });

  app.get("/api/auth/switch", (req: any, res) => {
    const returnTo = req.query.returnTo as string || "/profile";
    const safeReturnTo = (returnTo.startsWith("/") && !returnTo.startsWith("//")) ? returnTo : "/profile";
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.redirect(`/api/login?returnTo=${encodeURIComponent(safeReturnTo)}`);
      });
    });
  });

  app.get("/api/logout", (req: any, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
          }).href
        );
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as ReplitAuthUser | undefined;

  if (!req.isAuthenticated() || !user?.claims?.sub) {
    console.warn("[Auth] Unauthorized:", req.path, "| isAuthenticated:", req.isAuthenticated?.(), "| hasUser:", !!user, "| hasClaims:", !!user?.claims?.sub, "| sessionID:", req.sessionID?.slice(0, 8));
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (user.expires_at && now > user.expires_at && user.refresh_token) {
    try {
      const config = await getOidcConfig();
      const tokenResponse = await client.refreshTokenGrant(config, user.refresh_token);
      updateUserSession(user, tokenResponse);
    } catch (error) {
      console.warn("[Auth] Token refresh failed (non-blocking):", req.path, error);
    }
  }

  return next();
};
