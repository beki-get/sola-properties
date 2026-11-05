"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../lib/api";
import styles from "../auth.module.css";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/dashboard";

  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // If already authenticated, redirect
  useEffect(() => {
    if (isAuthenticated) {
      router.push(redirectUrl);
    }
  }, [isAuthenticated, redirectUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg("Please provide both email and password.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await login({
        email: email.trim(),
        password,
      });

      if (!result.ok) {
        setErrorMsg(result.message || "Invalid credentials. Please try again.");
      } else {
        setSuccessMsg(result.message || "Signed in successfully. Initializing workspace...");
        setTimeout(() => {
          router.push(redirectUrl);
        }, 800);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setErrorMsg("Please enter your email above to resend verification.");
      return;
    }
    try {
      setIsLoading(true);
      const res = await authApi.resendVerification({ email: email.trim() });
      if (res.ok) {
        setSuccessMsg(res.message || "Verification email sent. Please check your inbox.");
      } else {
        setErrorMsg(res.message || "Failed to resend verification email.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Could not resend email.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.authWrapper}>
      <div className={styles.authTopBar}>
        <Link href="/" className={styles.brandLink}>
          <div className={styles.brandIcon}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
          </div>
          <span>Sola Properties</span>
        </Link>

        <Link href="/" className={styles.backHomeLink}>
          <ArrowLeft size={16} />
          <span>Back to Home</span>
        </Link>
      </div>

      <div className={styles.authCard}>
        <span className={styles.authBadge}>Authentication</span>
        <h1 className={styles.authTitle}>Sign In</h1>
        <p className={styles.authSubtitle}>
          Access verified residential properties, manage developments, and view municipal documents.
        </p>

        {errorMsg && (
          <div className={`${styles.feedbackAlert} ${styles.feedbackError}`}>
            <AlertCircle size={18} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
              <span>{errorMsg}</span>
              {errorMsg.toLowerCase().includes("verify your email") && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#000000",
                    fontWeight: 700,
                    textDecoration: "underline",
                    cursor: "pointer",
                    textAlign: "left",
                    padding: 0,
                    fontFamily: "inherit",
                    fontSize: 13,
                  }}
                >
                  Click here to resend verification email →
                </button>
              )}
            </div>
          </div>
        )}

        {successMsg && (
          <div className={`${styles.feedbackAlert} ${styles.feedbackSuccess}`}>
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Email Address</label>
            <input
              type="email"
              required
              maxLength={255}
              placeholder="e.g. agent@example.com"
              className={styles.formInput}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Password</label>
            <div className={styles.inputWrap}>
              <input
                type={showPassword ? "text" : "password"}
                required
                maxLength={128}
                placeholder="Enter account password"
                className={styles.formInput}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className={styles.extraRow}>
            <span />
            <Link href="/forgot-password" className={styles.forgotLink}>
              Forgot password?
            </Link>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={isLoading}>
            <span>{isLoading ? "Signing in..." : "Sign In to Workspace"}</span>
            <ArrowRight size={18} strokeWidth={2.4} />
          </button>
        </form>

        <div className={styles.authFooterSwitch}>
          Don&apos;t have an account?
          <Link href="/register" className={styles.switchLink}>
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.authWrapper}>
          <p style={{ fontWeight: 800 }}>Loading Sign In Module...</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
