"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, AlertCircle, Mail, ArrowRight, Loader2 } from "lucide-react";
import { authApi } from "../../lib/api";
import styles from "../auth.module.css";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";

  const [token, setToken] = useState(tokenFromUrl);
  const [resendEmail, setResendEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">(
    tokenFromUrl ? "verifying" : "idle"
  );
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (tokenFromUrl) {
      handleVerify(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  const handleVerify = async (tokenToVerify: string) => {
    if (!tokenToVerify.trim()) {
      setStatus("error");
      setFeedbackMsg("Please provide a valid verification token.");
      return;
    }

    setStatus("verifying");
    setFeedbackMsg(null);

    try {
      const res = await authApi.verifyEmail({ token: tokenToVerify.trim() });
      if (res.ok) {
        setStatus("success");
        setFeedbackMsg(res.message || "Your email address has been verified successfully!");
      } else {
        setStatus("error");
        setFeedbackMsg(res.message || "Verification token is invalid or has expired.");
      }
    } catch (err: any) {
      setStatus("error");
      setFeedbackMsg(err.message || "An unexpected error occurred during email verification.");
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) {
      setFeedbackMsg("Please enter your account email address.");
      return;
    }

    setResending(true);
    setResendSuccess(null);

    try {
      const res = await authApi.resendVerification({ email: resendEmail.trim() });
      if (res.ok) {
        setResendSuccess(res.message || "Verification instructions dispatched to your inbox.");
      } else {
        setFeedbackMsg(res.message || "Could not process verification resend.");
      }
    } catch (err: any) {
      setFeedbackMsg(err.message || "Failed to resend verification email.");
    } finally {
      setResending(false);
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
        <span className={styles.authBadge}>Security & Trust</span>
        <h1 className={styles.authTitle}>Email Verification</h1>
        <p className={styles.authSubtitle}>
          Confirm your ownership to activate your verified Sola Properties residential account.
        </p>

        {status === "verifying" && (
          <div style={{ padding: "36px 0", textAlign: "center" }}>
            <Loader2
              size={36}
              color="#000"
              style={{ animation: "spin 1s linear infinite", margin: "0 auto 16px" }}
            />
            <p style={{ fontWeight: 700, fontSize: "1rem" }}>
              Auditing verification token against municipal security ledger...
            </p>
          </div>
        )}

        {status === "success" && (
          <div>
            <div className={`${styles.feedbackAlert} ${styles.feedbackSuccess}`}>
              <CheckCircle2 size={20} />
              <span style={{ fontWeight: 600 }}>{feedbackMsg}</span>
            </div>

            <div style={{ marginTop: 24 }}>
              <Link href="/login" className={styles.submitBtn} style={{ textDecoration: "none" }}>
                <span>Proceed to Sign In</span>
                <ArrowRight size={18} strokeWidth={2.4} />
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div>
            <div className={`${styles.feedbackAlert} ${styles.feedbackError}`}>
              <AlertCircle size={20} />
              <span>{feedbackMsg}</span>
            </div>

            <div style={{ marginTop: 28, borderTop: "1px solid #e2e6ec", paddingTop: 20 }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: 8 }}>
                Request New Verification Link
              </h3>
              <p style={{ fontSize: "0.85rem", color: "#6a717e", marginBottom: 16 }}>
                Verification links expire after 24 hours. Enter your registered email to receive a new token.
              </p>

              {resendSuccess && (
                <div
                  className={`${styles.feedbackAlert} ${styles.feedbackSuccess}`}
                  style={{ marginBottom: 16 }}
                >
                  <CheckCircle2 size={18} />
                  <span>{resendSuccess}</span>
                </div>
              )}

              <form onSubmit={handleResend}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Your Registered Email</label>
                  <input
                    type="email"
                    required
                    placeholder="alex@example.com"
                    className={styles.formInput}
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    disabled={resending}
                  />
                </div>

                <button type="submit" className={styles.submitBtn} disabled={resending}>
                  <span>{resending ? "Dispatching..." : "Send Verification Email"}</span>
                  <Mail size={18} />
                </button>
              </form>
            </div>
          </div>
        )}

        {status === "idle" && (
          <div>
            <p style={{ fontSize: "0.9rem", color: "#6a717e", marginBottom: 20 }}>
              If you received a verification token in your email, paste it below or request a fresh link.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerify(token);
              }}
            >
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Verification Token</label>
                <input
                  type="text"
                  required
                  placeholder="Paste 64-character verification token"
                  className={styles.formInput}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </div>

              <button type="submit" className={styles.submitBtn}>
                <span>Verify Account</span>
                <ArrowRight size={18} strokeWidth={2.4} />
              </button>
            </form>

            <div style={{ marginTop: 28, borderTop: "1px solid #e2e6ec", paddingTop: 20 }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: 8 }}>
                Need a new verification link?
              </h3>
              <form onSubmit={handleResend}>
                <div className={styles.formGroup}>
                  <input
                    type="email"
                    required
                    placeholder="Enter email to resend"
                    className={styles.formInput}
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    disabled={resending}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "#000000",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                  disabled={resending}
                >
                  <span>{resending ? "Sending..." : "Resend Email"}</span>
                  <Mail size={16} />
                </button>
              </form>
            </div>
          </div>
        )}

        <div className={styles.authFooterSwitch}>
          Already verified?
          <Link href="/login" className={styles.switchLink}>
            Sign In to Sola Properties
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.authWrapper}>
          <p style={{ fontWeight: 700 }}>Loading Verification Module...</p>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
