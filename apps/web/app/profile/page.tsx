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
  X,
} from "lucide-react";
import { useAuth, ProtectedRoute } from "../../context/AuthContext";
import { Navbar } from "../components/Navbar";
import {
  authApi,
  buyerApi,
  agentApi,
  developerApi,
  notificationApi,
  NotificationPreference,
} from "../../lib/api";
import styles from "./profile.module.css";

function ProfileContent() {
  const { user, logout, refreshProfile } = useAuth();

  // Name State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

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

  // Auto-dismiss feedback banner after 4 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => {
        setFeedback(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Load Initial Data
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const nameParts = (user.fullName || "").trim().split(" ");
    setFirstName(nameParts[0] || "");
    setLastName(nameParts.slice(1).join(" ") || "");

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
      // 1. Update personal name if changed
      const currentFirst = (user?.fullName || "").trim().split(" ")[0] || "";
      const currentLast = (user?.fullName || "").trim().split(" ").slice(1).join(" ") || "";
      const newFullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      if (newFullName && (firstName.trim() !== currentFirst || lastName.trim() !== currentLast)) {
        await authApi.updateMe({
          fullName: newFullName,
        });
      }

      // 2. Update role-specific profile details
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

      setFeedback({ ok: true, msg: "Profile details updated successfully." });
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

      setFeedback({ ok: true, msg: "Notification preferences updated successfully." });
    } catch (err: any) {
      setFeedback({ ok: false, msg: err.message || "Could not update notification settings." });
    } finally {
      setSavingNotifs(false);
    }
  };

  return (
    <div className={styles.profileWrapper}>
      {/* Top Common Navbar */}
      <Navbar />

      {/* Main Container */}
      <main className={styles.mainContainer}>
        <div className={styles.pageHeader}>
          <span className={styles.pagePretitle}>Profile & Settings</span>
          <h1 className={styles.pageTitle}>Account Settings</h1>
          <p className={styles.pageDesc}>
            Manage your personal profile, role credentials, and notification preferences.
          </p>
        </div>

        {/* Global Feedback */}
        {feedback && (
          <div
            className={`${styles.feedbackAlert} ${
              feedback.ok ? styles.feedbackSuccess : styles.feedbackError
            }`}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {feedback.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{feedback.msg}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "2px 6px",
                display: "inline-flex",
                alignItems: "center",
                color: "inherit",
                opacity: 0.75,
              }}
              title="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Identity Overview Card */}
        <section className={styles.identityCard}>
          <div className={styles.identityBlock}>
            <span className={styles.identityLabel}>Account Holder</span>
            <span className={styles.identityValue}>{user?.fullName || "Verified User"}</span>
            <span style={{ fontSize: "0.85rem", color: "#6a717e" }}>{user?.email}</span>
          </div>

          <div className={styles.identityBlock}>
            <span className={styles.identityLabel}>Account Role</span>
            <span className={styles.identityValue} style={{ textTransform: "capitalize" }}>
              {user?.role}
            </span>
            <span style={{ fontSize: "0.85rem", color: "#6a717e" }}>
              {user?.role === "buyer"
                ? "Property Buyer"
                : user?.role === "agent"
                ? "Real Estate Agent"
                : user?.role === "developer"
                ? "Property Developer"
                : "Platform Administrator"}
            </span>
          </div>

          <div className={styles.identityBlock}>
            <span className={styles.identityLabel}>Verification Status</span>
            <div
              className={`${styles.statusPill} ${
                user?.status === "approved" ? styles.statusApproved : styles.statusPending
              }`}
            >
              <ShieldCheck size={14} />
              <span>{user?.status === "approved" ? "Verified & Active" : "Pending Verification"}</span>
            </div>
            <span style={{ fontSize: "0.82rem", color: "#8c95a6", marginTop: 4 }}>
              {user?.status === "approved" ? "Full access active" : "Verification in progress"}
            </span>
          </div>
        </section>

        {/* Role-Specific Form */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              {user?.role === "buyer"
                ? "Buyer Profile & Contact Details"
                : user?.role === "agent"
                ? "Agent Profile & Credentials"
                : user?.role === "developer"
                ? "Developer Company Profile"
                : "Administrator Credentials"}
            </h2>
            <p className={styles.sectionDesc}>
              {user?.role === "buyer"
                ? "Configure your personal contact preferences for property tours and inquiries."
                : user?.role === "agent"
                ? "Professional details and broker credentials displayed on your listings and client communications."
                : user?.role === "developer"
                ? "Corporate entity details displayed on your project developments."
                : "Platform governance controls and security auditing credentials."}
            </p>
          </div>

          <form onSubmit={handleSaveProfile}>
            {/* Personal Name Settings */}
            <div className={styles.formGrid} style={{ marginBottom: 20 }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>First Name</label>
                <input
                  type="text"
                  placeholder="First name"
                  className={styles.formInput}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Last Name</label>
                <input
                  type="text"
                  placeholder="Last name"
                  className={styles.formInput}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
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
                    placeholder="Describe building portfolio, construction standards, and company highlights..."
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
              <span>{saving ? "Saving..." : "Save Profile Details"}</span>
            </button>
          </form>
        </section>

        {/* Notification Preferences */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Notification Preferences</h2>
            <p className={styles.sectionDesc}>
              Choose which alerts and emails you want to receive for tours, inquiries, and transaction updates.
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
                <span className={styles.toggleLabel}>Email Notifications</span>
                <span className={styles.toggleDesc}>
                  Receive updates for tour confirmations, client inquiries, and transaction progress.
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
                <span className={styles.toggleLabel}>Market Reports & Property News</span>
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
