import { setAuthTokenGetter } from "@workspace/api-client-react";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

export interface UpdateProfileData {
  name: string;
  phone: string;
  city?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountTitle?: string | null;
  inverterBrand?: string | null;
}

const TOKEN_KEY = "ks_solar_token";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  isAdmin: boolean;
  isMaster: boolean;
  inverterBrand: string | null;
  city: string | null;
  status: string;
  role: string;
  specialty: string | null;
  createdAt: string;
  referralCode?: string | null;
  referralPoints?: number;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountTitle?: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithToken: (token: string, user: UserProfile) => Promise<void>;
  register: (
    name: string,
    email: string,
    phone: string,
    password: string,
    isMaster: boolean,
    inverterBrand: string | null,
    referralCode?: string | null
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function storeToken(token: string | null) {
  if (Platform.OS === "web") {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function loadToken(): Promise<string | null> {
  if (Platform.OS === "web") return localStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

const BASE =
  Platform.OS === "web" && typeof window !== "undefined"
    ? `${window.location.origin}/api`
    : `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

// Safely parse a response body as JSON. Returns null for empty / non-JSON
// bodies instead of throwing the cryptic
// "Failed to execute 'json' on 'Response': Unexpected end of JSON input"
// error that occurs when the API server is down or a proxy returns an
// empty / HTML error page.
async function parseJsonSafe(res: Response): Promise<any> {
  const text = await res.text();
  if (!text || text.trim() === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function apiPost<T>(path: string, body: unknown, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach the server. Please check your internet connection and try again.");
  }
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    const err: any = new Error(
      data?.message ??
        data?.error ??
        (res.status >= 500
          ? "Server error. Please try again in a moment."
          : "Request failed")
    );
    err.code = data?.error;
    throw err;
  }
  if (data == null) {
    throw new Error("The server returned an unexpected response. Please try again.");
  }
  return data as T;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadToken().then((t) => {
      setToken(t);
      if (t) {
        setAuthTokenGetter(() => t);
        fetch(`${BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${t}` },
        })
          .then((r) => (r.ok ? parseJsonSafe(r) : null))
          .then((u) => {
            if (u) setUser(u as UserProfile);
            else {
              setToken(null);
              setAuthTokenGetter(null);
              storeToken(null);
            }
          })
          .catch(() => {
            setToken(null);
            setAuthTokenGetter(null);
            storeToken(null);
          })
          .finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token: t, user: u } = await apiPost<{ token: string; user: UserProfile }>(
      "/auth/login",
      { email, password }
    );
    await storeToken(t);
    setToken(t);
    setUser(u);
    setAuthTokenGetter(() => t);
  }, []);

  const loginWithToken = useCallback(async (t: string, u: UserProfile) => {
    await storeToken(t);
    setToken(t);
    setUser(u);
    setAuthTokenGetter(() => t);
  }, []);

  // Returns true if account is pending approval (don't log in)
  const register = useCallback(async (
    name: string,
    email: string,
    phone: string,
    password: string,
    isMaster: boolean,
    inverterBrand: string | null,
    referralCode?: string | null
  ): Promise<boolean> => {
    const result = await apiPost<{ pending?: boolean; message?: string; token?: string; user?: UserProfile }>(
      "/auth/register",
      { name, email, phone, password, isMaster, inverterBrand, ...(referralCode ? { referralCode } : {}) }
    );
    if (result.pending) {
      return true;
    }
    if (result.token && result.user) {
      await storeToken(result.token);
      setToken(result.token);
      setUser(result.user);
      setAuthTokenGetter(() => result.token!);
    }
    return false;
  }, []);

  const logout = useCallback(async () => {
    if (Platform.OS !== "web") {
      // Stop 24/7 background location tracking when the technician logs out.
      import("@/backgroundLocationTask")
        .then((m) => m.stopBackgroundLocation())
        .catch(() => {});
    }
    await storeToken(null);
    setToken(null);
    setUser(null);
    setAuthTokenGetter(null);
  }, []);

  const updateProfile = useCallback(async (data: UpdateProfileData) => {
    const currentToken = token;
    if (!currentToken) throw new Error("Not authenticated");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${currentToken}`,
    };
    let res: Response;
    try {
      res = await fetch(`${BASE}/auth/me`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      });
    } catch {
      throw new Error("Cannot reach the server. Please check your internet connection and try again.");
    }
    const json = await parseJsonSafe(res);
    if (!res.ok) throw new Error(json?.error ?? "Update failed");
    if (json == null) throw new Error("The server returned an unexpected response. Please try again.");
    setUser(json as UserProfile);
  }, [token]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const currentToken = token;
    if (!currentToken) throw new Error("Not authenticated");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${currentToken}`,
    };
    let res: Response;
    try {
      res = await fetch(`${BASE}/auth/me/password`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    } catch {
      throw new Error("Cannot reach the server. Please check your internet connection and try again.");
    }
    const json = await parseJsonSafe(res);
    if (!res.ok) throw new Error(json?.error ?? "Password change failed");
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, loginWithToken, register, logout, updateProfile, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
