"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import styles from "./navbar.module.css";

export function Navbar() {
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuth();

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <header className={styles.header}>
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

      <nav className={styles.navLinks}>
        <Link
          href="/properties"
          className={`${styles.navItem} ${pathname === "/properties" ? styles.navItemActive : ""}`}
        >
          Properties
        </Link>
        <Link
          href="/projects"
          className={`${styles.navItem} ${pathname.startsWith("/projects") ? styles.navItemActive : ""}`}
        >
          Developments
        </Link>
        <Link
          href="/properties/compare"
          className={`${styles.navItem} ${pathname === "/properties/compare" ? styles.navItemActive : ""}`}
        >
          Compare
        </Link>
      </nav>

      <div className={styles.headerRight}>
        {isAuthenticated && user ? (
          <>
            <Link href="/dashboard" className={styles.dashboardBtn}>
              Dashboard
            </Link>

            <Link href="/profile" className={styles.userChip} title="Account Profile">
              <div className={styles.userAvatar}>
                {user.fullName ? getInitials(user.fullName) : <User size={14} />}
              </div>
              <span className={styles.userName}>{user.fullName || "My Account"}</span>
            </Link>
          </>
        ) : (
          <>
            <Link href="/login" className={styles.signInLink}>
              Sign In
            </Link>
            <Link href="/register" className={styles.registerBtn}>
              Register
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

export default Navbar;
