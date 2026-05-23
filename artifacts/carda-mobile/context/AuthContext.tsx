import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

export interface AuthUser {
  id: number;
  authId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/user`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        checkAuth();
      }
    };
    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, [checkAuth]);

  const login = async () => {
    const loginUrl = `${BASE_URL}/api/login`;

    if (Platform.OS === "web") {
      Linking.openURL(loginUrl);
      return;
    }

    const redirectUrl = Linking.createURL("/");

    const result = await WebBrowser.openAuthSessionAsync(
      loginUrl,
      redirectUrl,
      {
        showInRecents: true,
        createTask: false,
      }
    );

    if (
      result.type === "success" ||
      result.type === "dismiss"
    ) {
      await checkAuth();
    }
  };

  const logout = async () => {
    try {
      await fetch(`${BASE_URL}/api/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
