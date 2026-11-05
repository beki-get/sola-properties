"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  authApi,
  User,
  LoginPayload,
  RegisterPayload,
} from "../lib/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<{ ok: boolean; message?: string }>;
  register: (payload: RegisterPayload) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize session on client mount
  const initSession = useCallback(async () => {
    setIsLoading(true);

    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    const localToken = localStorage.getItem("sola_access_token");

    if (localToken) {
      setToken(localToken);
      // Verify token with backend /api/v1/auth/me
      const meRes = await authApi.getMe();
      const userData = meRes.data?.data || (meRes.data as any)?.user;

      if (meRes.ok && userData) {
        setUser(userData);
        setIsLoading(false);
        return;
      }

      // If token expired (401), try refreshing using HttpOnly cookie
      const refreshRes = await authApi.refresh();
      if (refreshRes.ok && refreshRes.data?.data?.accessToken) {
        const newToken = refreshRes.data.data.accessToken;
        setToken(newToken);
        const retryMe = await authApi.getMe();
        const retryUser = retryMe.data?.data || (retryMe.data as any)?.user;
        if (retryMe.ok && retryUser) {
          setUser(retryUser);
          setIsLoading(false);
          return;
        }
      }

      // Token and refresh invalid: purge local state
      localStorage.removeItem("sola_access_token");
      localStorage.removeItem("sola_user");
      setUser(null);
      setToken(null);
    } else {
      // Check if user has an active session via refresh cookie
      try {
        const refreshRes = await authApi.refresh();
        if (refreshRes.ok && refreshRes.data?.data?.accessToken) {
          const newToken = refreshRes.data.data.accessToken;
          setToken(newToken);
          const meRes = await authApi.getMe();
          const userData = meRes.data?.data || (meRes.data as any)?.user;
          if (meRes.ok && userData) {
            setUser(userData);
          }
        }
      } catch {
        // No session cookie present
      }
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    initSession();
  }, [initSession]);

  const login = async (payload: LoginPayload) => {
    setIsLoading(true);
    try {
      const res = await authApi.login(payload);
      if (res.ok && res.data?.data?.accessToken && res.data?.data?.user) {
        setToken(res.data.data.accessToken);
        setUser(res.data.data.user);
        setIsLoading(false);
        return { ok: true, message: res.data.message || "Login successful" };
      }
      setIsLoading(false);
      return { ok: false, message: res.message || "Invalid credentials" };
    } catch (err: any) {
      setIsLoading(false);
      return { ok: false, message: err.message || "Login failed" };
    }
  };

  const register = async (payload: RegisterPayload) => {
    try {
      const res = await authApi.register(payload);
      return { ok: res.ok, message: res.message };
    } catch (err: any) {
      return { ok: false, message: err.message || "Registration failed" };
    }
  };

  const logout = async () => {
    setIsLoading(true);
    await authApi.logout();
    setUser(null);
    setToken(null);
    setIsLoading(false);
    router.push("/login");
  };

  const refreshProfile = async () => {
    const meRes = await authApi.getMe();
    const userData = meRes.data?.data || (meRes.data as any)?.user;
    if (meRes.ok && userData) {
      setUser(userData);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Route protection guard for authenticated routes
 */
export function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: ("buyer" | "agent" | "developer" | "admin" | "finance_admin")[];
}) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#eaebed",
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: "3px solid #000000",
            borderTopColor: "transparent",
            animation: "spin 0.8s linear infinite",
            marginBottom: 16,
          }}
        />
        <p style={{ fontWeight: 800, fontSize: "0.95rem", letterSpacing: "0.02em" }}>
          VERIFYING SESSION & AUTHORIZATION...
        </p>
        <style jsx>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#eaebed",
          padding: 24,
          textAlign: "center",
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        <h2 style={{ fontSize: "1.5rem", fontWeight: 850, marginBottom: 8 }}>
          Access Restricted
        </h2>
        <p style={{ color: "#6a717e", maxWidth: 440, marginBottom: 24 }}>
          This workspace requires one of the following roles: {allowedRoles.join(", ")}. Your current role is <strong>{user.role}</strong>.
        </p>
        <button
          onClick={() => router.push("/")}
          style={{
            padding: "12px 24px",
            backgroundColor: "#000000",
            color: "#ffffff",
            border: "none",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Return to Sola Properties
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
