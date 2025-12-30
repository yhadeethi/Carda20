/**
 * HubSpot Integration Service (multi-user OAuth)
 *
 * Each Carda user connects their own HubSpot account via OAuth.
 * Tokens are stored per-user in the database and refreshed as needed.
 */

import { Client } from "@hubspot/api-client";
import { storage } from "./storage";

const HUBSPOT_AUTHORIZE_URL = "https://app.hubspot.com/oauth/authorize";
const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set`);
  return v;
}

export function buildHubSpotAuthUrl(opts: {
  redirectUri: string;
  state: string;
}): string {
  const clientId = requireEnv("HUBSPOT_CLIENT_ID");
  const scopes = (process.env.HUBSPOT_SCOPES ||
    "oauth crm.objects.contacts.read crm.objects.contacts.write").trim();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: opts.redirectUri,
    scope: scopes,
    state: opts.state,
  });

  return `${HUBSPOT_AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(args: {
  code: string;
  redirectUri: string;
}): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  hub_domain?: string;
}> {
  const clientId = requireEnv("HUBSPOT_CLIENT_ID");
  const clientSecret = requireEnv("HUBSPOT_CLIENT_SECRET");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: args.redirectUri,
    code: args.code,
  });

  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot token exchange failed: ${text}`);
  }

  return (await res.json()) as any;
}

async function refreshAccessToken(args: {
  refreshToken: string;
}): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  hub_domain?: string;
}> {
  const clientId = requireEnv("HUBSPOT_CLIENT_ID");
  const clientSecret = requireEnv("HUBSPOT_CLIENT_SECRET");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: args.refreshToken,
  });

  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot token refresh failed: ${text}`);
  }

  return (await res.json()) as any;
}

export async function connectHubSpotForUser(args: {
  userId: number;
  code: string;
  redirectUri: string;
}): Promise<void> {
  const tokens = await exchangeCodeForTokens({
    code: args.code,
    redirectUri: args.redirectUri,
  });

  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 1800) * 1000);

  await storage.upsertHubspotTokens({
    userId: args.userId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
    hubDomain: tokens.hub_domain ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
}

export async function disconnectHubSpotForUser(userId: number): Promise<void> {
  await storage.deleteHubspotTokens(userId);
}

export async function isHubSpotConnected(userId: number): Promise<boolean> {
  const tokens = await storage.getHubspotTokens(userId);
  return !!tokens;
}

async function getValidAccessToken(userId: number): Promise<string> {
  const tokens = await storage.getHubspotTokens(userId);
  if (!tokens) throw new Error("HubSpot not connected");

  // Refresh ~2 minutes before expiry
  const refreshWindowMs = 2 * 60 * 1000;
  if (tokens.expiresAt && tokens.expiresAt.getTime() - Date.now() > refreshWindowMs) {
    return tokens.accessToken;
  }

  const refreshed = await refreshAccessToken({ refreshToken: tokens.refreshToken });
  const expiresAt = new Date(Date.now() + (refreshed.expires_in ?? 1800) * 1000);

  await storage.upsertHubspotTokens({
    userId,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token || tokens.refreshToken,
    expiresAt,
    hubDomain: refreshed.hub_domain ?? tokens.hubDomain ?? null,
    createdAt: tokens.createdAt,
    updatedAt: new Date(),
  } as any);

  return refreshed.access_token;
}

function splitName(fullName: string | null | undefined): { firstname: string | null; lastname: string | null } {
  if (!fullName) return { firstname: null, lastname: null };
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstname: null, lastname: null };
  if (parts.length === 1) return { firstname: parts[0], lastname: null };
  return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

export async function syncContactToHubSpot(userId: number, contact: {
  email?: string | null;
  name?: string | null;
  company?: string | null;
  title?: string | null;
  phone?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
}): Promise<{ success: boolean; message: string; hubspotId?: string }> {
  if (!contact.email) {
    return { success: false, message: "Contact must have an email to sync to HubSpot" };
  }

  const accessToken = await getValidAccessToken(userId);
  const hs = new Client({ accessToken });

  const { firstname, lastname } = splitName(contact.name);

  // Find existing contact by email
  let existingId: string | null = null;
  try {
    const searchRes = await hs.crm.contacts.searchApi.doSearch({
      filterGroups: [
        {
          filters: [
            {
              propertyName: "email",
              operator: "EQ",
              value: contact.email,
            },
          ],
        },
      ],
      properties: ["email"],
      limit: 1,
    } as any);
    existingId = searchRes?.results?.[0]?.id ?? null;
  } catch {
    existingId = null;
  }

  const properties: Record<string, any> = {
    email: contact.email,
    firstname: firstname ?? undefined,
    lastname: lastname ?? undefined,
    jobtitle: contact.title ?? undefined,
    company: contact.company ?? undefined,
    phone: contact.phone ?? undefined,
    website: contact.website ?? undefined,
    hs_linkedin_url: contact.linkedinUrl ?? undefined,
  };

  // Remove undefined (HubSpot can reject some)
  Object.keys(properties).forEach((k) => properties[k] === undefined && delete properties[k]);

  try {
    if (existingId) {
      const updated = await hs.crm.contacts.basicApi.update(existingId, { properties } as any);
      return { success: true, message: "Updated in HubSpot", hubspotId: updated.id };
    } else {
      const created = await hs.crm.contacts.basicApi.create({ properties } as any);
      return { success: true, message: "Created in HubSpot", hubspotId: created.id };
    }
  } catch (e: any) {
    return { success: false, message: e?.message || "HubSpot sync failed" };
  }
}

