"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Heart,
  Share2,
  Calendar,
  MessageSquare,
  MapPin,
  Maximize2,
  Check,
  X,
  Building,
  User,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Columns2,
} from "lucide-react";
import {
  Property,
  PropertyImage,
  propertyApi,
  referralApi,
  visitApi,
  favoriteApi,
} from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { Navbar } from "../../components/Navbar";
import styles from "./property-detail.module.css";

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const propertyId = params?.id as string;

  const [property, setProperty] = useState<Property | null>(null);
  const [images, setImages] = useState<PropertyImage[]>([]);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  // Inquire Modal
  const [inquireOpen, setInquireOpen] = useState(false);
  const [inquireMsg, setInquireMsg] = useState(
    "Hello, I am interested in this property and would like to receive verified documentation and financing options."
  );
  const [inquireSubmitting, setInquireSubmitting] = useState(false);
  const [inquireStatus, setInquireStatus] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  // Schedule Tour Modal
  const [tourOpen, setTourOpen] = useState(false);
  const [tourDate, setTourDate] = useState("");
  const [tourLocation, setTourLocation] = useState("");
  const [tourNotes, setTourNotes] = useState("");
  const [tourSubmitting, setTourSubmitting] = useState(false);
  const [tourStatus, setTourStatus] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  useEffect(() => {
    if (!propertyId) return;

    let mounted = true;
    async function loadData() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await propertyApi.getPublic(propertyId);
        if (mounted) {
          if (res.ok && res.data) {
            const propData = res.data.property || res.data.data || (res.data as any);
            setProperty(propData);
            if (propData.images && propData.images.length > 0) {
              setImages(propData.images);
            } else {
              // Try fetching images explicitly
              const imgRes = await propertyApi.getImages(propertyId);
              if (imgRes.ok && imgRes.data) {
                const imgList = imgRes.data.images || imgRes.data.data || [];
                setImages(imgList);
              }
            }
          } else {
            setErrorMsg(res.message || "Property not found or inactive.");
          }
        }
      } catch (err: any) {
        if (mounted) {
          setErrorMsg(err.message || "Failed to load property details.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();

    // Check favorite status if authenticated buyer
    if (isAuthenticated && user?.role === "buyer") {
      favoriteApi.list().then((favRes) => {
        if (mounted && favRes.ok && favRes.data) {
          const list = favRes.data.favorites || favRes.data.data || [];
          const matched = list.some(
            (fav: any) =>
              fav.property_id === propertyId || fav.property?.id === propertyId
          );
          setIsFavorite(matched);
        }
      }).catch(() => {
        // Silently ignore if favorites call fails
      });
    }

    return () => {
      mounted = false;
    };
  }, [propertyId, isAuthenticated, user]);

  const handleToggleFavorite = async () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/properties/${propertyId}`);
      return;
    }
    if (user?.role !== "buyer") {
      return;
    }
    setFavLoading(true);
    try {
      if (isFavorite) {
        await favoriteApi.remove(propertyId);
        setIsFavorite(false);
      } else {
        await favoriteApi.add(propertyId);
        setIsFavorite(true);
      }
    } catch {
      // Toggle failure
    } finally {
      setFavLoading(false);
    }
  };

  const handleInquireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      router.push(`/login?redirect=/properties/${propertyId}`);
      return;
    }
    setInquireSubmitting(true);
    setInquireStatus(null);
    try {
      const res = await referralApi.createReferral({
        propertyId,
        message: inquireMsg.trim(),
      });
      if (res.ok) {
        setInquireStatus({
          ok: true,
          msg: "Your inquiry has been submitted! An assigned real estate advisor will connect with you via your dashboard.",
        });
        setTimeout(() => {
          setInquireOpen(false);
          setInquireStatus(null);
        }, 2200);
      } else {
        setInquireStatus({
          ok: false,
          msg: res.message || "Failed to submit inquiry. Please try again.",
        });
      }
    } catch (err: any) {
      setInquireStatus({
        ok: false,
        msg: err.message || "Network error. Please try again.",
      });
    } finally {
      setInquireSubmitting(false);
    }
  };

  const handleTourSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      router.push(`/login?redirect=/properties/${propertyId}`);
      return;
    }

    if (!tourDate) {
      setTourStatus({ ok: false, msg: "Please select a tour date and time in the future." });
      return;
    }

    const isoDate = new Date(tourDate).toISOString();
    setTourSubmitting(true);
    setTourStatus(null);
    try {
      const res = await visitApi.createBuyerVisitRequest({
        requestedAt: isoDate,
        location: tourLocation.trim() || property?.location_name || property?.address || "On-Site Tour",
        notes: tourNotes.trim() || undefined,
      });

      if (res.ok) {
        setTourStatus({
          ok: true,
          msg: "Visit requested successfully! You can track scheduling confirmation under Dashboard > Tours.",
        });
        setTimeout(() => {
          setTourOpen(false);
          setTourStatus(null);
        }, 2200);
      } else {
        setTourStatus({
          ok: false,
          msg: res.message || "Failed to schedule tour. Please try another date/time.",
        });
      }
    } catch (err: any) {
      setTourStatus({
        ok: false,
        msg: err.message || "Network error. Please try again.",
      });
    } finally {
      setTourSubmitting(false);
    }
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      showToast("Property link copied to clipboard!", "success");
    }
  };

  // Live photo URLs from backend
  const photoUrls: string[] = images.map((img) => img.image_url);

  if (loading) {
    return (
      <div className={styles.detailWrapper}>
        <Navbar />
        <div style={{ textAlign: "center", padding: "120px 20px" }}>
          <div
            style={{
              fontSize: "1.2rem",
              fontWeight: 700,
            }}
          >
            Loading property details...
          </div>
          <p style={{ color: "#6b7280", marginTop: 8 }}>
            Please wait a moment.
          </p>
        </div>
      </div>
    );
  }

  if (errorMsg || !property) {
    return (
      <div className={styles.detailWrapper}>
        <Navbar />
        <div style={{ maxWidth: 600, margin: "100px auto", padding: 32, backgroundColor: "#fff", border: "2px solid #000" }}>
          <AlertCircle size={32} color="#dc2626" style={{ marginBottom: 16 }} />
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "0 0 12px" }}>
            Property Unavailable
          </h2>
          <p style={{ color: "#4b5563", marginBottom: 24, lineHeight: 1.6 }}>
            {errorMsg || "The requested property listing could not be found or has been withdrawn from public discovery."}
          </p>
          <Link
            href="/properties"
            className={styles.primaryCtaBtn}
            style={{ textDecoration: "none", display: "inline-flex" }}
          >
            <ArrowLeft size={16} />
            <span>Return to Catalog</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.detailWrapper}>
      {/* Top Common Navbar */}
      <Navbar />

      {/* Breadcrumb Bar */}
      <div className={styles.breadcrumbBar} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link href="/" className={styles.breadcrumbLink}>
            Home
          </Link>
          <span>/</span>
          <Link href="/properties" className={styles.breadcrumbLink}>
            Properties
          </Link>
          <span>/</span>
          <span className={styles.breadcrumbActive}>{property.title}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={handleShare}
            className={styles.secondaryCtaBtn}
            style={{ height: 34, padding: "0 12px", margin: 0, fontSize: "0.78rem" }}
          >
            <Share2 size={13} />
            <span>Share</span>
          </button>
          <Link
            href={`/properties/compare?ids=${property.id}`}
            className={styles.secondaryCtaBtn}
            style={{ height: 34, padding: "0 12px", margin: 0, fontSize: "0.78rem", textDecoration: "none" }}
          >
            <Columns2 size={13} />
            <span>Compare</span>
          </Link>
        </div>
      </div>

      {/* Main Content Layout */}
      <main className={styles.detailContent}>
        <div className={styles.detailGrid}>
          {/* Left Column: Gallery & Details */}
          <div>
            {/* Gallery Card */}
            <div className={styles.galleryCard}>
              {photoUrls.length > 0 ? (
                <>
                  <div className={styles.mainPhotoWrapper}>
                    <img
                      src={photoUrls[activePhotoIdx] || photoUrls[0]}
                      alt={property.title}
                      className={styles.mainPhoto}
                    />
                  </div>

                  {photoUrls.length > 1 && (
                    <div className={styles.thumbnailStrip}>
                      {photoUrls.map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`${styles.thumbnailBtn} ${
                            activePhotoIdx === idx ? styles.thumbnailBtnActive : ""
                          }`}
                          onClick={() => setActivePhotoIdx(idx)}
                        >
                          <img
                            src={url}
                            alt={`Photo ${idx + 1}`}
                            className={styles.thumbnailImg}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: 380,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    color: "#94a3b8",
                  }}
                >
                  <Building size={48} color="#cbd5e1" />
                  <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                    No photos uploaded yet for this property
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                    Photos will appear once uploaded by the listing agent
                  </span>
                </div>
              )}
            </div>

            {/* Property Overview Card */}
            <div className={styles.overviewCard}>
              <span className={styles.propPretitle}>
                {property.category_name || "Exclusive Listing"} &bull; Ref: {property.id.slice(0, 8).toUpperCase()}
              </span>
              <h1 className={styles.propMainTitle}>{property.title}</h1>

              <div className={styles.propLocationRow}>
                <MapPin size={18} color="#000000" />
                <span>
                  {property.location_name || property.address || "Addis Ababa, Ethiopia"}
                </span>
              </div>

              {/* Specs Bar */}
              <div className={styles.specsBar}>
                <div className={styles.specBox}>
                  <span className={styles.specLabel}>Interior Area</span>
                  <span className={styles.specValue}>
                    {property.size_sqm ? `${property.size_sqm} m²` : "—"}
                  </span>
                </div>
                <div className={styles.specBox}>
                  <span className={styles.specLabel}>Bedrooms</span>
                  <span className={styles.specValue}>
                    {property.bedrooms ?? "—"}
                  </span>
                </div>
                <div className={styles.specBox}>
                  <span className={styles.specLabel}>Bathrooms</span>
                  <span className={styles.specValue}>
                    {property.bathrooms ?? "—"}
                  </span>
                </div>
                <div className={styles.specBox}>
                  <span className={styles.specLabel}>Payment Plan</span>
                  <span className={styles.specValue} style={{ textTransform: "capitalize" }}>
                    {property.payment_plan || "Cash"}
                  </span>
                </div>
              </div>

              {/* Property Overview */}
              <h3 className={styles.sectionTitle}>Property Overview</h3>
              <p className={styles.propDescription}>
                {property.description ||
                  "A meticulously engineered living experience configured for premium privacy, structural endurance, and expansive natural light. Finished with high-specification materials adhering to strict institutional real estate standards."}
              </p>

              {/* Features & Amenities */}
              {property.features && property.features.length > 0 && (
                <>
                  <h3 className={styles.sectionTitle}>Amenities & Specifications</h3>
                  <div className={styles.featuresGrid}>
                    {property.features.map((feature, idx) => (
                      <span key={idx} className={styles.featurePill}>
                        <Check size={12} style={{ marginRight: 4, display: "inline" }} />
                        {feature}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Sticky Action Sidebar */}
          <aside className={styles.actionSidebar}>
            <div className={styles.bookingCard}>
              <div className={styles.priceHeader}>
                <div className={styles.priceDisplay}>
                  {Number(property.price).toLocaleString()}
                  <span className={styles.currencyTag}>ETB</span>
                </div>
                {property.payment_plan && (
                  <span className={styles.planBadge}>{property.payment_plan}</span>
                )}
              </div>
              <p className={styles.priceTerms}>
                Escrow settlement &bull; Verified title
              </p>

              <div className={styles.ctaGroup}>
                <button
                  type="button"
                  className={styles.primaryCtaBtn}
                  onClick={() => setInquireOpen(true)}
                >
                  <MessageSquare size={15} />
                  <span>Inquire & Request Documents</span>
                </button>

                <button
                  type="button"
                  className={styles.secondaryCtaBtn}
                  onClick={() => setTourOpen(true)}
                >
                  <Calendar size={15} />
                  <span>Schedule Private Tour</span>
                </button>

                <button
                  type="button"
                  className={`${styles.favoriteActionBtn} ${
                    isFavorite ? styles.favoriteActionBtnActive : ""
                  }`}
                  onClick={handleToggleFavorite}
                  disabled={favLoading}
                >
                  <Heart
                    size={14}
                    fill={isFavorite ? "#dc2626" : "none"}
                    color={isFavorite ? "#dc2626" : "currentColor"}
                  />
                  <span>
                    {favLoading
                      ? "Updating..."
                      : isFavorite
                      ? "Saved to Shortlist"
                      : "Save to Shortlist"}
                  </span>
                </button>
              </div>

              <div className={styles.trustDivider} />

              <div className={styles.trustBadge}>
                <ShieldCheck size={16} color="#059669" />
                <div>
                  <div className={styles.trustTitle}>Verified Sola Property</div>
                  <div className={styles.trustSubtitle}>
                    Ownership & developer registration verified
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* INQUIRE MODAL */}
      {inquireOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <button
              className={styles.modalCloseBtn}
              onClick={() => setInquireOpen(false)}
            >
              <X size={20} />
            </button>
            <h3 className={styles.modalTitle}>Request Verified Property Details</h3>
            <p className={styles.modalDesc}>
              Submit a direct inquiry for <strong>{property.title}</strong>. An authorized licensed advisor will provide comprehensive documentation.
            </p>

            {inquireStatus && (
              <div
                style={{
                  padding: 12,
                  marginBottom: 16,
                  border: `1px solid ${inquireStatus.ok ? "#10b981" : "#ef4444"}`,
                  backgroundColor: inquireStatus.ok ? "#ecfdf5" : "#fef2f2",
                  color: inquireStatus.ok ? "#065f46" : "#991b1b",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "flex",
                  gap: 8,
                }}
              >
                {inquireStatus.ok ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <AlertCircle size={18} />
                )}
                <span>{inquireStatus.msg}</span>
              </div>
            )}

            <form onSubmit={handleInquireSubmit}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Inquiry Message</label>
                <textarea
                  className={styles.formTextarea}
                  required
                  rows={4}
                  value={inquireMsg}
                  onChange={(e) => setInquireMsg(e.target.value)}
                  disabled={inquireSubmitting}
                />
              </div>

              <button
                type="submit"
                className={styles.modalSubmitBtn}
                disabled={inquireSubmitting}
              >
                <span>
                  {inquireSubmitting ? "Sending..." : "Submit Inquiry"}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE TOUR MODAL */}
      {tourOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <button
              className={styles.modalCloseBtn}
              onClick={() => setTourOpen(false)}
            >
              <X size={20} />
            </button>
            <h3 className={styles.modalTitle}>Schedule Private On-Site Tour</h3>
            <p className={styles.modalDesc}>
              Propose a scheduled appointment to visit <strong>{property.title}</strong>.
            </p>

            {tourStatus && (
              <div
                style={{
                  padding: 12,
                  marginBottom: 16,
                  border: `1px solid ${tourStatus.ok ? "#10b981" : "#ef4444"}`,
                  backgroundColor: tourStatus.ok ? "#ecfdf5" : "#fef2f2",
                  color: tourStatus.ok ? "#065f46" : "#991b1b",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "flex",
                  gap: 8,
                }}
              >
                {tourStatus.ok ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <AlertCircle size={18} />
                )}
                <span>{tourStatus.msg}</span>
              </div>
            )}

            <form onSubmit={handleTourSubmit}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Requested Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  className={styles.formInput}
                  value={tourDate}
                  onChange={(e) => setTourDate(e.target.value)}
                  disabled={tourSubmitting}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Meeting Point / Location</label>
                <input
                  type="text"
                  placeholder={property.address || property.location_name || "Property Site"}
                  className={styles.formInput}
                  value={tourLocation}
                  onChange={(e) => setTourLocation(e.target.value)}
                  disabled={tourSubmitting}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Special Notes / Requirements</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="e.g. Inquire on structural load bearings or parking space accessibility."
                  rows={3}
                  value={tourNotes}
                  onChange={(e) => setTourNotes(e.target.value)}
                  disabled={tourSubmitting}
                />
              </div>

              <button
                type="submit"
                className={styles.modalSubmitBtn}
                disabled={tourSubmitting}
              >
                <span>
                  {tourSubmitting ? "Requesting Tour..." : "Confirm Tour Request"}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
