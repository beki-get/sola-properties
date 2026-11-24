"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  Ban,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Building2,
  User,
  Sliders,
  FileCheck,
  Send,
  Upload,
  ArrowRight,
  Plus,
  MapPin,
  Calendar,
  X,
  Filter,
  RefreshCw,
} from "lucide-react";
import { useAuth, ProtectedRoute } from "../../context/AuthContext";
import {
  buyerApi,
  agentApi,
  developerApi,
  verificationApi,
  adminApi,
  reportApi,
  favoriteApi,
  referralApi,
  BuyerProfile,
  BuyerPreferencesInput,
  AgentProfile,
  DeveloperProfile,
  Project,
  VerificationSubmission,
} from "../../lib/api";
import styles from "./dashboard.module.css";
import { NotificationDrawer } from "./components/NotificationDrawer";
import { BuyerWorkstation } from "./components/BuyerWorkstation";
import { AgentDeveloperWorkstation } from "./components/AgentDeveloperWorkstation";
import { AdminWorkstation } from "./components/AdminWorkstation";

const PROPERTY_TYPES = [
  "apartment",
  "house",
  "villa",
  "land",
  "commercial",
  "townhouse",
  "condominium",
  "office",
  "retail",
  "industrial",
];

const AMENITIES = [
  "garden",
  "parking",
  "balcony",
  "elevator",
  "security",
  "swimming_pool",
  "gym",
  "storage",
  "furnished",
  "air_conditioning",
];

function DashboardContent() {
  const router = useRouter();
  const { user, logout, refreshProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<string>("overview");

  useEffect(() => {
    if (user?.role === "agent" && user?.status !== "approved") {
      setActiveTab("verification");
    }
  }, [user?.role, user?.status]);
  const [formFeedback, setFormFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileSynced, setProfileSynced] = useState(false);

  // Buyer State
  const [buyerProfile, setBuyerProfile] = useState<BuyerProfile>({
    phoneNumber: "",
    preferredContactMethod: "whatsapp",
  });
  const [buyerPrefs, setBuyerPrefs] = useState<BuyerPreferencesInput>({
    budget_min: 150000,
    budget_max: 600000,
    property_types: ["apartment", "villa"],
    locations: ["Bole", "Kazanchis"],
    features: ["parking", "security", "elevator"],
    min_size_sqm: 120,
    min_bedrooms: 3,
    payment_preference: "installment",
  });

  // Agent State
  const [agentProfile, setAgentProfile] = useState<AgentProfile>({
    phone_number: "",
    agency_name: "",
    bio: "",
    years_of_experience: 3,
  });

  // Developer State
  const [developerProfile, setDeveloperProfile] = useState<DeveloperProfile>({
    company_name: "",
    company_description: "",
    contact_phone: "",
    business_address: "",
    website_url: "",
  });
  const [developerProjects, setDeveloperProjects] = useState<Project[]>([]);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({
    name: "",
    location: "",
    description: "",
  });

  // Admin State
  const [adminRequests, setAdminRequests] = useState<VerificationSubmission[]>([]);
  const [adminProjects, setAdminProjects] = useState<Project[]>([]);
  const [adminProjectsFilter, setAdminProjectsFilter] = useState<"all" | "active" | "inactive">("all");
  const [adminProjectsPage, setAdminProjectsPage] = useState(1);
  const [adminProjectsTotalPages, setAdminProjectsTotalPages] = useState(1);

  // Executive KPI & Overview Metrics
  const [kpiData, setKpiData] = useState<any>(null);
  const [kpiLoading, setKpiLoading] = useState(false);

  // Verification Form State (FE-005)
  const [verificationForm, setVerificationForm] = useState({
    legalName: "",
    registrationNumber: "",
    businessName: "",
    businessAddress: "",
    contactPhone: "",
    notes: "",
  });
  const [verificationFiles, setVerificationFiles] = useState<FileList | null>(null);
  const [verificationHistory, setVerificationHistory] = useState<VerificationSubmission[]>([]);

  // Dedicated Developer Profile Loader (FE-004 / Dev Roster)
  const loadDeveloperProfile = useCallback(async () => {
    setIsProfileLoading(true);
    try {
      const res = await developerApi.getProfile();
      const prof =
        res.data?.profile ||
        (res.data as any)?.data?.profile ||
        (res.data as any)?.data;
      if (res.ok && prof && typeof prof === "object" && prof.company_name) {
        setDeveloperProfile({
          company_name: prof.company_name || "",
          company_description: prof.company_description || "",
          contact_phone: prof.contact_phone || "",
          business_address: prof.business_address || "",
          website_url: prof.website_url || "",
        });
        setProfileSynced(true);
      } else {
        setProfileSynced(false);
      }
    } catch (err) {
      console.error("Failed to load developer profile:", err);
      setProfileSynced(false);
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  // Dedicated Agent Profile Loader
  const loadAgentProfile = useCallback(async () => {
    setIsProfileLoading(true);
    try {
      const res = await agentApi.getProfile();
      const prof =
        res.data?.profile ||
        (res.data as any)?.data?.profile ||
        (res.data as any)?.data;
      if (res.ok && prof && typeof prof === "object") {
        setAgentProfile((prev) => ({
          ...prev,
          agency_name: prof.agency_name || "",
          phone_number: prof.phone_number || "",
          bio: prof.bio || "",
          years_of_experience: prof.years_of_experience ?? 3,
        }));
        setProfileSynced(true);
      } else {
        setProfileSynced(false);
      }
    } catch (err) {
      console.error("Failed to load agent profile:", err);
      setProfileSynced(false);
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  // Dedicated Buyer Data Loader
  const loadBuyerData = useCallback(async () => {
    setIsProfileLoading(true);
    try {
      const [profRes, prefRes] = await Promise.all([
        buyerApi.getProfile(),
        buyerApi.getPreferences(),
      ]);
      const prof = profRes.data?.profile || (profRes.data as any)?.data;
      if (profRes.ok && prof) {
        setBuyerProfile({
          phoneNumber: prof.phoneNumber || (prof as any).phone_number || "",
          preferredContactMethod:
            prof.preferredContactMethod || (prof as any).preferred_contact_method || "whatsapp",
        });
      }
      const prefs = prefRes.data?.preferences || (prefRes.data as any)?.data;
      if (prefRes.ok && prefs) {
        setBuyerPrefs((prev) => ({ ...prev, ...prefs }));
      }
      if (profRes.ok || prefRes.ok) {
        setProfileSynced(true);
      }
    } catch (err) {
      console.error("Failed to load buyer data:", err);
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  // Real Role-Specific KPI Loader
  const loadKpis = useCallback(async () => {
    if (!user) return;
    setKpiLoading(true);
    try {
      if (user.role === "admin" || user.role === "finance_admin") {
        const res =
          user.role === "finance_admin"
            ? await reportApi.getFinanceAdminReport()
            : await reportApi.getAdminReport();
        if (res.ok && res.data) {
          setKpiData(res.data.report || (res.data as any).data || null);
        }
      } else if (user.role === "agent") {
        const res = await reportApi.getAgentReport();
        if (res.ok && res.data) {
          setKpiData(res.data.report || (res.data as any).data || null);
        }
      } else if (user.role === "developer") {
        const res = await reportApi.getDeveloperReport();
        if (res.ok && res.data) {
          setKpiData(res.data.report || (res.data as any).data || null);
        }
      } else if (user.role === "buyer") {
        const [favRes, tourRes, refRes] = await Promise.all([
          favoriteApi.list().catch(() => ({ ok: false, data: null })),
          referralApi.getBuyerVisits().catch(() => ({ ok: false, data: null })),
          referralApi.getBuyerReferrals().catch(() => ({ ok: false, data: null })),
        ]);
        const favs = favRes.data?.favorites || (favRes.data as any)?.data || [];
        const tours = tourRes.data?.visits || (tourRes.data as any)?.data || [];
        const refs = refRes.data?.referrals || (refRes.data as any)?.data || [];
        setKpiData({
          shortlistCount: favs.length,
          toursCount: tours.length,
          inquiriesCount: refs.length,
        });
      }
    } catch (err) {
      console.error("Could not load KPI data:", err);
    } finally {
      setKpiLoading(false);
    }
  }, [user]);

  // Load Real Data based on the authenticated user's actual role
  useEffect(() => {
    if (!user) return;

    loadKpis();

    if (user.role === "buyer") {
      loadBuyerData();
    } else if (user.role === "agent") {
      loadAgentProfile();
      verificationApi.getMyHistory().then((res) => {
        const hist = res.data?.requests || res.data?.data;
        if (res.ok && hist) setVerificationHistory(hist);
      });
    } else if (user.role === "developer") {
      loadDeveloperProfile();
      developerApi.getProjects().then((res) => {
        const projs =
          res.data?.result?.projects || res.data?.projects || (res.data as any)?.data || [];
        if (res.ok && Array.isArray(projs)) setDeveloperProjects(projs);
      });
      verificationApi.getMyHistory().then((res) => {
        const hist = res.data?.requests || res.data?.data;
        if (res.ok && hist) setVerificationHistory(hist);
      });
    } else if (user.role === "admin" || user.role === "finance_admin") {
      adminApi.getPendingApplications().then((res) => {
        const reqs = res.data?.requests || res.data?.data || [];
        if (res.ok && Array.isArray(reqs)) setAdminRequests(reqs);
      });
      loadAdminProjects(1, adminProjectsFilter);
    }
  }, [user, adminProjectsFilter, loadBuyerData, loadAgentProfile, loadDeveloperProfile, loadKpis]);

  // Redirect to dedicated /profile page if user navigates to the profile tab
  useEffect(() => {
    if (activeTab === "profile") {
      router.push("/profile");
    }
  }, [activeTab, router]);

  const loadAdminProjects = async (page: number, filter: "all" | "active" | "inactive") => {
    const statusParam = filter === "all" ? undefined : filter;
    const res = await adminApi.getAllProjects({ page, limit: 10, status: statusParam });
    if (res.ok && res.data?.projects) {
      setAdminProjects(res.data.projects);
      if (res.data.pagination) {
        setAdminProjectsPage(res.data.pagination.page);
        setAdminProjectsTotalPages(res.data.pagination.totalPages || 1);
      }
    }
  };

  const toggleArrayItem = (arr: string[] | undefined | null, item: string) => {
    const list = arr ? [...arr] : [];
    const index = list.indexOf(item);
    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(item);
    }
    return list;
  };

  // Save Buyer Profile & Preferences
  const handleSaveBuyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormFeedback(null);

    const [profRes, prefRes] = await Promise.all([
      buyerApi.updateProfile({
        phoneNumber: buyerProfile.phoneNumber || undefined,
        preferredContactMethod: buyerProfile.preferredContactMethod || undefined,
      }),
      buyerApi.updatePreferences(buyerPrefs),
    ]);

    setSubmitting(false);
    if (!profRes.ok && !prefRes.ok) {
      setFormFeedback({
        type: "error",
        message: profRes.message || prefRes.message || "Failed to update profile",
      });
    } else {
      if (profRes.ok && profRes.data?.profile) {
        setBuyerProfile(profRes.data.profile);
      }
      if (prefRes.ok && prefRes.data?.preferences) {
        setBuyerPrefs((prev) => ({ ...prev, ...prefRes.data!.preferences }));
      }
      setProfileSynced(true);
      setFormFeedback({
        type: "success",
        message: "Buyer contact profile and property preferences saved successfully!",
      });
    }
  };

  // Save Agent Profile
  const handleSaveAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormFeedback(null);

    const res = await agentApi.updateProfile({
      phone_number: agentProfile.phone_number || undefined,
      agency_name: agentProfile.agency_name || undefined,
      bio: agentProfile.bio || undefined,
      years_of_experience: Number(agentProfile.years_of_experience) || undefined,
    });

    setSubmitting(false);
    if (!res.ok) {
      setFormFeedback({ type: "error", message: res.message || "Failed to update agent credentials" });
    } else {
      const saved = res.data?.profile || (res.data as any)?.data;
      if (saved) {
        setAgentProfile((prev) => ({ ...prev, ...saved }));
        setProfileSynced(true);
      }
      setFormFeedback({ type: "success", message: "Agent credentials updated successfully!" });
    }
  };

  // Save Developer Profile
  const handleSaveDeveloper = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormFeedback(null);

    const res = await developerApi.updateProfile({
      company_name: developerProfile.company_name.trim(),
      company_description: developerProfile.company_description?.trim() || undefined,
      contact_phone: developerProfile.contact_phone.trim(),
      business_address: developerProfile.business_address.trim(),
      website_url: developerProfile.website_url?.trim() || undefined,
    });

    setSubmitting(false);
    if (!res.ok) {
      setFormFeedback({
        type: "error",
        message: res.message || "Failed to update developer profile",
      });
    } else {
      const prof =
        res.data?.profile ||
        (res.data as any)?.data?.profile ||
        (res.data as any)?.data;
      if (prof && typeof prof === "object") {
        setDeveloperProfile({
          company_name: prof.company_name || developerProfile.company_name,
          company_description: prof.company_description ?? developerProfile.company_description,
          contact_phone: prof.contact_phone || developerProfile.contact_phone,
          business_address: prof.business_address || developerProfile.business_address,
          website_url: prof.website_url ?? developerProfile.website_url,
        });
        setProfileSynced(true);
      }
      setFormFeedback({
        type: "success",
        message: "Developer corporate profile updated successfully!",
      });
    }
  };

  // Create Project (Developer)
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectForm.name.trim() || !newProjectForm.location.trim()) {
      setFormFeedback({ type: "error", message: "Project name and location are required." });
      return;
    }

    setSubmitting(true);
    setFormFeedback(null);

    const res = await developerApi.createProject({
      name: newProjectForm.name.trim(),
      location: newProjectForm.location.trim(),
      description: newProjectForm.description.trim() || undefined,
    });

    setSubmitting(false);
    if (!res.ok) {
      setFormFeedback({ type: "error", message: res.message || "Failed to create project." });
    } else {
      setFormFeedback({
        type: "success",
        message: `Project "${newProjectForm.name}" created successfully!`,
      });
      setIsCreateProjectModalOpen(false);
      setNewProjectForm({ name: "", location: "", description: "" });
      // Refresh list
      const projRes = await developerApi.getProjects();
      const projs =
        projRes.data?.result?.projects || projRes.data?.projects || (projRes.data as any)?.data || [];
      if (Array.isArray(projs)) setDeveloperProjects(projs);
    }
  };

  // Toggle Project Status (Developer)
  const handleToggleProjectStatus = async (projectId: string, currentStatus: "active" | "inactive") => {
    const nextStatus = currentStatus === "active" ? "inactive" : "active";
    const res = await developerApi.updateProjectStatus(projectId, { status: nextStatus });
    if (res.ok) {
      setDeveloperProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, status: nextStatus } : p))
      );
      setFormFeedback({
        type: "success",
        message: `Project status updated to ${nextStatus}.`,
      });
    } else {
      setFormFeedback({
        type: "error",
        message: res.message || "Failed to toggle project status.",
      });
    }
  };

  // Submit Account Verification (FE-005)
  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormFeedback(null);

    const formData = new FormData();
    formData.append("legalName", verificationForm.legalName);
    formData.append("registrationNumber", verificationForm.registrationNumber);
    if (verificationForm.businessName)
      formData.append("businessName", verificationForm.businessName);
    formData.append("businessAddress", verificationForm.businessAddress);
    formData.append("contactPhone", verificationForm.contactPhone);
    if (verificationForm.notes) formData.append("notes", verificationForm.notes);

    if (verificationFiles) {
      for (let i = 0; i < Math.min(verificationFiles.length, 3); i++) {
        const file = verificationFiles[i];
        if (file) {
          formData.append("documents", file);
        }
      }
    }

    const res = await verificationApi.submit(formData);
    setSubmitting(false);

    if (!res.ok) {
      setFormFeedback({
        type: "error",
        message: res.message || "Verification submission failed",
      });
    } else {
      setFormFeedback({
        type: "success",
        message: "Verification application submitted! Our compliance team will audit your documents.",
      });
      verificationApi.getMyHistory().then((h) => {
        const hist = h.data?.requests || h.data?.data;
        if (hist) setVerificationHistory(hist);
      });
    }
  };

  const role = user?.role || "buyer";
  const status = user?.status || "pending";

  return (
    <div className={styles.dashWrapper}>
      {/* Top Header */}
      <header className={styles.dashHeader}>
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

        <div className={styles.userNavRight}>
          <Link href="/profile" className={styles.userInfoBadge} title="Account Profile">
            <div className={styles.userAvatar}>
              {user?.fullName
                ? user.fullName
                    .split(" ")
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : "U"}
            </div>
            <div className={styles.userTextWrap}>
              <span className={styles.userName}>{user?.fullName || "My Account"}</span>
              <div className={styles.userRoleStatus} style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                <span className={styles.roleTag}>{role.replace("_", " ")}</span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    padding: "2px 8px",
                    borderRadius: 3,
                    backgroundColor:
                      status === "approved"
                        ? "#d1fae5"
                        : status === "rejected"
                        ? "#fee2e2"
                        : "#fef3c7",
                    color:
                      status === "approved"
                        ? "#065f46"
                        : status === "rejected"
                        ? "#991b1b"
                        : "#92400e",
                  }}
                >
                  {status}
                </span>
              </div>
            </div>
          </Link>

          <Link
            href="/properties"
            className={styles.tabBtn}
            style={{ fontSize: "0.82rem", textDecoration: "none", padding: "8px 12px", border: "1px solid #000" }}
          >
            Catalog
          </Link>

          <NotificationDrawer />

          <button type="button" className={styles.logoutBtn} onClick={() => logout()}>
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.dashMain}>
        {/* Account Status Notice (shown only when action is needed or under review) */}
        {status !== "approved" && !(role === "agent" && verificationHistory.length === 0) && (
          <section
            className={`${styles.statusBanner} ${
              status === "rejected"
                ? styles.statusBannerRejected
                : status === "suspended"
                ? styles.statusBannerSuspended
                : styles.statusBannerPending
            }`}
          >
            <div className={styles.statusBannerContent}>
              <div className={styles.statusBannerIcon}>
                {status === "rejected" ? (
                  <ShieldAlert size={28} color="#ef4444" />
                ) : status === "suspended" ? (
                  <Ban size={28} color="#111827" />
                ) : (
                  <Clock size={28} color="#f59e0b" />
                )}
              </div>
              <div>
                <h2 className={styles.statusBannerTitle}>
                  {status === "rejected"
                    ? "Verification Requires Attention"
                    : status === "suspended"
                    ? "Account Temporarily Suspended"
                    : "Account Under Review"}
                </h2>
                <p className={styles.statusBannerDesc}>
                  {status === "rejected"
                    ? "Your submitted verification documents require updates. Please review the reviewer remarks and upload updated credentials."
                    : status === "suspended"
                    ? "Your account access has been paused pending compliance review. Please contact support."
                    : "Your account registration has been submitted and is currently being reviewed by our administration team. Typical review time is 24 hours."}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* FE-006: Role-Based Tab Navigation */}
        <nav className={styles.tabNav}>
          {role === "agent" && status !== "approved" ? (
            <button
              type="button"
              className={`${styles.tabBtn} ${styles.tabBtnActive}`}
              onClick={() => setActiveTab("verification")}
            >
              Account Verification
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "overview" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("overview")}
              >
                Overview
              </button>

              {role === "buyer" && (
                <>
                  <button
                    type="button"
                    className={`${styles.tabBtn} ${activeTab === "favorites" ? styles.tabBtnActive : ""}`}
                    onClick={() => setActiveTab("favorites")}
                  >
                    Shortlist
                  </button>
                  <button
                    type="button"
                    className={`${styles.tabBtn} ${activeTab === "tours" ? styles.tabBtnActive : ""}`}
                    onClick={() => setActiveTab("tours")}
                  >
                    Tours & Visits
                  </button>
                  <button
                    type="button"
                    className={`${styles.tabBtn} ${activeTab === "inquiries" ? styles.tabBtnActive : ""}`}
                    onClick={() => setActiveTab("inquiries")}
                  >
                    Inquiries & Chat
                  </button>
                  <button
                    type="button"
                    className={`${styles.tabBtn} ${activeTab === "recommendations" ? styles.tabBtnActive : ""}`}
                    onClick={() => setActiveTab("recommendations")}
                  >
                    Recommendations
                  </button>
                </>
              )}

              {role === "agent" && (
                <>
                  <button
                    type="button"
                    className={`${styles.tabBtn} ${activeTab === "inventory" ? styles.tabBtnActive : ""}`}
                    onClick={() => setActiveTab("inventory")}
                  >
                    Listings
                  </button>
                  <button
                    type="button"
                    className={`${styles.tabBtn} ${activeTab === "authorizations" ? styles.tabBtnActive : ""}`}
                    onClick={() => setActiveTab("authorizations")}
                  >
                    Authorizations
                  </button>
                  <button
                    type="button"
                    className={`${styles.tabBtn} ${activeTab === "leads" ? styles.tabBtnActive : ""}`}
                    onClick={() => setActiveTab("leads")}
                  >
                    Leads Pipeline
                  </button>
                  <button
                    type="button"
                    className={`${styles.tabBtn} ${activeTab === "visits" ? styles.tabBtnActive : ""}`}
                    onClick={() => setActiveTab("visits")}
                  >
                    Visits & Tours
                  </button>
                  <button
                    type="button"
                    className={`${styles.tabBtn} ${activeTab === "transactions" ? styles.tabBtnActive : ""}`}
                    onClick={() => setActiveTab("transactions")}
                  >
                    Closings & Deals
                  </button>
                  <button
                    type="button"
                    className={`${styles.tabBtn} ${activeTab === "commissions" ? styles.tabBtnActive : ""}`}
                    onClick={() => setActiveTab("commissions")}
                  >
                    Commissions
                  </button>
                  <button
                    type="button"
                    className={`${styles.tabBtn} ${activeTab === "analytics" ? styles.tabBtnActive : ""}`}
                    onClick={() => setActiveTab("analytics")}
                  >
                    Performance
                  </button>
                </>
              )}

          {role === "developer" && (
            <>
              <button
                type="button"
                className={`${styles.tabBtn} ${
                  activeTab === "developments" ? styles.tabBtnActive : ""
                }`}
                onClick={() => setActiveTab("developments")}
              >
                Projects
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "inventory" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("inventory")}
              >
                Listings
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "authorizations" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("authorizations")}
              >
                Authorizations
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "leads" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("leads")}
              >
                Buyer Inquiries
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "visits" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("visits")}
              >
                Property Tours
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "transactions" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("transactions")}
              >
                Deals & Sales
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "commissions" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("commissions")}
              >
                Commissions
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "analytics" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("analytics")}
              >
                Performance
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${
                  activeTab === "verification" ? styles.tabBtnActive : ""
                }`}
                onClick={() => setActiveTab("verification")}
              >
                Account Verification
              </button>
            </>
          )}

          {(role === "admin" || role === "finance_admin") && (
            <>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "admin-properties" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("admin-properties")}
              >
                Pending Listings
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "admin-referrals" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("admin-referrals")}
              >
                Buyer Inquiries
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "admin-transactions" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("admin-transactions")}
              >
                Deals & Sales
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "admin-commissions" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("admin-commissions")}
              >
                Commissions
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "admin-users" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("admin-users")}
              >
                Users
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "admin-taxonomy" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("admin-taxonomy")}
              >
                Categories & Locations
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "admin-audit" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("admin-audit")}
              >
                Activity Logs
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "admin-reports" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("admin-reports")}
              >
                Reports
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${
                  activeTab === "admin-projects" ? styles.tabBtnActive : ""
                }`}
                onClick={() => {
                  setActiveTab("admin-projects");
                  loadAdminProjects(1, adminProjectsFilter);
                }}
              >
                Projects
              </button>
            </>
          )}
            </>
          )}
        </nav>

        {/* Global Feedback Alert */}
        {formFeedback && (
          <div
            className={`${styles.alertBox} ${
              formFeedback.type === "success" ? styles.alertSuccess : styles.alertError
            }`}
          >
            {formFeedback.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>{formFeedback.message}</span>
          </div>
        )}

        {/* TAB 1: OVERVIEW - EXECUTIVE KPIS & QUICK ACTIONS */}
        {activeTab === "overview" && (
          <div className={styles.cardBox}>
            <div className={styles.cardHeader}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 16,
                }}
              >
                <div>
                  <span className={styles.cardPretitle}>Dashboard Overview</span>
                  <h3 className={styles.cardTitle}>Welcome back, {user?.fullName}</h3>
                  <p className={styles.cardDesc}>
                    {role === "admin" || role === "finance_admin"
                      ? "Platform overview, listing reviews, users, and sales."
                      : role === "agent"
                      ? "Your property listings, buyer inquiries, and commissions."
                      : role === "developer"
                      ? "Your developments, listed units, and sales performance."
                      : "Your saved properties, scheduled visits, and inquiries."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadKpis}
                  disabled={kpiLoading}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    background: "#ffffff",
                    border: "1px solid #000000",
                    color: "#000000",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    cursor: kpiLoading ? "not-allowed" : "pointer",
                  }}
                >
                  <RefreshCw
                    size={13}
                    style={{
                      animation: kpiLoading ? "spin 1s linear infinite" : "none",
                    }}
                  />
                  <span>{kpiLoading ? "Updating..." : "Refresh Metrics"}</span>
                </button>
              </div>
            </div>

            {/* Role-Specific KPI Cards Grid */}
            <div className={styles.kpiGrid}>
              {role === "admin" && (
                <>
                  <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Total Properties</span>
                    <span className={styles.kpiValue}>
                      {kpiData?.properties?.total ?? kpiData?.total_properties ?? 0}
                    </span>
                    <span className={styles.kpiSubtext}>
                      {kpiData?.properties?.byStatus?.approved ?? 0} approved active
                    </span>
                  </div>

                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer", borderLeft: "4px solid #f59e0b" }}
                    onClick={() => setActiveTab("admin-properties")}
                  >
                    <span className={styles.kpiLabel}>Pending Review Queue</span>
                    <span className={styles.kpiValue} style={{ color: "#d97706" }}>
                      {kpiData?.properties?.byStatus?.pending ?? kpiData?.pending_properties ?? 0}
                    </span>
                    <span className={styles.kpiSubtext} style={{ color: "#d97706", fontWeight: 700 }}>
                      Listings awaiting audit → Click to review
                    </span>
                  </div>

                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("admin-users")}
                  >
                    <span className={styles.kpiLabel}>Platform Users</span>
                    <span className={styles.kpiValue}>
                      {kpiData?.users?.total ?? kpiData?.total_users ?? 0}
                    </span>
                    <span className={styles.kpiSubtext}>Registered accounts</span>
                  </div>

                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("admin-referrals")}
                  >
                    <span className={styles.kpiLabel}>Client Referrals</span>
                    <span className={styles.kpiValue}>
                      {kpiData?.referrals?.total ?? 0}
                    </span>
                    <span className={styles.kpiSubtext}>Referral inquiry pipeline</span>
                  </div>

                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("admin-transactions")}
                  >
                    <span className={styles.kpiLabel}>Verified Transactions</span>
                    <span className={styles.kpiValue}>
                      {kpiData?.sales?.totalSalesCount ?? 0}
                    </span>
                    <span className={styles.kpiSubtext}>
                      ${Number(kpiData?.sales?.totalSalesValue ?? kpiData?.total_gmv ?? 0).toLocaleString()} volume
                    </span>
                  </div>

                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("admin-commissions")}
                  >
                    <span className={styles.kpiLabel}>Total Commission</span>
                    <span className={styles.kpiValue}>
                      ${Number(kpiData?.commissions?.totalCommission ?? 0).toLocaleString()}
                    </span>
                    <span className={styles.kpiSubtext}>
                      ${Number(kpiData?.commissions?.outstandingAmount ?? 0).toLocaleString()} outstanding
                    </span>
                  </div>
                </>
              )}

              {role === "finance_admin" && (
                <>
                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("admin-transactions")}
                  >
                    <span className={styles.kpiLabel}>Verified Transactions</span>
                    <span className={styles.kpiValue}>
                      {kpiData?.sales?.totalSalesCount ?? 0}
                    </span>
                    <span className={styles.kpiSubtext}>
                      ${Number(kpiData?.sales?.totalSalesValue ?? 0).toLocaleString()} sales volume
                    </span>
                  </div>

                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("admin-commissions")}
                  >
                    <span className={styles.kpiLabel}>Total Commissions</span>
                    <span className={styles.kpiValue}>
                      ${Number(kpiData?.commissions?.totalCommission ?? kpiData?.total_commissions_earned ?? 0).toLocaleString()}
                    </span>
                    <span className={styles.kpiSubtext}>Cumulative volume fees</span>
                  </div>

                  <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Paid to Brokers</span>
                    <span className={styles.kpiValue}>
                      ${Number(kpiData?.commissions?.amountPaid ?? kpiData?.paid_commissions ?? 0).toLocaleString()}
                    </span>
                    <span className={styles.kpiSubtext}>Disbursed settlement earnings</span>
                  </div>

                  <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Outstanding Balance</span>
                    <span className={styles.kpiValue} style={{ color: "#d97706" }}>
                      ${Number(kpiData?.commissions?.outstandingAmount ?? kpiData?.pending_payouts ?? 0).toLocaleString()}
                    </span>
                    <span className={styles.kpiSubtext}>Awaiting release</span>
                  </div>
                </>
              )}

              {role === "agent" && (
                <>
                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("inventory")}
                  >
                    <span className={styles.kpiLabel}>My Listings</span>
                    <span className={styles.kpiValue}>
                      {kpiData?.properties?.total ?? kpiData?.active_listings ?? 0}
                    </span>
                    <span className={styles.kpiSubtext}>
                      {kpiData?.properties?.byStatus?.approved ?? 0} approved active
                    </span>
                  </div>

                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("authorizations")}
                  >
                    <span className={styles.kpiLabel}>Authorized Properties</span>
                    <span className={styles.kpiValue}>
                      {kpiData?.authorizedProperties?.total ?? 0}
                    </span>
                    <span className={styles.kpiSubtext}>Developer representations</span>
                  </div>

                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("leads")}
                  >
                    <span className={styles.kpiLabel}>Leads Pipeline</span>
                    <span className={styles.kpiValue}>
                      {kpiData?.referrals?.total ?? kpiData?.total_referrals ?? 0}
                    </span>
                    <span className={styles.kpiSubtext}>Client referral requests</span>
                  </div>

                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("transactions")}
                  >
                    <span className={styles.kpiLabel}>Closed Sales</span>
                    <span className={styles.kpiValue}>
                      {kpiData?.sales?.totalSalesCount ?? kpiData?.closed_deals ?? 0}
                    </span>
                    <span className={styles.kpiSubtext}>
                      ${Number(kpiData?.sales?.totalSalesValue ?? 0).toLocaleString()} volume
                    </span>
                  </div>

                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("commissions")}
                  >
                    <span className={styles.kpiLabel}>Commissions Earned</span>
                    <span className={styles.kpiValue}>
                      ${Number(kpiData?.commissions?.totalCommission ?? kpiData?.total_commission ?? 0).toLocaleString()}
                    </span>
                    <span className={styles.kpiSubtext}>Earned earnings</span>
                  </div>
                </>
              )}

              {role === "developer" && (
                <>
                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("developments")}
                  >
                    <span className={styles.kpiLabel}>Registered Projects</span>
                    <span className={styles.kpiValue}>
                      {kpiData?.totalProjects ?? kpiData?.active_projects ?? developerProjects.length}
                    </span>
                    <span className={styles.kpiSubtext}>Active developments</span>
                  </div>

                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("inventory")}
                  >
                    <span className={styles.kpiLabel}>Total Units</span>
                    <span className={styles.kpiValue}>
                      {kpiData?.totalProperties ?? kpiData?.total_properties ?? 0}
                    </span>
                    <span className={styles.kpiSubtext}>Residential and commercial</span>
                  </div>

                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("authorizations")}
                  >
                    <span className={styles.kpiLabel}>Authorized Brokers</span>
                    <span className={styles.kpiValue}>
                      {kpiData?.authorizedAgents ?? kpiData?.authorized_agents ?? 0}
                    </span>
                    <span className={styles.kpiSubtext}>Active sales partners</span>
                  </div>

                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("leads")}
                  >
                    <span className={styles.kpiLabel}>Buyer Inquiries</span>
                    <span className={styles.kpiValue}>
                      {kpiData?.referrals?.total ?? kpiData?.total_inquiries ?? 0}
                    </span>
                    <span className={styles.kpiSubtext}>Direct buyer leads</span>
                  </div>
                </>
              )}

              {role === "buyer" && (
                <>
                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("favorites")}
                  >
                    <span className={styles.kpiLabel}>Saved Shortlist</span>
                    <span className={styles.kpiValue}>{kpiData?.shortlistCount ?? 0}</span>
                    <span className={styles.kpiSubtext}>Properties saved to shortlist</span>
                  </div>

                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("tours")}
                  >
                    <span className={styles.kpiLabel}>Tours & Visits</span>
                    <span className={styles.kpiValue}>{kpiData?.toursCount ?? 0}</span>
                    <span className={styles.kpiSubtext}>Scheduled property viewings</span>
                  </div>

                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("inquiries")}
                  >
                    <span className={styles.kpiLabel}>Inquiries & Conversations</span>
                    <span className={styles.kpiValue}>{kpiData?.inquiriesCount ?? 0}</span>
                    <span className={styles.kpiSubtext}>Active requests with advisors</span>
                  </div>

                  <div
                    className={styles.kpiCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTab("recommendations")}
                  >
                    <span className={styles.kpiLabel}>Recommendations</span>
                    <span className={styles.kpiValue}>Active</span>
                    <span className={styles.kpiSubtext}>Matched to your preferences</span>
                  </div>
                </>
              )}
            </div>

            {/* Quick Actions Navigation Row */}
            <div
              style={{
                marginTop: 28,
                paddingTop: 20,
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#6b7280",
                }}
              >
                Quick Navigation
              </span>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 12,
                }}
              >
                {(role === "admin" || role === "finance_admin") && (
                  <>
                    <button
                      type="button"
                      className={styles.quickActionBtn}
                      onClick={() => setActiveTab("admin-properties")}
                    >
                      <FileCheck size={14} />
                      <span>Review Pending Listings</span>
                    </button>
                    <button
                      type="button"
                      className={styles.quickActionBtn}
                      onClick={() => setActiveTab("admin-users")}
                    >
                      <User size={14} />
                      <span>Manage Users</span>
                    </button>
                    <button
                      type="button"
                      className={styles.quickActionBtn}
                      onClick={() => {
                        setActiveTab("admin-projects");
                        loadAdminProjects(1, adminProjectsFilter);
                      }}
                    >
                      <Building2 size={14} />
                      <span>Projects Directory</span>
                    </button>
                    <button
                      type="button"
                      className={styles.quickActionBtn}
                      onClick={() => setActiveTab("admin-reports")}
                    >
                      <Sliders size={14} />
                      <span>Reports</span>
                    </button>
                  </>
                )}

                {role === "agent" && (
                  <>
                    <button
                      type="button"
                      className={styles.quickActionBtn}
                      onClick={() => setActiveTab("inventory")}
                    >
                      <Plus size={14} />
                      <span>View Listings</span>
                    </button>
                    <button
                      type="button"
                      className={styles.quickActionBtn}
                      onClick={() => setActiveTab("leads")}
                    >
                      <Send size={14} />
                      <span>Buyer Inquiries</span>
                    </button>
                    <button
                      type="button"
                      className={styles.quickActionBtn}
                      onClick={() => setActiveTab("visits")}
                    >
                      <Calendar size={14} />
                      <span>Property Tours</span>
                    </button>
                  </>
                )}

                {role === "developer" && (
                  <>
                    <button
                      type="button"
                      className={styles.quickActionBtn}
                      onClick={() => setActiveTab("developments")}
                    >
                      <Building2 size={14} />
                      <span>Manage Developments</span>
                    </button>
                    <button
                      type="button"
                      className={styles.quickActionBtn}
                      onClick={() => setActiveTab("inventory")}
                    >
                      <Plus size={14} />
                      <span>Properties</span>
                    </button>
                    <button
                      type="button"
                      className={styles.quickActionBtn}
                      onClick={() => setActiveTab("authorizations")}
                    >
                      <FileCheck size={14} />
                      <span>Agent Permissions</span>
                    </button>
                  </>
                )}

                {role === "buyer" && (
                  <>
                    <Link
                      href="/properties"
                      className={styles.quickActionBtn}
                      style={{ textDecoration: "none" }}
                    >
                      <Building2 size={14} />
                      <span>Browse Available Properties</span>
                    </Link>
                    <button
                      type="button"
                      className={styles.quickActionBtn}
                      onClick={() => setActiveTab("favorites")}
                    >
                      <FileCheck size={14} />
                      <span>View Shortlist</span>
                    </button>
                    <button
                      type="button"
                      className={styles.quickActionBtn}
                      onClick={() => setActiveTab("tours")}
                    >
                      <Calendar size={14} />
                      <span>My Visits & Tours</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BUYER WORKSTATION TABS */}
        {role === "buyer" &&
          ["favorites", "tours", "inquiries", "recommendations"].includes(activeTab) && (
            <BuyerWorkstation activeTab={activeTab as any} />
          )}

        {/* AGENT & DEVELOPER WORKSTATION TABS */}
        {(role === "agent" || role === "developer") &&
          [
            "inventory",
            "authorizations",
            "leads",
            "visits",
            "transactions",
            "commissions",
            "analytics",
          ].includes(activeTab) && (
            <AgentDeveloperWorkstation role={role} activeTab={activeTab as any} />
          )}

        {/* ADMIN & FINANCE ADMIN WORKSTATION TABS */}
        {(role === "admin" || role === "finance_admin") &&
          [
            "admin-properties",
            "admin-referrals",
            "admin-transactions",
            "admin-commissions",
            "admin-users",
            "admin-taxonomy",
            "admin-audit",
            "admin-reports",
          ].includes(activeTab) && (
            <AdminWorkstation role={role} activeTab={activeTab as any} />
          )}

        {/* TAB: DEVELOPER PROJECTS (Task 3) */}
        {role === "developer" && activeTab === "developments" && (
          <div className={styles.cardBox}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 24,
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <div>
                <span className={styles.cardPretitle}>Portfolio</span>
                <h3 className={styles.cardTitle}>Residential Developments</h3>
                <p className={styles.cardDesc}>
                  Create, publish, and toggle active status for your high-rise and luxury projects.
                </p>
              </div>

              <button
                type="button"
                className={styles.submitBtn}
                style={{ padding: "10px 20px" }}
                onClick={() => setIsCreateProjectModalOpen(true)}
              >
                <Plus size={16} />
                <span>New Project</span>
              </button>
            </div>

            {developerProjects.length === 0 ? (
              <div
                style={{
                  padding: "48px 24px",
                  textAlign: "center",
                  backgroundColor: "#f9fafb",
                  border: "1px dashed #cbd5e1",
                }}
              >
                <Building2 size={36} color="#9ca3af" style={{ margin: "0 auto 12px" }} />
                <h4 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>
                  No Developments Registered Yet
                </h4>
                <p style={{ fontSize: "0.85rem", color: "#6a717e", margin: "6px 0 16px" }}>
                  Start by registering your first building development project.
                </p>
                <button
                  type="button"
                  className={styles.actionBtnSmall}
                  onClick={() => setIsCreateProjectModalOpen(true)}
                >
                  + Create First Project
                </button>
              </div>
            ) : (
              <div className={styles.projectGrid}>
                {developerProjects.map((proj) => (
                  <div key={proj.id} className={styles.projectCard}>
                    <div>
                      <div className={styles.projectCardHeader}>
                        <h4 className={styles.projectName}>{proj.name}</h4>
                        <span
                          className={`${styles.projectStatusPill} ${
                            proj.status === "active" ? styles.statusActive : styles.statusInactive
                          }`}
                        >
                          {proj.status}
                        </span>
                      </div>

                      <div className={styles.projectLocation}>
                        <MapPin size={13} />
                        <span>{proj.location}</span>
                      </div>

                      <p className={styles.projectDesc}>
                        {proj.description || "No project description provided."}
                      </p>
                    </div>

                    <div className={styles.projectCardFooter}>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "#9ca3af",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Calendar size={12} />
                        {new Date(proj.created_at).toLocaleDateString()}
                      </span>

                      <button
                        type="button"
                        className={styles.actionBtnSmall}
                        onClick={() => handleToggleProjectStatus(proj.id, proj.status)}
                      >
                        {proj.status === "active" ? "Set Inactive" : "Set Active"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: ADMIN PROJECTS DIRECTORY (Task 4) */}
        {(role === "admin" || role === "finance_admin") && activeTab === "admin-projects" && (
          <div className={styles.cardBox}>
            <div className={styles.cardHeader}>
              <span className={styles.cardPretitle}>Master Directory</span>
              <h3 className={styles.cardTitle}>Platform Project Catalog</h3>
              <p className={styles.cardDesc}>
                Overview of all development projects registered across developers in Addis Ababa.
              </p>
            </div>

            <div className={styles.adminControlsRow}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Filter size={16} color="#6a717e" />
                <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>Filter Status:</span>
                <select
                  className={styles.filterSelect}
                  value={adminProjectsFilter}
                  onChange={(e) => {
                    const newFilter = e.target.value as any;
                    setAdminProjectsFilter(newFilter);
                    loadAdminProjects(1, newFilter);
                  }}
                >
                  <option value="all">All Projects</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>

              <span style={{ fontSize: "0.85rem", color: "#6a717e" }}>
                Page {adminProjectsPage} of {adminProjectsTotalPages}
              </span>
            </div>

            {adminProjects.length === 0 ? (
              <p style={{ color: "#6a717e" }}>No projects found under this filter.</p>
            ) : (
              <table className={styles.historyTable}>
                <thead>
                  <tr>
                    <th>Project Name</th>
                    <th>Location</th>
                    <th>Developer ID</th>
                    <th>Created</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {adminProjects.map((proj) => (
                    <tr key={proj.id}>
                      <td style={{ fontWeight: 800 }}>{proj.name}</td>
                      <td>{proj.location}</td>
                      <td style={{ fontSize: "0.75rem", fontFamily: "monospace" }}>
                        {proj.developer_id.slice(0, 8)}...
                      </td>
                      <td>{new Date(proj.created_at).toLocaleDateString()}</td>
                      <td>
                        <span
                          className={`${styles.projectStatusPill} ${
                            proj.status === "active" ? styles.statusActive : styles.statusInactive
                          }`}
                        >
                          {proj.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className={styles.paginationRow}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={adminProjectsPage <= 1}
                onClick={() => loadAdminProjects(adminProjectsPage - 1, adminProjectsFilter)}
              >
                ← Previous Page
              </button>

              <button
                type="button"
                className={styles.pageBtn}
                disabled={adminProjectsPage >= adminProjectsTotalPages}
                onClick={() => loadAdminProjects(adminProjectsPage + 1, adminProjectsFilter)}
              >
                Next Page →
              </button>
            </div>
          </div>
        )}

        {/* TAB: ACCOUNT VERIFICATION SUBMISSION (FE-005) */}
        {(role === "agent" || role === "developer") && activeTab === "verification" && (
          <div className={styles.cardBox}>
            <div className={styles.cardHeader}>
              <span className={styles.cardPretitle}>Account Compliance</span>
              <h3 className={styles.cardTitle}>Account Verification Application</h3>
              <p className={styles.cardDesc}>
                Submit government-issued trade licenses, tax identification, and business registration for audit.
              </p>
            </div>

            <form onSubmit={handleVerificationSubmit}>
              <div className={styles.formGrid2}>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Legal Entity Name</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={150}
                    placeholder="Registered business name"
                    className={styles.formInput}
                    value={verificationForm.legalName}
                    onChange={(e) =>
                      setVerificationForm({ ...verificationForm, legalName: e.target.value })
                    }
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Registration / License Number</label>
                  <input
                    type="text"
                    required
                    minLength={1}
                    maxLength={100}
                    placeholder="e.g. MOTI/AA/2026/0894"
                    className={styles.formInput}
                    value={verificationForm.registrationNumber}
                    onChange={(e) =>
                      setVerificationForm({
                        ...verificationForm,
                        registrationNumber: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className={styles.formGrid2}>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Business Headquarters Address</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={300}
                    placeholder="Building, Street, Sub-City"
                    className={styles.formInput}
                    value={verificationForm.businessAddress}
                    onChange={(e) =>
                      setVerificationForm({
                        ...verificationForm,
                        businessAddress: e.target.value,
                      })
                    }
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Direct Official Phone</label>
                  <input
                    type="text"
                    required
                    minLength={5}
                    maxLength={30}
                    placeholder="+251 11... / +251 9..."
                    className={styles.formInput}
                    value={verificationForm.contactPhone}
                    onChange={(e) =>
                      setVerificationForm({ ...verificationForm, contactPhone: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Compliance Notes / Registry References</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="Include notary registry numbers, renewal dates, or chamber of commerce certificates..."
                  value={verificationForm.notes}
                  onChange={(e) =>
                    setVerificationForm({ ...verificationForm, notes: e.target.value })
                  }
                />
              </div>

              {/* Upload Document Box */}
              <div className={styles.formField}>
                <label className={styles.formLabel}>
                  Upload Trade License / Certificate (Max 3 files: PDF, JPEG, PNG)
                </label>
                <label className={styles.fileUploadArea}>
                  <Upload size={32} color="#6a717e" style={{ margin: "0 auto 8px" }} />
                  <p style={{ fontWeight: 700, fontSize: "0.92rem", margin: "4px 0" }}>
                    {verificationFiles && verificationFiles.length > 0
                      ? `${verificationFiles.length} file(s) selected`
                      : "Drag & drop files or click to browse local filesystem"}
                  </p>
                  <span style={{ fontSize: "0.78rem", color: "#8c95a6" }}>
                    Files up to 10MB each. Secured and encrypted per Ethiopian Data Protection Standards.
                  </span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,image/jpeg,image/png"
                    style={{ display: "none" }}
                    onChange={(e) => setVerificationFiles(e.target.files)}
                  />
                </label>
              </div>

              <button type="submit" className={styles.submitBtn} disabled={submitting}>
                <span>{submitting ? "Transmitting..." : "Submit Verification Application"}</span>
                <Send size={16} />
              </button>
            </form>

            {/* Submission History Table */}
            {verificationHistory.length > 0 && (
              <div style={{ marginTop: 40, borderTop: "1px solid #edf0f4", paddingTop: 24 }}>
                <h4 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 12 }}>
                  Application Submission History
                </h4>
                <table className={styles.historyTable}>
                  <thead>
                    <tr>
                      <th>Entity Name</th>
                      <th>License Number</th>
                      <th>Submitted Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verificationHistory.map((item) => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 700 }}>{item.legalName}</td>
                        <td>{item.registrationNumber}</td>
                        <td>
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Recent"}
                        </td>
                        <td>
                          <span
                            className={`${styles.statusPill} ${
                              item.status === "approved"
                                ? styles.statusApproved
                                : item.status === "rejected"
                                ? styles.statusRejected
                                : styles.statusPending
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: ADMIN DECISION PORTAL */}
        {(role === "admin" || role === "finance_admin") && activeTab === "admin" && (
          <div className={styles.cardBox}>
            <div className={styles.cardHeader}>
              <span className={styles.cardPretitle}>Administrator Console</span>
              <h3 className={styles.cardTitle}>Pending Verification Applications</h3>
              <p className={styles.cardDesc}>
                Review submissions and approve or reject broker/developer accounts.
              </p>
            </div>

            {adminRequests.length === 0 ? (
              <p style={{ color: "#6a717e" }}>No pending verification requests at this time.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {adminRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      border: "1px solid #e2e6ec",
                      padding: 24,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <h4 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>
                        {req.legalName}
                      </h4>
                      <p style={{ fontSize: "0.85rem", color: "#6a717e", margin: "4px 0" }}>
                        Reg: {req.registrationNumber} • Phone: {req.contactPhone}
                      </p>
                      <span style={{ fontSize: "0.8rem", color: "#8c95a6" }}>
                        Address: {req.businessAddress}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        style={{
                          padding: "8px 18px",
                          background: "#10b981",
                          color: "#fff",
                          fontWeight: 700,
                          border: "none",
                          cursor: "pointer",
                        }}
                        onClick={async () => {
                          const res = await adminApi.decision(req.id, { decision: "approved" });
                          if (res.ok) {
                            setFormFeedback({
                              type: "success",
                              message: `Application ${req.legalName} approved!`,
                            });
                          } else {
                            setFormFeedback({
                              type: "error",
                              message: res.message || "Failed to approve application.",
                            });
                          }
                          const refreshed = await adminApi.getPendingApplications();
                          const reqs = refreshed.data?.requests || refreshed.data?.data || [];
                          if (Array.isArray(reqs)) setAdminRequests(reqs);
                        }}
                      >
                        Approve
                      </button>

                      <button
                        type="button"
                        style={{
                          padding: "8px 18px",
                          background: "#ef4444",
                          color: "#fff",
                          fontWeight: 700,
                          border: "none",
                          cursor: "pointer",
                        }}
                        onClick={async () => {
                          const reason = window.prompt(
                            "Enter rejection reason for this applicant:",
                            "Documentation insufficient or invalid license number."
                          );
                          if (!reason) return;
                          const res = await adminApi.decision(req.id, {
                            decision: "rejected",
                            rejectionReason: reason,
                          });
                          if (res.ok) {
                            setFormFeedback({
                              type: "success",
                              message: `Application ${req.legalName} rejected.`,
                            });
                          } else {
                            setFormFeedback({
                              type: "error",
                              message: res.message || "Failed to reject application.",
                            });
                          }
                          const refreshed = await adminApi.getPendingApplications();
                          const reqs = refreshed.data?.requests || refreshed.data?.data || [];
                          if (Array.isArray(reqs)) setAdminRequests(reqs);
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* CREATE PROJECT MODAL (Developer Workspace) */}
      {isCreateProjectModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Register New Residential Project</h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setIsCreateProjectModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProject}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Project Name (1-150 characters)</label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  placeholder="e.g. Addis Skyline Residences"
                  className={styles.formInput}
                  value={newProjectForm.name}
                  onChange={(e) =>
                    setNewProjectForm({ ...newProjectForm, name: e.target.value })
                  }
                  disabled={submitting}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Location (1-200 characters)</label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  placeholder="e.g. Bole Olympia, Addis Ababa"
                  className={styles.formInput}
                  value={newProjectForm.location}
                  onChange={(e) =>
                    setNewProjectForm({ ...newProjectForm, location: e.target.value })
                  }
                  disabled={submitting}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Project Description (Optional)</label>
                <textarea
                  maxLength={5000}
                  className={styles.formTextarea}
                  placeholder="Describe building specifications, amenities, and available unit types..."
                  value={newProjectForm.description}
                  onChange={(e) =>
                    setNewProjectForm({ ...newProjectForm, description: e.target.value })
                  }
                  disabled={submitting}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
                <button
                  type="button"
                  style={{
                    padding: "12px 20px",
                    background: "none",
                    border: "1px solid #cbd5e1",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={() => setIsCreateProjectModalOpen(false)}
                >
                  Cancel
                </button>

                <button type="submit" className={styles.submitBtn} disabled={submitting}>
                  <span>{submitting ? "Publishing..." : "Create Project"}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
