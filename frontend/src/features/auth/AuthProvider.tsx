import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { API_BASE_URL } from "../../shared/api/client";
import { getAuthClient } from "./supabase";

const SESSION_CHECK_TIMEOUT_MS = 12_000;
const ROLE_CHECK_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(resolve, reject).finally(() => window.clearTimeout(timeout));
  });
}

export type AppRole = "user" | "admin" | "superadmin";
type AuthState = {
  loading: boolean;
  user: User | null;
  role: AppRole | null;
  roleError: string | null;
  configurationError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const resolvedUserId = useRef<string | null>(null);

  const resolveRole = useCallback(
    async (session: Session | null, requestGeneration: number, blocking = true) => {
      if (!session) {
        resolvedUserId.current = null;
        setUser(null);
        setRole(null);
        setRoleError(null);
        setLoading(false);
        return;
      }
      setUser(session.user);
      if (blocking) {
        setRole(null);
        setRoleError(null);
        setLoading(true);
      }
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), ROLE_CHECK_TIMEOUT_MS);
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: controller.signal,
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(body.error || `Could not load account (${response.status}).`);
        const nextRole = body?.data?.role as AppRole | undefined;
        if (!["user", "admin", "superadmin"].includes(nextRole ?? "")) {
          throw new Error("Your account role is missing or invalid. Contact a superadmin.");
        }
        if (requestGeneration === generationRef.current) {
          resolvedUserId.current = session.user.id;
          setRole(nextRole ?? null);
          setRoleError(null);
        }
      } catch (error) {
        if (
          requestGeneration === generationRef.current &&
          (blocking || resolvedUserId.current !== session.user.id)
        ) {
          resolvedUserId.current = null;
          setRole(null);
          setRoleError(
            controller.signal.aborted
              ? "Account check timed out. Check your connection and try again."
              : (error as Error).message,
          );
        }
      } finally {
        window.clearTimeout(timeout);
        if (requestGeneration === generationRef.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;
    try {
      const client = getAuthClient();
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((event, session) => {
        if (!active) return;
        const current = ++generationRef.current;
        if (!session) {
          resolvedUserId.current = null;
          setUser(null);
          setRole(null);
          setRoleError(null);
          setLoading(false);
          return;
        }
        const blocking =
          event === "INITIAL_SESSION" ||
          event === "SIGNED_IN" ||
          resolvedUserId.current !== session.user.id;
        if (blocking) {
          setUser(session.user);
          setRole(null);
          setRoleError(null);
          setLoading(true);
        }
        // Keep the SDK auth callback synchronous; role lookup runs after its lock is released.
        window.setTimeout(() => {
          void resolveRole(session, current, blocking);
        }, 0);
      });
      const recheckRole = () => {
        if (document.visibilityState !== "visible") return;
        const generationAtStart = generationRef.current;
        void withTimeout(
          client.auth.getSession(),
          SESSION_CHECK_TIMEOUT_MS,
          "Checking your session timed out.",
        )
          .then(({ data, error }) => {
            if (!active || generationRef.current !== generationAtStart) return;
            if (error) throw error;
            if (!data.session) {
              resolvedUserId.current = null;
              setUser(null);
              setRole(null);
              setRoleError(null);
              setLoading(false);
              return;
            }
            const current = ++generationRef.current;
            void resolveRole(
              data.session,
              current,
              resolvedUserId.current !== data.session.user.id,
            );
          })
          .catch((error) => {
            if (!active || generationRef.current !== generationAtStart) return;
            setRoleError((error as Error).message || "Could not refresh your session.");
            setLoading(false);
          });
      };
      window.addEventListener("focus", recheckRole);
      document.addEventListener("visibilitychange", recheckRole);
      const generationAtStart = generationRef.current;
      void withTimeout(
        client.auth.getSession(),
        SESSION_CHECK_TIMEOUT_MS,
        "Checking your session timed out. Please sign in again.",
      )
        .then(({ data, error }) => {
          if (!active || generationRef.current !== generationAtStart) return;
          if (error) throw error;
          const current = ++generationRef.current;
          void resolveRole(data.session, current);
        })
        .catch((error) => {
          if (!active || generationRef.current !== generationAtStart) return;
          setConfigurationError((error as Error).message);
          setLoading(false);
        });
      return () => {
        active = false;
        subscription.unsubscribe();
        window.removeEventListener("focus", recheckRole);
        document.removeEventListener("visibilitychange", recheckRole);
      };
    } catch (error) {
      setConfigurationError((error as Error).message);
      setLoading(false);
    }
  }, [resolveRole]);

  const refreshRole = useCallback(async () => {
    const generationAtStart = generationRef.current;
    try {
      const { data } = await withTimeout(
        getAuthClient().auth.getSession(),
        SESSION_CHECK_TIMEOUT_MS,
        "Checking your session timed out. Please try again.",
      );
      if (generationRef.current !== generationAtStart) return;
      const current = ++generationRef.current;
      await resolveRole(data.session, current);
    } catch (error) {
      if (generationRef.current !== generationAtStart) return;
      setRole(null);
      setRoleError((error as Error).message);
      setLoading(false);
    }
  }, [resolveRole]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await getAuthClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      await refreshRole();
      if (!data.session) throw new Error("Sign-in completed without an active session. Try again.");
    },
    [refreshRole],
  );

  const signOut = useCallback(async () => {
    const { error } = await getAuthClient().auth.signOut();
    if (error) throw error;
    setUser(null);
    setRole(null);
    setRoleError(null);
    setLoading(false);
  }, []);

  const value = useMemo(
    () => ({ loading, user, role, roleError, configurationError, signIn, signOut, refreshRole }),
    [loading, user, role, roleError, configurationError, signIn, signOut, refreshRole],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
