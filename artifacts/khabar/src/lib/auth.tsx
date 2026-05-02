import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CurrentUser } from "@workspace/api-zod";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  refresh: () => Promise<void>;
  setUser: (user: CurrentUser) => void;
  logout: () => Promise<void>;
}

const API_BASE = `${import.meta.env.BASE_URL}api`;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUserState] = useState<CurrentUser | null>(null);
  const queryClient = useQueryClient();

  const fetchMe = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
      if (res.ok) {
        const me = (await res.json()) as CurrentUser;
        setUserState(me);
        setStatus("authenticated");
      } else {
        setUserState(null);
        setStatus("anonymous");
      }
    } catch {
      setUserState(null);
      setStatus("anonymous");
    }
  };

  useEffect(() => {
    void fetchMe();
  }, []);

  const value: AuthContextValue = {
    status,
    user,
    refresh: fetchMe,
    setUser: (u) => {
      setUserState(u);
      setStatus("authenticated");
    },
    logout: async () => {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      setUserState(null);
      setStatus("anonymous");
      queryClient.clear();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function useCurrentUser(): CurrentUser | null {
  const { user } = useAuth();
  return user;
}

export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
  });
}

export const API_BASE_URL = API_BASE;
