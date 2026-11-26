import { GoTrueClient, Session } from "@supabase/auth-js";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL ?? "http://localhost:9999";
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const ANON_KEY = process.env.EXPO_PUBLIC_AUTH_ANON_KEY; // only the hosted provider needs it

// Web-only for now: auth-js keeps the session in localStorage and reads email-link tokens from the URL.
export const auth = new GoTrueClient({
  url: AUTH_URL,
  headers: ANON_KEY ? { apikey: ANON_KEY } : {},
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
});

/** Where email links and Google sign-in send the user back to. */
export const appOrigin = () => (Platform.OS === "web" ? window.location.origin : undefined);

export type Me = { id: string; email: string; display_name: string; deletion_scheduled_for: string | null; friend_code: string };

export function api(path: string, token: string, init: RequestInit = {}) {
  return fetch(API_URL + path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
}

type AuthState = {
  /** undefined while the stored session is still being read */
  session: Session | null | undefined;
  me: Me | null;
  meError: boolean;
  refreshMe: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState(false);

  useEffect(() => {
    auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const token = session?.access_token;
  const refreshMe = useCallback(async () => {
    if (!token) return setMe(null);
    try {
      const res = await api("/me", token);
      if (!res.ok) throw new Error(String(res.status));
      setMe(await res.json());
      setMeError(false);
    } catch {
      setMeError(true);
    }
  }, [token]);
  useEffect(() => void refreshMe(), [refreshMe]);

  return <Ctx.Provider value={{ session, me, meError, refreshMe }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
