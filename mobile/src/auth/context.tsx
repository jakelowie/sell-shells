import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { authClient } from "./client";
import { API_URL } from "../config";

type AuthValue = {
  loading: boolean;
  role: string | null;
  email: string | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const Context = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function validate(session: Session | null): Promise<string | null> {
    if (!session) {
      setRole(null);
      setEmail(null);
      setLoading(false);
      setError(null);
      return null;
    }
    setEmail(session.user.email ?? null);
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not verify administrator access.");
      if (!(["admin", "superadmin"] as string[]).includes(body.data?.role))
        throw new Error("This account does not have administrator access.");
      setRole(body.data.role);
      setError(null);
      return body.data.role as string;
    } catch (e) {
      setRole(null);
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void authClient.auth.getSession().then(({ data }) => validate(data.session));
    const {
      data: { subscription },
    } = authClient.auth.onAuthStateChange((_event, session) => {
      void validate(session);
    });
    return () => subscription.unsubscribe();
  }, []);
  const value = useMemo<AuthValue>(
    () => ({
      loading,
      role,
      email,
      error,
      signIn: async (mail, password) => {
        setLoading(true);
        const { error: authError } = await authClient.auth.signInWithPassword({
          email: mail,
          password,
        });
        if (authError) {
          setLoading(false);
          throw authError;
        }
        const { data } = await authClient.auth.getSession();
        const verifiedRole = await validate(data.session);
        if (!(verifiedRole === "admin" || verifiedRole === "superadmin")) {
          await authClient.auth.signOut();
          setLoading(false);
          throw new Error("This account does not have administrator access.");
        }
      },
      signOut: async () => {
        await authClient.auth.signOut();
        setRole(null);
        setEmail(null);
        setError(null);
        setLoading(false);
      },
    }),
    [loading, role, email, error],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useAuth = () => {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider is missing.");
  return value;
};
