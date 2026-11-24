"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Building,
  X,
  ArrowRight,
  Check,
  AlertCircle,
  Columns2,
} from "lucide-react";
import { Property, propertyApi } from "../../../lib/api";
import { Navbar } from "../../components/Navbar";
import styles from "./compare.module.css";

function CompareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids") || "";

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const idList = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (idList.length === 0) {
      setProperties([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    async function fetchComparison() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await propertyApi.compare(idList);
        if (mounted) {
          if (res.ok && res.data) {
            const list = res.data.properties || res.data.data || [];
            setProperties(list);
          } else {
            setErrorMsg(res.message || "Failed to load properties for comparison.");
          }
        }
      } catch (err: any) {
        if (mounted) {
          setErrorMsg(err.message || "Network error loading comparison.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchComparison();
    return () => {
      mounted = false;
    };
  }, [idsParam]);

  const handleRemoveProperty = (removeId: string) => {
    const updated = properties.filter((p) => p.id !== removeId);
    setProperties(updated);
    const newIds = updated.map((p) => p.id).join(",");
    if (newIds) {
      router.push(`/properties/compare?ids=${newIds}`);
    } else {
      router.push("/properties/compare");
    }
  };

  return (
    <div className={styles.compareWrapper}>
      <Navbar />

      <main className={styles.mainContent}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Property Comparison</h1>
            <p className={styles.pageSubtitle}>
              Side-by-side comparison of selected properties. Compare prices, bedrooms, area, and key features.
            </p>
          </div>
        </div>

        {loading ? (
          <div className={styles.emptyState}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
              Loading comparison data...
            </h3>
            <p style={{ color: "#6b7280" }}>
              Comparing property specifications and features.
            </p>
          </div>
        ) : errorMsg ? (
          <div className={styles.emptyState}>
            <AlertCircle size={32} color="#dc2626" style={{ marginBottom: 12 }} />
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800 }}>
              Comparison Query Error
            </h3>
            <p style={{ color: "#6b7280" }}>{errorMsg}</p>
          </div>
        ) : properties.length === 0 ? (
          <div className={styles.emptyState}>
            <Columns2 size={40} color="#9ca3af" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 8px" }}>
              No Properties Selected for Comparison
            </h3>
            <p style={{ color: "#6b7280", marginBottom: 24, maxWidth: 500, margin: "0 auto 24px" }}>
              Browse our property catalog and select the "Compare" checkbox on multiple properties to evaluate them side-by-side.
            </p>
            <Link
              href="/properties"
              className={styles.actionBtn}
              style={{ display: "inline-flex", width: "auto", padding: "0 28px" }}
            >
              <span>Explore Listings</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className={styles.compareTableCard}>
            <table className={styles.compareTable}>
              <thead>
                <tr>
                  <th className={styles.specRowHeader}>Property Feature</th>
                  {properties.map((prop) => {
                    const thumbUrl =
                      prop.images?.[0]?.image_url ||
                      (prop as any).image_url ||
                      (prop as any).primary_image_url ||
                      null;

                    return (
                      <th key={prop.id} className={styles.propTopCell}>
                        <button
                          type="button"
                          className={styles.removeColBtn}
                          onClick={() => handleRemoveProperty(prop.id)}
                          title="Remove from comparison"
                        >
                          <X size={14} />
                        </button>
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={prop.title}
                            className={styles.propThumb}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: 120,
                              backgroundColor: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              marginBottom: 8,
                            }}
                          >
                            <Building size={24} color="#cbd5e1" />
                          </div>
                        )}
                        <h4 className={styles.propColTitle}>{prop.title}</h4>
                        <div className={styles.propColPrice}>
                          {Number(prop.price).toLocaleString()} ETB
                        </div>
                        <Link
                          href={`/properties/${prop.id}`}
                          className={styles.actionBtn}
                        >
                          <span>View Property</span>
                        </Link>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.specRowHeader}>Category</td>
                  {properties.map((p) => (
                    <td key={p.id} className={styles.specCell}>
                      {p.category_name || "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className={styles.specRowHeader}>Location / District</td>
                  {properties.map((p) => (
                    <td key={p.id} className={styles.specCell}>
                      {p.location_name || p.address || "Addis Ababa"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className={styles.specRowHeader}>Total Area</td>
                  {properties.map((p) => (
                    <td key={p.id} className={styles.specCell}>
                      <strong>{p.size_sqm ? `${p.size_sqm} m²` : "—"}</strong>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className={styles.specRowHeader}>Price per m²</td>
                  {properties.map((p) => {
                    const pricePerSqm =
                      p.size_sqm && p.size_sqm > 0
                        ? Math.round(Number(p.price) / Number(p.size_sqm))
                        : null;
                    return (
                      <td key={p.id} className={styles.specCell}>
                        {pricePerSqm ? `${pricePerSqm.toLocaleString()} ETB / m²` : "—"}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className={styles.specRowHeader}>Bedrooms</td>
                  {properties.map((p) => (
                    <td key={p.id} className={styles.specCell}>
                      {p.bedrooms ?? "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className={styles.specRowHeader}>Bathrooms</td>
                  {properties.map((p) => (
                    <td key={p.id} className={styles.specCell}>
                      {p.bathrooms ?? "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className={styles.specRowHeader}>Payment Terms</td>
                  {properties.map((p) => (
                    <td
                      key={p.id}
                      className={styles.specCell}
                      style={{ textTransform: "capitalize" }}
                    >
                      {p.payment_plan || "Cash"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className={styles.specRowHeader}>Amenities</td>
                  {properties.map((p) => (
                    <td key={p.id} className={styles.specCell}>
                      {p.features && p.features.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {p.features.map((feat, i) => (
                            <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem" }}>
                              <Check size={12} color="#10b981" />
                              {feat}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>Standard Finishes</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 48, textAlign: "center", fontFamily: "Syne" }}>
          Loading property comparison...
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
