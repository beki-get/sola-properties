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
  BuyerProfile,
  BuyerPreferencesInput,
  AgentProfile,
  DeveloperProfile,
  Project,
  VerificationSubmission,
} from "../../lib/api";
import styles from "./dashboard.module.css";

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

  // Load Real Data based on the authenticated user's actual role
  useEffect(() => {
    if (!user) return;

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
  }, [user, adminProjectsFilter, loadBuyerData, loadAgentProfile, loadDeveloperProfile]);

  // Refetch latest profile when user switches to the Profile tab
  useEffect(() => {
    if (!user || activeTab !== "profile") return;
    if (user.role === "developer") {
      loadDeveloperProfile();
    } else if (user.role === "agent") {
      loadAgentProfile();
    } else if (user.role === "buyer") {
      loadBuyerData();
    }
  }, [activeTab, user, loadDeveloperProfile, loadAgentProfile, loadBuyerData]);

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
        message: "Developer corporate profile updated successfully and synced with backend!",
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
          <div className={styles.userInfoBadge}>
            <span className={styles.userName}>{user?.fullName || "Authenticated User"}</span>
            <div className={styles.userRoleStatus}>
              <span className={styles.roleTag}>{role.replace("_", " ")}</span>
              <span
                className={`${styles.statusPill} ${
                  status === "approved"
                    ? styles.statusApproved
                    : status === "rejected"
                    ? styles.statusRejected
                    : status === "suspended"
                    ? styles.statusSuspended
                    : styles.statusPending
                }`}
              >
                {status}
              </span>
            </div>
          </div>

          <button type="button" className={styles.logoutBtn} onClick={() => logout()}>
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.dashMain}>
        {/* FE-007: Account Status Screen / Banner */}
        <section
          className={`${styles.statusBanner} ${
            status === "approved"
              ? styles.statusBannerApproved
              : status === "rejected"
              ? styles.statusBannerRejected
              : status === "suspended"
              ? styles.statusBannerSuspended
              : styles.statusBannerPending
          }`}
        >
          <div className={styles.statusBannerContent}>
            <div className={styles.statusBannerIcon}>
              {status === "approved" ? (
                <ShieldCheck size={32} color="#10b981" />
              ) : status === "rejected" ? (
                <ShieldAlert size={32} color="#ef4444" />
              ) : status === "suspended" ? (
                <Ban size={32} color="#111827" />
              ) : (
                <Clock size={32} color="#f59e0b" />
              )}
            </div>
            <div>
              <h2 className={styles.statusBannerTitle}>
                {status === "approved"
                  ? "Account Verified & Approved"
                  : status === "rejected"
                  ? "Verification Requires Attention"
                  : status === "suspended"
                  ? "Account Temporarily Suspended"
                  : "Account Verification Under Review"}
              </h2>
              <p className={styles.statusBannerDesc}>
                {status === "approved"
                  ? "Your credentials and municipal registry clearance are active. You have full access to publish listings, manage buyer walkthroughs, and close transactions."
                  : status === "rejected"
                  ? "Your submitted documents did not meet municipal verification criteria. Please review reviewer remarks and upload updated credentials."
                  : status === "suspended"
                  ? "Your account access has been paused pending administrative compliance review. Please contact Sola support."
                  : "Your professional registration is being audited against municipal land records and trade registry documents. Typical review time is 24 hours."}
              </p>
            </div>
          </div>
        </section>

        {/* FE-006: Role-Based Tab Navigation */}
        <nav className={styles.tabNav}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "overview" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>

          {role === "buyer" && (
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "profile" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("profile")}
            >
              Preferences & Profile
            </button>
          )}

          {role === "agent" && (
            <>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "profile" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("profile")}
              >
                Broker Profile
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

          {role === "developer" && (
            <>
              <button
                type="button"
                className={`${styles.tabBtn} ${
                  activeTab === "developments" ? styles.tabBtnActive : ""
                }`}
                onClick={() => setActiveTab("developments")}
              >
                Developments & Projects
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "profile" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("profile")}
              >
                Company Profile
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${
                  activeTab === "verification" ? styles.tabBtnActive : ""
                }`}
                onClick={() => setActiveTab("verification")}
              >
                Accreditation Documents
              </button>
            </>
          )}

          {(role === "admin" || role === "finance_admin") && (
            <>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "admin" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("admin")}
              >
                Verification Queue
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
                Project Directory
              </button>
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

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className={styles.cardBox}>
            <div className={styles.cardHeader}>
              <span className={styles.cardPretitle}>Account Summary</span>
              <h3 className={styles.cardTitle}>Welcome back, {user?.fullName}</h3>
              <p className={styles.cardDesc}>
                Manage your credentials, projects, and municipal interactions across Addis Ababa.
              </p>
            </div>

            <div className={styles.formGrid2}>
              <div style={{ backgroundColor: "#f6f7f9", padding: "24px 20px" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    color: "#8c95a6",
                    textTransform: "uppercase",
                  }}
                >
                  Active Role
                </span>
                <div
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 850,
                    marginTop: 4,
                    textTransform: "capitalize",
                  }}
                >
                  {role}
                </div>
                <p style={{ fontSize: "0.86rem", color: "#6a717e", marginTop: 6 }}>
                  {role === "buyer"
                    ? "Verified property seeker with custom residential filters."
                    : role === "agent"
                    ? "Accredited broker managing verified luxury listings."
                    : role === "developer"
                    ? "Residential construction developer managing multi-unit projects."
                    : "Platform administrator with compliance review authority."}
                </p>
              </div>

              <div style={{ backgroundColor: "#f6f7f9", padding: "24px 20px" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    color: "#8c95a6",
                    textTransform: "uppercase",
                  }}
                >
                  Verification Status
                </span>
                <div
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 850,
                    marginTop: 4,
                    textTransform: "capitalize",
                  }}
                >
                  {status}
                </div>
                <p style={{ fontSize: "0.86rem", color: "#6a717e", marginTop: 6 }}>
                  {status === "approved"
                    ? "Clearance active. All capabilities and listing tools unlocked."
                    : "Under examination by municipal legal team."}
                </p>
              </div>
            </div>
          </div>
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

        {/* TAB: BUYER PROFILE & PREFERENCES (FE-004 + Task 5) */}
        {role === "buyer" && activeTab === "profile" && (
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
                  <span className={styles.cardPretitle}>Contact Details</span>
                  <h3 className={styles.cardTitle}>Buyer Contact Profile</h3>
                  <p className={styles.cardDesc}>
                    Set your preferred communication channels for tour invitations and closing updates.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadBuyerData}
                  disabled={isProfileLoading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #000000",
                    color: "#000000",
                    fontSize: "0.78rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    cursor: isProfileLoading ? "not-allowed" : "pointer",
                    borderRadius: "0px",
                  }}
                >
                  <RefreshCw
                    size={14}
                    style={{
                      animation: isProfileLoading ? "spin 1s linear infinite" : "none",
                    }}
                  />
                  <span>{isProfileLoading ? "Syncing API..." : "Sync from Backend"}</span>
                </button>
              </div>
            </div>

            {/* Live Backend Synchronization Banner */}
            {isProfileLoading ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 16px",
                  backgroundColor: "#f3f4f6",
                  borderLeft: "3px solid #000000",
                  marginBottom: 24,
                  fontSize: "0.84rem",
                  color: "#374151",
                }}
              >
                <Clock size={16} />
                <span>Fetching buyer profile and criteria from backend (<code>GET /api/v1/buyer/me</code>)...</span>
              </div>
            ) : profileSynced ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                  padding: "12px 16px",
                  backgroundColor: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  borderLeft: "3px solid #059669",
                  marginBottom: 24,
                  fontSize: "0.84rem",
                  color: "#065f46",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CheckCircle2 size={16} color="#059669" />
                  <span>
                    <strong>Live Backend Connected:</strong> Preferences loaded from <code>/api/v1/buyer/me</code>.
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.72rem",
                    backgroundColor: "#d1fae5",
                    padding: "2px 8px",
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                    color: "#065f46",
                  }}
                >
                  VERIFIED SERVER RECORD
                </span>
              </div>
            ) : null}

            <form onSubmit={handleSaveBuyer}>
              <div className={styles.formGrid2}>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Phone Number</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="+251 9... or international"
                    value={buyerProfile.phoneNumber || ""}
                    onChange={(e) =>
                      setBuyerProfile({ ...buyerProfile, phoneNumber: e.target.value })
                    }
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Preferred Contact Method</label>
                  <select
                    className={styles.formSelect}
                    value={buyerProfile.preferredContactMethod || "whatsapp"}
                    onChange={(e) =>
                      setBuyerProfile({
                        ...buyerProfile,
                        preferredContactMethod: e.target.value as any,
                      })
                    }
                  >
                    <option value="whatsapp">WhatsApp Direct</option>
                    <option value="phone">Cell Phone Call</option>
                    <option value="email">Email Notification</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  margin: "36px 0 24px",
                  borderTop: "1px solid #edf0f4",
                  paddingTop: "24px",
                }}
              >
                <span className={styles.cardPretitle}>Custom Search Criteria</span>
                <h3 className={styles.cardTitle}>Property Typologies & Amenities</h3>
                <p className={styles.cardDesc}>
                  Filter matches across all 10 residential and commercial property categories.
                </p>
              </div>

              {/* All 10 Property Types */}
              <div className={styles.formField}>
                <label className={styles.formLabel}>Desired Property Typologies</label>
                <div className={styles.checkboxPills}>
                  {PROPERTY_TYPES.map((type) => {
                    const active = buyerPrefs.property_types?.includes(type as any);
                    return (
                      <button
                        key={type}
                        type="button"
                        className={`${styles.checkboxPill} ${active ? styles.checkboxPillActive : ""}`}
                        onClick={() =>
                          setBuyerPrefs({
                            ...buyerPrefs,
                            property_types: toggleArrayItem(buyerPrefs.property_types, type) as any,
                          })
                        }
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* All 10 Amenities */}
              <div className={styles.formField}>
                <label className={styles.formLabel}>Essential Amenities</label>
                <div className={styles.checkboxPills}>
                  {AMENITIES.map((amenity) => {
                    const active = buyerPrefs.features?.includes(amenity as any);
                    return (
                      <button
                        key={amenity}
                        type="button"
                        className={`${styles.checkboxPill} ${active ? styles.checkboxPillActive : ""}`}
                        onClick={() =>
                          setBuyerPrefs({
                            ...buyerPrefs,
                            features: toggleArrayItem(buyerPrefs.features as any, amenity) as any,
                          })
                        }
                      >
                        {amenity.replace("_", " ").toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Budget Range & Sizing */}
              <div className={styles.formGrid2}>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Min Budget (USD / ETB Equivalent)</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={buyerPrefs.budget_min || 0}
                    onChange={(e) =>
                      setBuyerPrefs({ ...buyerPrefs, budget_min: Number(e.target.value) })
                    }
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Max Budget (USD / ETB Equivalent)</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={buyerPrefs.budget_max || 0}
                    onChange={(e) =>
                      setBuyerPrefs({ ...buyerPrefs, budget_max: Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className={styles.formGrid2}>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Min Size (sqm)</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={buyerPrefs.min_size_sqm || 0}
                    onChange={(e) =>
                      setBuyerPrefs({ ...buyerPrefs, min_size_sqm: Number(e.target.value) })
                    }
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Payment Preference</label>
                  <select
                    className={styles.formSelect}
                    value={buyerPrefs.payment_preference || "installment"}
                    onChange={(e) =>
                      setBuyerPrefs({ ...buyerPrefs, payment_preference: e.target.value as any })
                    }
                  >
                    <option value="cash">Full Cash Payment</option>
                    <option value="installment">Milestone Installments</option>
                    <option value="mortgage">Bank Mortgage</option>
                  </select>
                </div>
              </div>

              <button type="submit" className={styles.submitBtn} disabled={submitting}>
                <span>{submitting ? "Saving..." : "Save Preferences & Profile"}</span>
                <Send size={16} />
              </button>
            </form>
          </div>
        )}

        {/* TAB: AGENT PROFILE */}
        {role === "agent" && activeTab === "profile" && (
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
                  <span className={styles.cardPretitle}>Professional Registry</span>
                  <h3 className={styles.cardTitle}>Broker Accreditation Profile</h3>
                  <p className={styles.cardDesc}>
                    Maintain your professional bio, agency affiliation, and verified years of experience.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadAgentProfile}
                  disabled={isProfileLoading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #000000",
                    color: "#000000",
                    fontSize: "0.78rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    cursor: isProfileLoading ? "not-allowed" : "pointer",
                    borderRadius: "0px",
                  }}
                >
                  <RefreshCw
                    size={14}
                    style={{
                      animation: isProfileLoading ? "spin 1s linear infinite" : "none",
                    }}
                  />
                  <span>{isProfileLoading ? "Syncing API..." : "Sync from Backend"}</span>
                </button>
              </div>
            </div>

            {/* Live Backend Synchronization Banner */}
            {isProfileLoading ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 16px",
                  backgroundColor: "#f3f4f6",
                  borderLeft: "3px solid #000000",
                  marginBottom: 24,
                  fontSize: "0.84rem",
                  color: "#374151",
                }}
              >
                <Clock size={16} />
                <span>Fetching broker profile data from backend (<code>GET /api/v1/agent/me</code>)...</span>
              </div>
            ) : profileSynced ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                  padding: "12px 16px",
                  backgroundColor: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  borderLeft: "3px solid #059669",
                  marginBottom: 24,
                  fontSize: "0.84rem",
                  color: "#065f46",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CheckCircle2 size={16} color="#059669" />
                  <span>
                    <strong>Live Backend Connected:</strong> Broker profile loaded from <code>/api/v1/agent/me</code>.
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.72rem",
                    backgroundColor: "#d1fae5",
                    padding: "2px 8px",
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                    color: "#065f46",
                  }}
                >
                  VERIFIED SERVER RECORD
                </span>
              </div>
            ) : null}

            <form onSubmit={handleSaveAgent}>
              <div className={styles.formGrid2}>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Agency / Brokerage Name</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g. Sola-trading or Century Realty"
                    value={agentProfile.agency_name || ""}
                    onChange={(e) =>
                      setAgentProfile({ ...agentProfile, agency_name: e.target.value })
                    }
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Phone Number</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="+251 9..."
                    value={agentProfile.phone_number || ""}
                    onChange={(e) =>
                      setAgentProfile({ ...agentProfile, phone_number: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Years of Experience in Addis Ababa</label>
                <input
                  type="number"
                  min={0}
                  className={styles.formInput}
                  value={agentProfile.years_of_experience || 0}
                  onChange={(e) =>
                    setAgentProfile({ ...agentProfile, years_of_experience: Number(e.target.value) })
                  }
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Professional Biography</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="Detail your residential specialization (e.g., luxury penthouses in Bole, diplomatic leases in Old Airport)..."
                  value={agentProfile.bio || ""}
                  onChange={(e) => setAgentProfile({ ...agentProfile, bio: e.target.value })}
                />
              </div>

              <button type="submit" className={styles.submitBtn} disabled={submitting}>
                <span>{submitting ? "Saving..." : "Update Broker Profile"}</span>
                <Send size={16} />
              </button>
            </form>
          </div>
        )}

        {/* TAB: DEVELOPER COMPANY PROFILE */}
        {role === "developer" && activeTab === "profile" && (
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
                  <span className={styles.cardPretitle}>Corporate Roster</span>
                  <h3 className={styles.cardTitle}>Property Developer Profile</h3>
                  <p className={styles.cardDesc}>
                    Official corporate profile for listing multi-unit residential developments.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadDeveloperProfile}
                  disabled={isProfileLoading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #000000",
                    color: "#000000",
                    fontSize: "0.78rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    cursor: isProfileLoading ? "not-allowed" : "pointer",
                    borderRadius: "0px",
                  }}
                >
                  <RefreshCw
                    size={14}
                    style={{
                      animation: isProfileLoading ? "spin 1s linear infinite" : "none",
                    }}
                  />
                  <span>{isProfileLoading ? "Syncing API..." : "Sync from Backend"}</span>
                </button>
              </div>
            </div>

            {/* Live Backend Synchronization Banner */}
            {isProfileLoading ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 16px",
                  backgroundColor: "#f3f4f6",
                  borderLeft: "3px solid #000000",
                  marginBottom: 24,
                  fontSize: "0.84rem",
                  color: "#374151",
                }}
              >
                <Clock size={16} />
                <span>
                  Fetching latest corporate profile data from backend (<code>GET /api/v1/developer/me</code>)...
                </span>
              </div>
            ) : profileSynced ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                  padding: "12px 16px",
                  backgroundColor: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  borderLeft: "3px solid #059669",
                  marginBottom: 24,
                  fontSize: "0.84rem",
                  color: "#065f46",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CheckCircle2 size={16} color="#059669" />
                  <span>
                    <strong>Live Backend Connected:</strong> Corporate profile loaded from <code>/api/v1/developer/me</code>.
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.72rem",
                    backgroundColor: "#d1fae5",
                    padding: "2px 8px",
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                    color: "#065f46",
                  }}
                >
                  VERIFIED SERVER RECORD
                </span>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                  padding: "12px 16px",
                  backgroundColor: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderLeft: "3px solid #d97706",
                  marginBottom: 24,
                  fontSize: "0.84rem",
                  color: "#92400e",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AlertCircle size={16} color="#d97706" />
                  <span>
                    No developer corporate profile on server yet. Fill in your details below and click <strong>Update Developer Profile</strong> to save to the database.
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveDeveloper}>
              <div className={styles.formGrid2}>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Company Legal Name</label>
                  <input
                    type="text"
                    required
                    className={styles.formInput}
                    placeholder="e.g. Sola Construction & Development PLC"
                    value={developerProfile.company_name || ""}
                    onChange={(e) =>
                      setDeveloperProfile({ ...developerProfile, company_name: e.target.value })
                    }
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Corporate Phone</label>
                  <input
                    type="text"
                    required
                    className={styles.formInput}
                    placeholder="+251 11... / +251 9..."
                    value={developerProfile.contact_phone || ""}
                    onChange={(e) =>
                      setDeveloperProfile({ ...developerProfile, contact_phone: e.target.value })
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
                    className={styles.formInput}
                    placeholder="Bole Sub-City, Addis Ababa, Ethiopia"
                    value={developerProfile.business_address || ""}
                    onChange={(e) =>
                      setDeveloperProfile({ ...developerProfile, business_address: e.target.value })
                    }
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Company Website URL</label>
                  <input
                    type="url"
                    className={styles.formInput}
                    placeholder="https://example-developer.com"
                    value={developerProfile.website_url || ""}
                    onChange={(e) =>
                      setDeveloperProfile({ ...developerProfile, website_url: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Company Overview & Past Completions</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="Detail previous project deliveries, ongoing towers, and architectural focus..."
                  value={developerProfile.company_description || ""}
                  onChange={(e) =>
                    setDeveloperProfile({
                      ...developerProfile,
                      company_description: e.target.value,
                    })
                  }
                />
              </div>

              <button type="submit" className={styles.submitBtn} disabled={submitting}>
                <span>{submitting ? "Saving to Backend..." : "Update Developer Profile"}</span>
                <Send size={16} />
              </button>
            </form>
          </div>
        )}

        {/* TAB: ACCOUNT VERIFICATION SUBMISSION (FE-005) */}
        {(role === "agent" || role === "developer") && activeTab === "verification" && (
          <div className={styles.cardBox}>
            <div className={styles.cardHeader}>
              <span className={styles.cardPretitle}>Municipal Compliance</span>
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
                  placeholder="Describe building specifications, architectural highlights, unit typologies..."
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
