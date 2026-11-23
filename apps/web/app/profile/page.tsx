"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  User,
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  Globe,
  Bell,
  CheckCircle2,
  AlertCircle,
  Save,
  ArrowRight,
  LogOut,
  Sliders,
} from "lucide-react";
import { useAuth, ProtectedRoute } from "../../context/AuthContext";
import {
  buyerApi,
  agentApi,
  developerApi,
  notificationApi,
  NotificationPreference,
} from "../../lib/api";
import styles from "./profile.module.css";

function ProfileContent() {
  const { user, logout, refreshProfile } = useAuth();

  // Role Form States
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerContactMethod, setBuyerContactMethod] = useState("whatsapp");

  const [agentPhone, setAgentPhone] = useState("");
  const [agentAgency, setAgentAgency] = useState("");
  const [agentBio, setAgentBio] = useState("");
  const [agentExp, setAgentExp] = useState(3);

  const [devCompany, setDevCompany] = useState("");
  const [devDesc, setDevDesc] = useState("");
  const [devPhone, setDevPhone] = useState("");
  const [devAddress, setDevAddress] = useState("");
  const [devWebsite, setDevWebsite] = useState("");

  // Notification Preferences State
  const [notifInApp, setNotifInApp] = useState(true);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Load Initial Data
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    if (user.role === "buyer") {
      buyerApi.getProfile().then((res) => {
        const p = res.data?.profile || (res.data as any)?.data;
        if (res.ok && p) {
          setBuyerPhone(p.phoneNumber || p.phone_number || "");
          setBuyerContactMethod(p.preferredContactMethod || p.preferred_contact_method || "whatsapp");
        }
      });
    } else if (user.role === "agent") {
      agentApi.getProfile().then((res) => {
        const p = res.data?.profile || (res.data as any)?.data;
        if (res.ok && p) {
          setAgentPhone(p.phone_number || "");
          setAgentAgency(p.agency_name || "");
          setAgentBio(p.bio || "");
          setAgentExp(p.years_of_experience ?? 3);
        }
      });
    } else if (user.role === "developer") {
      developerApi.getProfile().then((res) => {
        const p = res.data?.profile || (res.data as any)?.data;
        if (res.ok && p) {
          setDevCompany(p.company_name || "");
          setDevDesc(p.company_description || "");
          setDevPhone(p.contact_phone || "");
          setDevAddress(p.business_address || "");
          setDevWebsite(p.website_url || "");
        }
      });
    }

    // Load Notification Preferences
    notificationApi
      .getPreferences()
      .then((res) => {
        const prefs = res.data?.preferences || (res.data as any)?.data;
        if (res.ok && prefs) {
          setNotifInApp(prefs.in_app_notifications ?? true);
          setNotifEmail(prefs.email_notifications ?? true);
          setNotifMarketing(prefs.marketing_notifications ?? false);
        }
      })
      .catch(() => {
        // Keep defaults
      })
      .finally(() => setLoading(false));
  }, [user]);

  // Handle Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      if (user?.role === "buyer") {
        const res = await buyerApi.updateProfile({
          phoneNumber: buyerPhone.trim(),
          preferredContactMethod: buyerContactMethod as any,
        });
        if (!res.ok) throw new Error(res.message || "Failed to update buyer profile");
      } else if (user?.role === "agent") {
        const res = await agentApi.updateProfile({
          phone_number: agentPhone.trim(),
          agency_name: agentAgency.trim(),
          bio: agentBio.trim(),
          years_of_experience: Number(agentExp),
        });
        if (!res.ok) throw new Error(res.message || "Failed to update agent profile");
      } else if (user?.role === "developer") {
        const res = await developerApi.updateProfile({
          company_name: devCompany.trim(),
          company_description: devDesc.trim(),
          contact_phone: devPhone.trim(),
          business_address: devAddress.trim(),
          website_url: devWebsite.trim(),
        });
        if (!res.ok) throw new Error(res.message || "Failed to update developer profile");
      }

      setFeedback({ ok: true, msg: "Profile credentials updated and synchronized with the Sola ledger." });
      refreshProfile?.();
    } catch (err: any) {
      setFeedback({ ok: false, msg: err.message || "Could not save profile updates." });
    } finally {
      setSaving(false);
    }
  };

  // Handle Notification Preferences Save
  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNotifs(true);
    setFeedback(null);

    try {
      const res = await notificationApi.updatePreferences({
        in_app_notifications: notifInApp,
        email_notifications: notifEmail,
        marketing_notifications: notifMarketing,
      });

      if (!res.ok) {
        throw new Error(res.message || "Failed to update notification preferences.");
      }

      setFeedback({ ok: true, msg: "Notification dispatch preferences updated successfully." });
    } catch (err: any) {
      setFeedback({ ok: false, msg: err.message || "Could not update notification settings." });
    } finally {
      setSavingNotifs(false);
    }
  };

  return (
    <div className={styles.profileWrapper}>
      {/* Header */}
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

        <nav className={styles.headerNav}>
          <Link href="/properties" className={styles.navLink}>
            Properties
          </Link>
          <Link href="/projects" className={styles.navLink}>
            Developments
          </Link>
          <Link href="/properties/compare" className={styles.navLink}>
            Compare
          </Link>
        </nav>

        <div className={styles.headerRight}>
          <Link href="/dashboard" className={styles.dashBtn}>
            Workstation Dashboard
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "6px 10px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#6a717e",
              fontWeight: 700,
              fontSize: "0.82rem",
            }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className={styles.mainContainer}>
        <div className={styles.pageHeader}>
          <span className={styles.pagePretitle}>Identity & Security</span>
          <h1 className={styles.pageTitle}>Account Governance & Profile</h1>
          <p className={styles.pageDesc}>
            Manage your accredited identity credentials, role permissions, and notification dispatch preferences.
          </p>
        </div>

        {/* Global Feedback */}
        {feedback && (
          <div
            className={`${styles.feedbackAlert} ${
              feedback.ok ? styles.feedbackSuccess : styles.feedbackError
            }`}
          >
            {feedback.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.msg}</span>
          </div>
        )}

        {/* Identity Overview Card */}
        <section className={styles.identityCard}>
          <div className={styles.identityBlock}>
            <span className={styles.identityLabel}>Authenticated User</span>
            <span className={styles.identityValue}>{user?.fullName || "Verified User"}</span>
            <span style={{ fontSize: "0.85rem", color: "#6a717e" }}>{user?.email}</span>
          </div>

          <div className={styles.identityBlock}>
            <span className={styles.identityLabel}>System Role</span>
            <span className={styles.identityValue} style={{ textTransform: "capitalize" }}>
              {user?.role}
            </span>
            <span style={{ fontSize: "0.85rem", color: "#6a717e" }}>
              {user?.role === "buyer"
                ? "Residential Seeker"
                : user?.role === "agent"
                ? "Accredited Broker"
                : user?.role === "developer"
                ? "Real Estate Builder"
                : "Platform Executive"}
            </span>
          </div>

          <div className={styles.identityBlock}>
            <span className={styles.identityLabel}>Accreditation Status</span>
            <div
              className={`${styles.statusPill} ${
                user?.status === "approved" ? styles.statusApproved : styles.statusPending
              }`}
            >
              <ShieldCheck size={14} />
              <span>{user?.status === "approved" ? "Approved Clearance" : "Pending Verification"}</span>
            </div>
            <span style={{ fontSize: "0.82rem", color: "#8c95a6", marginTop: 4 }}>
              Municipal security audited
            </span>
          </div>
        </section>

        {/* Role-Specific Form */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              {user?.role === "buyer"
                ? "Buyer Contact Credentials"
                : user?.role === "agent"
                ? "Accredited Brokerage Profile"
                : user?.role === "developer"
                ? "Corporate Developer Entity"
                : "Administrator Credentials"}
            </h2>
            <p className={styles.sectionDesc}>
              {user?.role === "buyer"
                ? "Configure how verified agents and developers contact you regarding scheduled tours and inquiries."
                : user?.role === "agent"
                ? "Public broker credentials displayed on your verified listings and referral activities."
                : user?.role === "developer"
                ? "Corporate credentials and municipal contact info displayed on your master developments."
                : "Platform governance controls and security auditing credentials."}
            </p>
          </div>

          <form onSubmit={handleSaveProfile}>
            {user?.role === "buyer" && (
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Contact Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+251 91 123 4567"
                    className={styles.formInput}
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Preferred Contact Method</label>
                  <select
                    className={styles.formSelect}
                    value={buyerContactMethod}
                    onChange={(e) => setBuyerContactMethod(e.target.value)}
                    disabled={saving}
                  >
                    <option value="whatsapp">WhatsApp Direct</option>
                    <option value="phone">Direct Phone Call</option>
                    <option value="email">Email Notification</option>
                  </select>
                </div>
              </div>
            )}

            {user?.role === "agent" && (
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Agency / Brokerage Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Prime Addis Realty"
                    className={styles.formInput}
                    value={agentAgency}
                    onChange={(e) => setAgentAgency(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Direct Broker Phone</label>
                  <input
                    type="tel"
                    placeholder="+251 91 000 1122"
                    className={styles.formInput}
                    value={agentPhone}
                    onChange={(e) => setAgentPhone(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Years of Experience</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    className={styles.formInput}
                    value={agentExp}
                    onChange={(e) => setAgentExp(Number(e.target.value))}
                    disabled={saving}
                  />
                </div>

                <div className={styles.formGroupFull}>
                  <label className={styles.formLabel}>Professional Broker Bio</label>
                  <textarea
                    placeholder="Describe your residential specialty, verified districts (Bole, Kazanchis, Old Airport)..."
                    className={styles.formTextarea}
                    value={agentBio}
                    onChange={(e) => setAgentBio(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
            )}

            {user?.role === "developer" && (
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Company / Entity Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Solanova Developments PLC"
                    className={styles.formInput}
                    value={devCompany}
                    onChange={(e) => setDevCompany(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Corporate Phone</label>
                  <input
                    type="tel"
                    placeholder="+251 91 444 5566"
                    className={styles.formInput}
                    value={devPhone}
                    onChange={(e) => setDevPhone(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Official Website URL</label>
                  <input
                    type="url"
                    placeholder="https://solanova.et"
                    className={styles.formInput}
                    value={devWebsite}
                    onChange={(e) => setDevWebsite(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className={styles.formGroupFull}>
                  <label className={styles.formLabel}>Registered Business Address</label>
                  <input
                    type="text"
                    placeholder="Meskel Square Tower, 14th Floor, Addis Ababa"
                    className={styles.formInput}
                    value={devAddress}
                    onChange={(e) => setDevAddress(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className={styles.formGroupFull}>
                  <label className={styles.formLabel}>Corporate Description</label>
                  <textarea
                    placeholder="Describe building portfolio, construction standards, architectural vision..."
                    className={styles.formTextarea}
                    value={devDesc}
                    onChange={(e) => setDevDesc(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
            )}

            <button type="submit" className={styles.saveBtn} disabled={saving}>
              <Save size={16} />
              <span>{saving ? "Synchronizing..." : "Save Profile Details"}</span>
            </button>
          </form>
        </section>

        {/* Notification Preferences */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Dispatch & Notification Preferences</h2>
            <p className={styles.sectionDesc}>
              Control which system alerts, referral lead activities, and escrow settlement notifications are dispatched to your devices.
            </p>
          </div>

          <form onSubmit={handleSaveNotifications}>
            <div className={styles.toggleRow}>
              <div className={styles.toggleInfo}>
                <span className={styles.toggleLabel}>In-App Notifications</span>
                <span className={styles.toggleDesc}>
                  Receive real-time alerts in the top dashboard bell drawer for tours, leads, and transaction updates.
                </span>
              </div>
              <input
                type="checkbox"
                className={styles.toggleCheckbox}
                checked={notifInApp}
                onChange={(e) => setNotifInApp(e.target.checked)}
                disabled={savingNotifs}
              />
            </div>

            <div className={styles.toggleRow}>
              <div className={styles.toggleInfo}>
                <span className={styles.toggleLabel}>Direct Email Dispatches</span>
                <span className={styles.toggleDesc}>
                  Receive official transactional emails for title verification approvals, tour confirmations, and commission disbursements.
                </span>
              </div>
              <input
                type="checkbox"
                className={styles.toggleCheckbox}
                checked={notifEmail}
                onChange={(e) => setNotifEmail(e.target.checked)}
                disabled={savingNotifs}
              />
            </div>

            <div className={styles.toggleRow}>
              <div className={styles.toggleInfo}>
                <span className={styles.toggleLabel}>Architectural Digest & Market Reports</span>
                <span className={styles.toggleDesc}>
                  Receive periodic curated reports on emerging prime developments and quarterly property market indices.
                </span>
              </div>
              <input
                type="checkbox"
                className={styles.toggleCheckbox}
                checked={notifMarketing}
                onChange={(e) => setNotifMarketing(e.target.checked)}
                disabled={savingNotifs}
              />
            </div>

            <button type="submit" className={styles.saveBtn} disabled={savingNotifs}>
              <Bell size={16} />
              <span>{savingNotifs ? "Updating..." : "Update Notification Preferences"}</span>
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
