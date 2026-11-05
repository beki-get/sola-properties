"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../lib/api";
import styles from "../auth.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"buyer" | "agent" | "developer">("buyer");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (fullName.trim().length < 2) {
      setErrorMsg("Full name must be at least 2 characters.");
      return;
    }

    if (!email.trim()) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await authApi.register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role,
      });

      if (!result.ok) {
        setErrorMsg(result.message || "Registration failed. Please verify your details.");
      } else {
        setSuccessMsg(result.message || "Account created successfully! Redirecting to sign in...");
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

        <Link href="/" className={styles.backHomeLink}>
          <ArrowLeft size={16} />
          <span>Back to Home</span>
        </Link>
      </div>

      <div className={styles.authCard}>
        <span className={styles.authBadge}>Onboarding</span>
        <h1 className={styles.authTitle}>Create Account</h1>
        <p className={styles.authSubtitle}>
          Join Sola Properties as a verified buyer, accredited real estate agent, or property developer.
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
            <label className={styles.formLabel}>Select Account Role</label>
            <div className={styles.roleSelector}>
              <button
                type="button"
                className={`${styles.roleBtn} ${role === "buyer" ? styles.roleBtnActive : ""}`}
                onClick={() => setRole("buyer")}
              >
                Home Buyer
              </button>
              <button
                type="button"
                className={`${styles.roleBtn} ${role === "agent" ? styles.roleBtnActive : ""}`}
                onClick={() => setRole("agent")}
              >
                Licensed Agent
              </button>
              <button
                type="button"
                className={`${styles.roleBtn} ${role === "developer" ? styles.roleBtnActive : ""}`}
                onClick={() => setRole("developer")}
              >
                Developer
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Full Name</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={150}
              placeholder="e.g. Abebe Alemu"
              className={styles.formInput}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Email Address</label>
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

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Password (Min 8 Characters)</label>
            <div className={styles.inputWrap}>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                maxLength={128}
                placeholder="Create a secure password"
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

          <button type="submit" className={styles.submitBtn} disabled={isLoading} style={{ marginTop: 10 }}>
            <span>{isLoading ? "Creating Account..." : "Create Account"}</span>
            <ArrowRight size={18} strokeWidth={2.4} />
          </button>
        </form>

        <div className={styles.authFooterSwitch}>
          Already registered on Sola Properties?
          <Link href="/login" className={styles.switchLink}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
