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
import { adminApi, developerApi, Project } from "../../lib/api";
import { Navbar } from "../components/Navbar";
import styles from "./projects.module.css";

function ProjectsCatalogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "inactive">(
    (searchParams.get("status") as any) || "all"
  );

  useEffect(() => {
    // Attempt to load live projects from backend
    setLoading(true);
    const fetchProjects = async () => {
      try {
        let live: Project[] = [];
        if (user?.role === "admin") {
          const res = await adminApi.getAllProjects({ limit: 50 });
          live = res.data?.projects || (res.data as any)?.data || [];
        } else if (user?.role === "developer") {
          const res = await developerApi.getProjects();
          live = res.data?.projects || res.data?.result?.projects || (res.data as any)?.data || [];
        } else {
          // Public visitor - attempt admin or developer projects if available
          const res = await adminApi.getAllProjects({ limit: 50 });
          live = res.data?.projects || (res.data as any)?.data || [];
        }
        if (Array.isArray(live)) {
          setProjects(live);
        }
      } catch (err) {
        console.error("Could not load backend projects:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [user]);

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
      {/* Top Common Navbar */}
      <Navbar />

      {/* Hero Section */}
      <section className={styles.heroSection}>
        <span className={styles.heroTag}>Featured Projects</span>
        <h1 className={styles.heroTitle}>New Developments & Residential Projects</h1>
        <p className={styles.heroDesc}>
          Explore modern residential communities, high-rise towers, and quality housing developments
          built by verified real estate developers across Ethiopia.
        </p>
      </section>

      {/* Filter & Search Bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search developments by name, district, or location..."
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
                  {(project as any).image_url || (project as any).cover_image ? (
                    <img
                      src={(project as any).image_url || (project as any).cover_image}
                      alt={project.name}
                      className={styles.cardImg}
                      style={{ width: "100%", height: 220, objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: 220,
                        backgroundColor: "#f8fafc",
                        borderBottom: "1px solid #e5e7eb",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        color: "#94a3b8",
                      }}
                    >
                      <Building2 size={40} color="#cbd5e1" />
                      <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>Development Project</span>
                    </div>
                  )}

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

                  <p className={styles.projectDesc}>{project.description || "Modern residential community featuring quality finishes, integrated amenities, and verified titles."}</p>

                  <div className={styles.specsDivider} />

                  <div className={styles.specsRow}>
                    <div className={styles.specCol}>
                      <span className={styles.specLabel}>Registration</span>
                      <span className={styles.specVal}>Verified Title</span>
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
                      <span>View Project</span>
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
