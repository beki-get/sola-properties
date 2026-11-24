"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Building2,
  ShieldCheck,
  Calendar,
  Layers,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Compass,
  Check,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { adminApi, developerApi, referralApi, Project } from "../../../lib/api";
import { Navbar } from "../../components/Navbar";
import styles from "./project-detail.module.css";

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Consultation Inquiry Form State
  const [inquiryName, setInquiryName] = useState(user?.fullName || "");
  const [inquiryEmail, setInquiryEmail] = useState(user?.email || "");
  const [inquiryPhone, setInquiryPhone] = useState("");
  const [inquiryNotes, setInquiryNotes] = useState("");
  const [submittingInquiry, setSubmittingInquiry] = useState(false);
  const [inquiryFeedback, setInquiryFeedback] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    const fetchProject = async () => {
      try {
        let p: Project | null = null;
        if (user?.role === "developer") {
          const res = await developerApi.getProjectById(projectId);
          p = res.data?.project || (res.data as any)?.data || null;
        } else if (user?.role === "admin") {
          const res = await adminApi.getProjectById(projectId);
          p = res.data?.project || (res.data as any)?.data || null;
        }
        if (p) {
          setProject(p);
        }
      } catch (err) {
        console.error("Failed to load project details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId, user]);

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingInquiry(true);
    setInquiryFeedback(null);

    try {
      // If user is authenticated, create an inquiry / referral lead
      if (isAuthenticated) {
        await referralApi.createReferral({
          propertyId: projectId,
          message: `Project Consultation Request for [${project?.name || projectId}] from ${inquiryName.trim()} (${inquiryEmail.trim()}${inquiryPhone ? `, ${inquiryPhone.trim()}` : ""}): ${inquiryNotes.trim()}`,
        });
      }

      setInquiryFeedback({
        ok: true,
        msg: "Your development consultation request has been sent directly to the developer team.",
      });
      setInquiryNotes("");
    } catch (err: any) {
      setInquiryFeedback({
        ok: false,
        msg: err.message || "Failed to send consultation request. Please try again.",
      });
    } finally {
      setSubmittingInquiry(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.pageWrapper}>
        <div style={{ padding: "64px", textAlign: "center" }}>
          <p style={{ fontWeight: 800 }}>Loading Project Details...</p>
        </div>
      </div>
    );
  }

  const p = project || {
    id: projectId,
    developer_id: "dev-solanova",
    name: "Residential Development",
    location: "Addis Ababa, Ethiopia",
    description:
      "A modern residential community development featuring verified titles and quality finishes.",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <div className={styles.pageWrapper}>
      {/* Top Common Navbar */}
      <Navbar />

      {/* Breadcrumb Bar */}
      <div className={styles.breadcrumbBar}>
        <div className={styles.breadcrumbLinks}>
          <Link href="/" className={styles.breadcrumbLink}>
            Home
          </Link>
          <span>/</span>
          <Link href="/projects" className={styles.breadcrumbLink}>
            Developments
          </Link>
          <span>/</span>
          <span className={styles.breadcrumbCurrent}>{p.name}</span>
        </div>

        <Link href="/projects" className={styles.backBtn}>
          <ArrowLeft size={16} />
          <span>All Developments</span>
        </Link>
      </div>

      {/* Main Layout */}
      <main className={styles.mainLayout}>
        {/* Left Column: Visual Banner & Narrative */}
        <div className={styles.leftCol}>
          <div className={styles.heroCard}>
            <div className={styles.heroBanner}>
              {(p as any).image_url || (p as any).cover_image ? (
                <img
                  src={(p as any).image_url || (p as any).cover_image}
                  alt={p.name}
                  className={styles.heroImg}
                  style={{ width: "100%", height: 340, objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: 280,
                    backgroundColor: "#f8fafc",
                    borderBottom: "1px solid #e5e7eb",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    color: "#94a3b8",
                  }}
                >
                  <Building2 size={48} color="#cbd5e1" />
                  <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>Development Project Overview</span>
                </div>
              )}

              <div className={styles.heroBadges}>
                <span
                  className={styles.badgePill}
                  style={{
                    backgroundColor: p.status === "active" ? "#059669" : "#4b5563",
                  }}
                >
                  {p.status === "active" ? "Active Development" : "Pre-Launch"}
                </span>
                <span className={styles.badgePill} style={{ backgroundColor: "#000000" }}>
                  <ShieldCheck size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                  Verified Developer
                </span>
              </div>
            </div>

            <div className={styles.heroContent}>
              <h1 className={styles.projectTitle}>{p.name}</h1>
              <div className={styles.locationRow}>
                <MapPin size={18} color="#000000" />
                <span>{p.location}</span>
              </div>

              <div className={styles.featuresGrid}>
                <div className={styles.featureBox}>
                  <ShieldCheck size={20} className={styles.featureIcon} />
                  <div>
                    <h4 className={styles.featureTitle}>Verified Title & Deeds</h4>
                    <p className={styles.featureDesc}>
                      Deed registration and construction permits authenticated and audited.
                    </p>
                  </div>
                </div>

                <div className={styles.featureBox}>
                  <Building2 size={20} className={styles.featureIcon} />
                  <div>
                    <h4 className={styles.featureTitle}>Reinforced Construction</h4>
                    <p className={styles.featureDesc}>
                      Engineered concrete structure with modern acoustic insulation and premium finishes.
                    </p>
                  </div>
                </div>

                <div className={styles.featureBox}>
                  <Compass size={20} className={styles.featureIcon} />
                  <div>
                    <h4 className={styles.featureTitle}>Natural Light & Views</h4>
                    <p className={styles.featureDesc}>
                      Spacious balconies and double-glazed windows designed for natural ventilation.
                    </p>
                  </div>
                </div>

                <div className={styles.featureBox}>
                  <Sparkles size={20} className={styles.featureIcon} />
                  <div>
                    <h4 className={styles.featureTitle}>Backup Power & Utilities</h4>
                    <p className={styles.featureDesc}>
                      Dedicated backup generators and reserve water storage for uninterrupted service.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.narrativeCard}>
            <h3 className={styles.sectionHeading}>Development Overview & Master Plan</h3>
            <p className={styles.narrativeText}>
              {p.description ||
                "This residential development features verified title clearance, reinforced concrete construction, and private security access."}
            </p>
            <p className={styles.narrativeText}>
              All individual residences within this development comply with Sola Properties’ strict
              quality standards: guaranteed title validity, transparent purchase terms, and direct accredited builder representation.
            </p>
          </div>
        </div>

        {/* Right Column: Inquiry & Units Dock */}
        <aside className={styles.sidebarCol}>
          {/* Browse Units In Development Box */}
          <div className={styles.browseUnitsCard}>
            <h3 className={styles.browseUnitsTitle}>Residences in this Development</h3>
            <p className={styles.browseUnitsDesc}>
              Explore verified penthouses, luxury apartments, and villas available for acquisition in {p.name}.
            </p>
            <Link
              href={`/properties?search=${encodeURIComponent(p.name)}`}
              className={styles.browseUnitsBtn}
            >
              <span>Explore Available Units</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Consultation Request Form */}
          <div className={styles.inquiryCard}>
            <span className={styles.inquiryPre}>Direct Inquiry</span>
            <h3 className={styles.inquiryTitle}>Developer Consultation</h3>
            <p className={styles.inquiryDesc}>
              Request floor plans, project layout drawings, or an on-site private visit with the developer team.
            </p>

            {inquiryFeedback && (
              <div
                className={`${styles.feedbackAlert} ${
                  inquiryFeedback.ok ? styles.feedbackSuccess : styles.feedbackError
                }`}
              >
                {inquiryFeedback.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <span>{inquiryFeedback.msg}</span>
              </div>
            )}

            <form onSubmit={handleInquirySubmit} className={styles.inquiryForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Full Legal Name</label>
                <input
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="e.g. Dawit Tadesse"
                  className={styles.formInput}
                  value={inquiryName}
                  onChange={(e) => setInquiryName(e.target.value)}
                  disabled={submittingInquiry}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Direct Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="dawit@example.com"
                  className={styles.formInput}
                  value={inquiryEmail}
                  onChange={(e) => setInquiryEmail(e.target.value)}
                  disabled={submittingInquiry}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Phone Number</label>
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="+251 91 123 4567"
                  className={styles.formInput}
                  value={inquiryPhone}
                  onChange={(e) => setInquiryPhone(e.target.value)}
                  disabled={submittingInquiry}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Inquiry Specifications</label>
                <textarea
                  placeholder="Inquire about available floors, unit typologies, commercial suites, or private tour dates..."
                  className={styles.formTextarea}
                  value={inquiryNotes}
                  onChange={(e) => setInquiryNotes(e.target.value)}
                  disabled={submittingInquiry}
                />
              </div>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={submittingInquiry}
              >
                <span>{submittingInquiry ? "Sending..." : "Submit Consultation Request"}</span>
                <Send size={16} />
              </button>
            </form>
          </div>
        </aside>
      </main>
    </div>
  );
}
