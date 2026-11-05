"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, Mail } from "lucide-react";
import { authApi } from "../../lib/api";
import styles from "../auth.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg("Please enter your registered email address.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await authApi.forgotPassword({
        email: email.trim(),
      });

      if (!result.ok) {
        setErrorMsg(result.message || "Failed to process password reset request.");
      } else {
        setSuccessMsg(
          result.message ||
            "If an account exists with this email, a password reset token has been dispatched."
        );
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
        <h1 className={styles.authTitle}>Recover Password</h1>
        <p className={styles.authSubtitle}>
          Enter your registered email address to receive password reset instructions.
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
            <div>
              <p style={{ margin: 0 }}>{successMsg}</p>
              <Link
                href="/reset-password"
                style={{
                  display: "inline-block",
                  marginTop: 8,
                  fontWeight: 800,
                  color: "#065f46",
                  textDecoration: "underline",
                }}
              >
                Already have a reset token? Click here to set a new password →
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Registered Email Address</label>
            <input
              type="email"
              required
              maxLength={255}
              placeholder="alex@example.com"
              className={styles.formInput}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={isLoading} style={{ marginTop: 10 }}>
            <span>{isLoading ? "Sending Instructions..." : "Send Reset Instructions"}</span>
            <Mail size={18} strokeWidth={2.4} />
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
