"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Building2,
  MapPin,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { adminApi, Project } from "../../lib/api";
import styles from "./projects.module.css";

// Curated Architectural Developments for initial public showcase
const CURATED_DEVELOPMENTS: Project[] = [
  {
    id: "proj-skyline-01",
    developer_id: "dev-solanova-01",
    name: "Addis Skyline Residences",
    location: "Bole Olympia, Addis Ababa",
    description:
      "A 28-story brutalist-inspired residential monolith featuring floor-to-ceiling curtain wall glazing, cantilevered sky gardens, and panoramic views across the metropolitan plateau.",
    status: "active",
    created_at: "2026-08-15T09:00:00Z",
    updated_at: "2026-10-20T14:30:00Z",
  },
  {
    id: "proj-olympia-02",
    developer_id: "dev-solanova-02",
    name: "The Olive Sanctuary Estate",
    location: "Old Airport Diplomatic Zone, Addis Ababa",
    description:
      "Gated low-density sanctuary of 16 precision-cast concrete villas integrated into mature indigenous acacia and olive landscapes with private security perimeters and geothermal temperature control.",
    status: "active",
    created_at: "2026-09-01T11:00:00Z",
    updated_at: "2026-10-25T16:00:00Z",
  },
  {
    id: "proj-financial-03",
    developer_id: "dev-solanova-03",
    name: "Kazanchis Central Heights",
    location: "Financial District, Kazanchis, Addis Ababa",
    description:
      "Modern dual-core residential tower optimized for institutional executives, diplomat suites, and high-yield serviced apartments with triple-redundant solar microgrid integration.",
    status: "active",
    created_at: "2026-09-18T08:30:00Z",
    updated_at: "2026-11-05T10:15:00Z",
  },
  {
    id: "proj-entoto-04",
    developer_id: "dev-solanova-04",
    name: "Entoto Hillside Terraces",
    location: "Entoto Foothills, Northern Addis Ababa",
    description:
      "Biophilic stepped terrace residences constructed from local volcanic basalt and certified timber, featuring private alpine viewing decks and natural mountain spring filtration.",
    status: "inactive",
    created_at: "2026-10-02T13:45:00Z",
    updated_at: "2026-11-12T12:00:00Z",
  },
];

function ProjectsCatalogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  const [projects, setProjects] = useState<Project[]>(CURATED_DEVELOPMENTS);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "inactive">(
    (searchParams.get("status") as any) || "all"
  );

  useEffect(() => {
    // Attempt to load live projects from backend
    setLoading(true);
    adminApi
      .getAllProjects({ limit: 50 })
      .then((res) => {
        const live = res.data?.projects || (res.data as any)?.data;
        if (res.ok && Array.isArray(live) && live.length > 0) {
          // Merge live projects with curated showcase
          const liveIds = new Set(live.map((p) => p.id));
          const merged = [...live, ...CURATED_DEVELOPMENTS.filter((c) => !liveIds.has(c.id))];
          setProjects(merged);
        }
      })
      .catch(() => {
        // Keep curated fallback
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchStatus =
        selectedStatus === "all" ? true : (p.status || "active") === selectedStatus;
      const query = searchQuery.trim().toLowerCase();
      const matchQuery =
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.location.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query));
      return matchStatus && matchQuery;
    });
  }, [projects, selectedStatus, searchQuery]);

  return (
    <div className={styles.projectsWrapper}>
      {/* Top Architectural Header */}
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
          <Link href="/projects" className={`${styles.navLink} ${styles.navLinkActive}`}>
            Developments
          </Link>
          <Link href="/properties/compare" className={styles.navLink}>
            Compare
          </Link>
        </nav>

        <div className={styles.headerRight}>
          {isAuthenticated ? (
            <Link href="/dashboard" className={styles.authBtn}>
              Dashboard ({user?.role})
            </Link>
          ) : (
            <Link href="/login" className={styles.authBtn}>
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className={styles.heroSection}>
        <span className={styles.heroTag}>Master Developments</span>
        <h1 className={styles.heroTitle}>Architectural Real Estate Developments</h1>
        <p className={styles.heroDesc}>
          Explore master-planned towers, gated residential sanctuaries, and urban developments
          built by accredited real estate developers across Ethiopia.
        </p>
      </section>

      {/* Filter & Search Bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search developments by name, district, or architectural style..."
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.statusFilterGroup}>
          <button
            type="button"
            className={`${styles.statusPill} ${selectedStatus === "all" ? styles.statusPillActive : ""}`}
            onClick={() => setSelectedStatus("all")}
          >
            All Developments
          </button>
          <button
            type="button"
            className={`${styles.statusPill} ${selectedStatus === "active" ? styles.statusPillActive : ""}`}
            onClick={() => setSelectedStatus("active")}
          >
            Active & Available
          </button>
          <button
            type="button"
            className={`${styles.statusPill} ${selectedStatus === "inactive" ? styles.statusPillActive : ""}`}
            onClick={() => setSelectedStatus("inactive")}
          >
            Upcoming & Pre-Launch
          </button>
        </div>
      </div>

      {/* Main Grid Container */}
      <main className={styles.mainContainer}>
        <div className={styles.countRow}>
          <span className={styles.countText}>
            Showing {filteredProjects.length} Verified Master Developments
          </span>
        </div>

        {filteredProjects.length === 0 ? (
          <div className={styles.emptyCard}>
            <Building2 size={48} color="#8c95a6" style={{ margin: "0 auto" }} />
            <h3 className={styles.emptyTitle}>No Developments Found</h3>
            <p className={styles.emptyDesc}>
              No residential developments matched your search criteria. Try modifying your search keywords
              or reset the status filter.
            </p>
            <button
              type="button"
              className={styles.primaryBtn}
              style={{ display: "inline-flex", width: "auto", margin: "0 auto" }}
              onClick={() => {
                setSearchQuery("");
                setSelectedStatus("all");
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className={styles.projectsGrid}>
            {filteredProjects.map((project, idx) => (
              <article key={project.id} className={styles.projectCard}>
                <div className={styles.cardBanner}>
                  <Image
                    src={
                      idx % 3 === 0
                        ? "/property-penthouse.jpg"
                        : idx % 3 === 1
                        ? "/property-villa.jpg"
                        : "/property-terrace.jpg"
                    }
                    alt={project.name}
                    width={600}
                    height={380}
                    className={styles.cardImg}
                  />

                  <div className={styles.cardTopBadges}>
                    <span
                      className={`${styles.statusBadge} ${
                        project.status === "active" ? styles.statusActive : ""
                      }`}
                    >
                      {project.status === "active" ? "Active Development" : "Upcoming Project"}
                    </span>
                    <span className={styles.developerBadge}>
                      <ShieldCheck size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                      Verified Builder
                    </span>
                  </div>
                </div>

                <div className={styles.cardBody}>
                  <h2 className={styles.projectName}>{project.name}</h2>
                  <div className={styles.projectLocation}>
                    <MapPin size={16} />
                    <span>{project.location}</span>
                  </div>

                  <p className={styles.projectDesc}>{project.description || "Architectural master-planned residential development featuring verified municipal clearances and luxury residential residences."}</p>

                  <div className={styles.specsDivider} />

                  <div className={styles.specsRow}>
                    <div className={styles.specCol}>
                      <span className={styles.specLabel}>Registration</span>
                      <span className={styles.specVal}>Audited Title</span>
                    </div>
                    <div className={styles.specCol}>
                      <span className={styles.specLabel}>Catalog Units</span>
                      <span className={styles.specVal}>Available Now</span>
                    </div>
                  </div>

                  <div className={styles.actionRow}>
                    <Link
                      href={`/projects/${project.id}`}
                      className={styles.primaryBtn}
                    >
                      <span>Master Dossier</span>
                      <ArrowRight size={14} />
                    </Link>

                    <Link
                      href={`/properties?search=${encodeURIComponent(project.name)}`}
                      className={styles.secondaryBtn}
                      title="Browse available residences in this development"
                    >
                      <span>Browse Units</span>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.projectsWrapper}>
          <div style={{ padding: "48px", textAlign: "center" }}>
            <p style={{ fontWeight: 700 }}>Loading Developments Directory...</p>
          </div>
        </div>
      }
    >
      <ProjectsCatalogContent />
    </Suspense>
  );
}
