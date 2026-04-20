"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import type { PublicUser } from "@/lib/contracts";

interface AuthContextValue {
  ready: boolean;
  token: string | null;
  user: PublicUser | null;
  setSession: (token: string, user: PublicUser) => void;
  clearSession: () => void;
  refreshUser: (tokenOverride?: string) => Promise<void>;
}

interface StoredSession {
  token: string;
  user: PublicUser;
}

interface AuthState {
  ready: boolean;
  token: string | null;
  user: PublicUser | null;
}

const STORAGE_KEY = "learn-with-me.session";
const AuthContext = createContext<AuthContextValue | null>(null);

function persistSession(session: StoredSession | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function readStoredState(): AuthState {
  if (typeof window === "undefined") {
    return {
      ready: false,
      token: null,
      user: null,
    };
  }

  const rawSession = window.localStorage.getItem(STORAGE_KEY);

  if (!rawSession) {
    return {
      ready: true,
      token: null,
      user: null,
    };
  }

  try {
    const session = JSON.parse(rawSession) as StoredSession;
    return {
      ready: false,
      token: session.token,
      user: session.user,
    };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return {
      ready: true,
      token: null,
      user: null,
    };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(() => readStoredState());

  useEffect(() => {
    if (authState.ready || !authState.token) {
      return;
    }

    let cancelled = false;

    void apiRequest<{ user: PublicUser }>("/auth/me", { token: authState.token })
      .then((response) => {
        if (cancelled) {
          return;
        }

        persistSession({
          token: authState.token!,
          user: response.user,
        });
        setAuthState({
          ready: true,
          token: authState.token,
          user: response.user,
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        persistSession(null);
        setAuthState({
          ready: true,
          token: null,
          user: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [authState.ready, authState.token]);

  async function refreshUser(tokenOverride?: string) {
    const activeToken = tokenOverride ?? authState.token;

    if (!activeToken) {
      return;
    }

    const response = await apiRequest<{ user: PublicUser }>("/auth/me", {
      token: activeToken,
    });

    persistSession({
      token: activeToken,
      user: response.user,
    });
    setAuthState({
      ready: true,
      token: activeToken,
      user: response.user,
    });
  }

  function setSession(nextToken: string, nextUser: PublicUser) {
    persistSession({
      token: nextToken,
      user: nextUser,
    });
    setAuthState({
      ready: true,
      token: nextToken,
      user: nextUser,
    });
  }

  function clearSession() {
    persistSession(null);
    setAuthState({
      ready: true,
      token: null,
      user: null,
    });
  }

  return (
    <AuthContext.Provider
      value={{
        ready: authState.ready,
        token: authState.token,
        user: authState.user,
        setSession,
        clearSession,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
