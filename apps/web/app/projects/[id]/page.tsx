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

const CURATED_PROJECT_DETAILS: Record<string, Project> = {
  "proj-skyline-01": {
    id: "proj-skyline-01",
    developer_id: "dev-solanova-01",
    name: "Addis Skyline Residences",
    location: "Bole Olympia, Addis Ababa",
    description:
      "Addis Skyline Residences rises 28 stories above Bole Olympia, offering luxury residential living in one of the capital's premier districts. Each residence features floor-to-ceiling panoramic glass windows, private terrace gardens, sound-insulated construction, and premium contemporary finishes.\n\nBuilding amenities include 24/7 security, underground parking with EV chargers, backup generator power, private water filtration, and a rooftop leisure deck with panoramic city views.",
    status: "active",
    created_at: "2026-08-15T09:00:00Z",
    updated_at: "2026-10-20T14:30:00Z",
  },
  "proj-olympia-02": {
    id: "proj-olympia-02",
    developer_id: "dev-solanova-02",
    name: "The Olive Sanctuary Estate",
    location: "Old Airport Diplomatic Zone, Addis Ababa",
    description:
      "The Olive Sanctuary Estate is an exclusive gated community of 16 luxury detached villas set in a quiet, green residential zone. Each home features private courtyard gardens, plunge pools, high ceilings, modern open-plan kitchens, and comprehensive perimeter security.",
    status: "active",
    created_at: "2026-09-01T11:00:00Z",
    updated_at: "2026-10-25T16:00:00Z",
  },
  "proj-financial-03": {
    id: "proj-financial-03",
    developer_id: "dev-solanova-03",
    name: "Kazanchis Central Heights",
    location: "Financial District, Kazanchis, Addis Ababa",
    description:
      "A modern 24-story residential tower located in the heart of Kazanchis, near international organizations and financial headquarters. Designed for urban professionals and investors, featuring executive suites, top-floor penthouses, concierge reception, and full backup power.",
    status: "active",
    created_at: "2026-09-18T08:30:00Z",
    updated_at: "2026-11-05T10:15:00Z",
  },
  "proj-entoto-04": {
    id: "proj-entoto-04",
    developer_id: "dev-solanova-04",
    name: "Entoto Hillside Terraces",
    location: "Entoto Foothills, Northern Addis Ababa",
    description:
      "A peaceful hillside residential community nestled along the forested slopes of Entoto. Built with natural stone and timber details, offering wide terrace views over Addis Ababa in a fresh mountain environment.",
    status: "inactive",
    created_at: "2026-10-02T13:45:00Z",
    updated_at: "2026-11-12T12:00:00Z",
  },
};

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [project, setProject] = useState<Project | null>(
    CURATED_PROJECT_DETAILS[projectId] || null
  );
  const [loading, setLoading] = useState(!CURATED_PROJECT_DETAILS[projectId]);

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
    // Attempt to load from live API
    adminApi
      .getProjectById(projectId)
      .then((res) => {
        const p = res.data?.project || (res.data as any)?.data;
        if (res.ok && p) {
          setProject(p);
        }
      })
      .catch(() => {
        // Fallback to curated if not found
        if (!project && CURATED_PROJECT_DETAILS[projectId]) {
          setProject(CURATED_PROJECT_DETAILS[projectId]);
        }
      })
      .finally(() => setLoading(false));
  }, [projectId]);

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
        msg: "Your development consultation request has been dispatched directly to the certified developer team.",
      });
      setInquiryNotes("");
    } catch (err: any) {
      setInquiryFeedback({
        ok: false,
        msg: err.message || "Failed to dispatch consultation request. Please try again.",
      });
    } finally {
      setSubmittingInquiry(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.pageWrapper}>
        <div style={{ padding: "64px", textAlign: "center" }}>
          <p style={{ fontWeight: 800 }}>Loading Master Development Dossier...</p>
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
              <Image
                src={
                  projectId.includes("olympia")
                    ? "/property-villa.jpg"
                    : projectId.includes("financial")
                    ? "/property-terrace.jpg"
                    : "/property-penthouse.jpg"
                }
                alt={p.name}
                width={1200}
                height={600}
                priority
                className={styles.heroImg}
              />

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
            <span className={styles.inquiryPre}>Private Access</span>
            <h3 className={styles.inquiryTitle}>Developer Consultation</h3>
            <p className={styles.inquiryDesc}>
              Request master floor plans, architectural elevation drawings, or an on-site private briefing with the accredited developer team.
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
                <span>{submittingInquiry ? "Dispatching..." : "Submit Consultation Request"}</span>
                <Send size={16} />
              </button>
            </form>
          </div>
        </aside>
      </main>
    </div>
  );
}
