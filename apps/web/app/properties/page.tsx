"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Filter,
  MapPin,
  Bed,
  Bath,
  Maximize2,
  Heart,
  SlidersHorizontal,
  ArrowRight,
  Check,
  X,
  Layers,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  propertyApi,
  favoriteApi,
  Property,
  PropertyCategory,
  PropertyLocation,
} from "../../lib/api";
import styles from "./properties.module.css";

function PropertiesCatalogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  // Lookups
  const [categories, setCategories] = useState<PropertyCategory[]>([]);
  const [locations, setLocations] = useState<PropertyLocation[]>([]);

  // Filter State
  const [selectedCategory, setSelectedCategory] = useState<string>(
    searchParams.get("category_id") || "all"
  );
  const [selectedLocation, setSelectedLocation] = useState<string>(
    searchParams.get("location_id") || "all"
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    searchParams.get("q") || ""
  );
  const [minBedrooms, setMinBedrooms] = useState<number>(0);
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");

  // Data State
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [comparedIds, setComparedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Load Lookups
  useEffect(() => {
    propertyApi.getCategories().then((res) => {
      const cats = res.data?.categories || res.data?.data || (res.data as any) || [];
      if (Array.isArray(cats)) setCategories(cats);
    });
    propertyApi.getLocations().then((res) => {
      const locs = res.data?.locations || res.data?.data || (res.data as any) || [];
      if (Array.isArray(locs)) setLocations(locs);
    });
  }, []);

  // Load User Favorites if authenticated buyer
  useEffect(() => {
    if (isAuthenticated && user?.role === "buyer") {
      favoriteApi.list().then((res) => {
        const favs = res.data?.favorites || res.data?.data || [];
        if (Array.isArray(favs)) {
          setFavoritedIds(new Set(favs.map((f: any) => f.property_id || f.id)));
        }
      });
    }
  }, [isAuthenticated, user]);

  // Load Properties
  const loadProperties = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await propertyApi.listPublic({
        category_id: selectedCategory === "all" ? undefined : selectedCategory,
        location_id: selectedLocation === "all" ? undefined : selectedLocation,
        search: searchQuery.trim() || undefined,
        min_bedrooms: minBedrooms > 0 ? minBedrooms : undefined,
        min_price: minPrice ? Number(minPrice) : undefined,
        max_price: maxPrice ? Number(maxPrice) : undefined,
        status: "active",
      });

      const list =
        res.data?.properties ||
        res.data?.items ||
        res.data?.data ||
        (Array.isArray(res.data) ? res.data : []);

      if (Array.isArray(list)) {
        setProperties(list);
      } else {
        setProperties([]);
      }
    } catch {
      setFeedback("Failed to load property listings. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedLocation, searchQuery, minBedrooms, minPrice, maxPrice]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  const handleResetFilters = () => {
    setSelectedCategory("all");
    setSelectedLocation("all");
    setSearchQuery("");
    setMinBedrooms(0);
    setMinPrice("");
    setMaxPrice("");
  };

  const toggleFavorite = async (propertyId: string) => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/properties`);
      return;
    }

    if (favoritedIds.has(propertyId)) {
      await favoriteApi.remove(propertyId);
      setFavoritedIds((prev) => {
        const next = new Set(prev);
        next.delete(propertyId);
        return next;
      });
    } else {
      await favoriteApi.add(propertyId);
      setFavoritedIds((prev) => {
        const next = new Set(prev);
        next.add(propertyId);
        return next;
      });
    }
  };

  const toggleCompare = (propertyId: string) => {
    setComparedIds((prev) => {
      if (prev.includes(propertyId)) {
        return prev.filter((id) => id !== propertyId);
      } else {
        if (prev.length >= 4) {
          alert("You can compare up to 4 residences simultaneously.");
          return prev;
        }
        return [...prev, propertyId];
      }
    });
  };

  return (
    <div className={styles.catalogWrapper}>
      {/* Top Header */}
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
            </svg>
          </div>
          <span>Sola Properties</span>
        </Link>

        <nav className={styles.headerNav}>
          <Link href="/" className={styles.navLink}>
            Home
          </Link>
          <Link href="/properties" className={`${styles.navLink} ${styles.navLinkActive}`}>
            Properties
          </Link>
          <Link href="/projects" className={styles.navLink}>
            Developments
          </Link>
          {comparedIds.length > 0 ? (
            <Link
              href={`/properties/compare?ids=${comparedIds.join(",")}`}
              className={styles.navLink}
              style={{ color: "#059669" }}
            >
              Compare ({comparedIds.length})
            </Link>
          ) : (
            <Link href="/properties/compare" className={styles.navLink}>
              Compare
            </Link>
          )}
          <Link href="/dashboard" className={styles.navLink}>
            Dashboard
          </Link>
        </nav>

        <div className={styles.headerRight}>
          {isAuthenticated && user ? (
            <Link href="/dashboard" className={styles.authBtn}>
              Dashboard ({user.role})
            </Link>
          ) : (
            <>
              <Link href="/login" className={styles.authBtnOutline}>
                Sign In
              </Link>
              <Link href="/register" className={styles.authBtn}>
                Register
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Cadastral Filter Ribbon */}
      <section className={styles.filterRibbon}>
        <div className={styles.filterHeaderRow}>
          <div>
            <span className={styles.pretitle}>Verified Property Catalog</span>
            <h1 className={styles.pageTitle}>Architectural Residences in Addis Ababa</h1>
          </div>
          <button type="button" onClick={loadProperties} className={styles.resetBtn}>
            <RefreshCw size={13} style={{ display: "inline", marginRight: 6 }} />
            Refresh
          </button>
        </div>

        {/* Multi-facet inputs */}
        <div className={styles.filterInputsGrid}>
          {/* Keyword Search */}
          <div className={styles.searchBox}>
            <Search size={16} color="#8c95a6" />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by title, specs, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Location Select */}
          <select
            className={styles.filterSelect}
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
          >
            <option value="all">All Prime Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} {loc.sub_city ? `(${loc.sub_city})` : ""}
              </option>
            ))}
          </select>

          {/* Min Bedrooms */}
          <select
            className={styles.filterSelect}
            value={minBedrooms}
            onChange={(e) => setMinBedrooms(Number(e.target.value))}
          >
            <option value={0}>Any Bedrooms</option>
            <option value={1}>1+ Bedrooms</option>
            <option value={2}>2+ Bedrooms</option>
            <option value={3}>3+ Bedrooms</option>
            <option value={4}>4+ Bedrooms</option>
          </select>

          {/* Price Range */}
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="number"
              placeholder="Min $"
              className={styles.filterSelect}
              style={{ width: "50%" }}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
            <input
              type="number"
              placeholder="Max $"
              className={styles.filterSelect}
              style={{ width: "50%" }}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>

          <button type="button" className={styles.resetBtn} onClick={handleResetFilters}>
            Reset
          </button>
        </div>

        {/* Category Pills */}
        <div className={styles.categoryPillsRow}>
          <button
            type="button"
            className={`${styles.categoryPill} ${
              selectedCategory === "all" ? styles.categoryPillActive : ""
            }`}
            onClick={() => setSelectedCategory("all")}
          >
            All Typologies
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`${styles.categoryPill} ${
                selectedCategory === cat.id ? styles.categoryPillActive : ""
              }`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </section>

      {/* Main Catalog View */}
      <main className={styles.catalogContent}>
        <div className={styles.resultsMetaBar}>
          <div className={styles.resultsCount}>
            Showing <strong>{properties.length}</strong> verified residences
          </div>
          {comparedIds.length > 0 && (
            <span style={{ fontSize: "0.82rem", color: "#059669", fontWeight: 700 }}>
              {comparedIds.length} residences selected for comparison
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#6b7280" }}>
            <div
              style={{
                width: 36,
                height: 36,
                border: "3px solid #000000",
                borderTopColor: "transparent",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 16px",
              }}
            />
            <p style={{ fontWeight: 800, fontSize: "0.9rem", letterSpacing: "0.04em" }}>
              QUERYING VERIFIED MUNICIPAL RESIDENCES...
            </p>
          </div>
        ) : properties.length === 0 ? (
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              padding: "60px 40px",
              textAlign: "center",
            }}
          >
            <Layers size={36} color="#9ca3af" style={{ margin: "0 auto 12px" }} />
            <h3 style={{ fontSize: "1.2rem", fontWeight: 850, margin: "0 0 8px" }}>
              No Residences Match Current Filters
            </h3>
            <p style={{ color: "#6b7280", fontSize: "0.9rem", maxWidth: 460, margin: "0 auto 20px" }}>
              Try broadening your price parameters, clearing keyword searches, or selecting another prime location.
            </p>
            <button type="button" onClick={handleResetFilters} className={styles.authBtn}>
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className={styles.propertyGrid}>
            {properties.map((prop) => {
              const isFavorited = favoritedIds.has(prop.id);
              const isCompared = comparedIds.includes(prop.id);
              const primaryImg =
                prop.images && prop.images.length > 0
                  ? prop.images[0]?.image_url
                  : "/property-penthouse.jpg";

              return (
                <div key={prop.id} className={styles.propertyCard}>
                  {/* Image */}
                  <div className={styles.cardImageWrapper}>
                    <img
                      src={primaryImg}
                      alt={prop.title}
                      className={styles.cardImage}
                    />
                    <span className={styles.cardBadgeTopLeft}>
                      {prop.status === "active" ? "Verified Available" : prop.status}
                    </span>

                    <button
                      type="button"
                      className={styles.cardFavoriteBtn}
                      onClick={() => toggleFavorite(prop.id)}
                      title={isFavorited ? "Remove from Favorites" : "Save to Favorites"}
                    >
                      <Heart
                        size={17}
                        color={isFavorited ? "#dc2626" : "#6b7280"}
                        fill={isFavorited ? "#dc2626" : "none"}
                      />
                    </button>
                  </div>

                  {/* Body */}
                  <div className={styles.cardBody}>
                    <span className={styles.cardCategory}>
                      {prop.category_name || "RESIDENCE"}
                    </span>
                    <h3 className={styles.cardTitle}>{prop.title}</h3>
                    <div className={styles.cardLocation}>
                      <MapPin size={13} color="#9ca3af" />
                      <span>{prop.location_name || prop.address || "Addis Ababa, Ethiopia"}</span>
                    </div>

                    <div className={styles.cardSpecsRow}>
                      <span className={styles.specItem}>
                        <Maximize2 size={13} color="#9ca3af" />
                        {prop.size_sqm ? `${prop.size_sqm} m²` : "N/A"}
                      </span>
                      <span className={styles.specItem}>
                        <Bed size={13} color="#9ca3af" />
                        {prop.bedrooms ?? 0} Beds
                      </span>
                      <span className={styles.specItem}>
                        <Bath size={13} color="#9ca3af" />
                        {prop.bathrooms ?? 0} Baths
                      </span>
                    </div>

                    <div className={styles.cardPriceRow}>
                      <div>
                        <span className={styles.cardPrice}>
                          ${Number(prop.price).toLocaleString()}
                        </span>
                        <span className={styles.cardPriceSub}>USD</span>
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280", textTransform: "capitalize" }}>
                        {prop.payment_plan ? `${prop.payment_plan}` : "Direct"}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className={styles.cardActions}>
                      <Link href={`/properties/${prop.id}`} className={styles.inspectBtn}>
                        <span>Inspect Residence</span>
                        <ArrowRight size={14} />
                      </Link>

                      <button
                        type="button"
                        className={`${styles.compareCheckBtn} ${
                          isCompared ? styles.compareCheckBtnActive : ""
                        }`}
                        onClick={() => toggleCompare(prop.id)}
                        title="Add to side-by-side spec comparison"
                      >
                        {isCompared ? <Check size={14} /> : null}
                        <span>{isCompared ? "Compared" : "Compare"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Compare Tray */}
      {comparedIds.length > 0 && (
        <div className={styles.compareTray}>
          <div className={styles.trayText}>
            <strong>{comparedIds.length}</strong> Residences Selected for Architectural Comparison
          </div>

          <Link
            href={`/properties/compare?ids=${comparedIds.join(",")}`}
            className={styles.trayActionBtn}
          >
            Launch Comparison Matrix →
          </Link>

          <button
            type="button"
            className={styles.trayClearBtn}
            onClick={() => setComparedIds([])}
          >
            Clear Tray
          </button>
        </div>
      )}
    </div>
  );
}

export default function PropertiesCatalogPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading Catalog...</div>}>
      <PropertiesCatalogContent />
    </Suspense>
  );
}
