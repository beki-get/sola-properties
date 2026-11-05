"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, Lock } from "lucide-react";
import { authApi } from "../../lib/api";
import styles from "../auth.module.css";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get("token") || "";

  const [token, setToken] = useState(urlToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (urlToken) {
      setToken(urlToken);
    }
  }, [urlToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (token.trim().length < 32) {
      setErrorMsg("Reset token must be at least 32 characters long.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await authApi.resetPassword({
        token: token.trim(),
        newPassword,
      });

      if (!result.ok) {
        setErrorMsg(result.message || "Failed to reset password. The token may be expired.");
      } else {
        setSuccessMsg(result.message || "Password updated successfully! Redirecting to sign in...");
        setTimeout(() => {
          router.push("/login");
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
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

        <Link href="/login" className={styles.backHomeLink}>
          <ArrowLeft size={16} />
          <span>Back to Sign In</span>
        </Link>
      </div>

      <div className={styles.authCard}>
        <span className={styles.authBadge}>Security</span>
        <h1 className={styles.authTitle}>Reset Password</h1>
        <p className={styles.authSubtitle}>
          Enter your verification reset token and choose a new secure password.
        </p>

        {errorMsg && (
          <div className={`${styles.feedbackAlert} ${styles.feedbackError}`}>
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
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
            <label className={styles.formLabel}>Reset Token</label>
            <input
              type="text"
              required
              minLength={32}
              maxLength={512}
              placeholder="Paste 32+ character reset token from your email"
              className={styles.formInput}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>New Password (Min 8 Characters)</label>
            <div className={styles.inputWrap}>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                maxLength={128}
                placeholder="Enter new password"
                className={styles.formInput}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Confirm New Password</label>
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              maxLength={128}
              placeholder="Re-enter new password"
              className={styles.formInput}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={isLoading} style={{ marginTop: 10 }}>
            <span>{isLoading ? "Updating Password..." : "Set New Password"}</span>
            <Lock size={18} strokeWidth={2.4} />
          </button>
        </form>

        <div className={styles.authFooterSwitch}>
          Remember your password?
          <Link href="/login" className={styles.switchLink}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.authWrapper}>
          <div className={styles.authCard}>
            <p>Loading reset form...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
