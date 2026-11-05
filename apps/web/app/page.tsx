"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Search,
  ChevronDown,
  X,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  Bed,
  Bath,
  Maximize2,
  ArrowRight,
  FileText,
  UserCheck,
  Building2,
  SlidersHorizontal,
  Mail,
  Send,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../lib/api";
import styles from "./page.module.css";

export default function SolaPropertiesPage() {
  const { user, isAuthenticated, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"buy" | "rent">("rent");
  const [locationText, setLocationText] = useState("Bole, Addis Ababa");
  const [startText, setStartText] = useState("Dec 16, 10:00 AM");
  const [endText, setEndText] = useState("Dec 16, 11:30 AM");

  // Property Filter
  const [propCategory, setPropCategory] = useState<"all" | "penthouse" | "villa" | "apartment">("all");

  // Property Consultation & Direct Match State
  const [consultLocation, setConsultLocation] = useState("Bole");
  const [consultType, setConsultType] = useState<"buy" | "rent">("buy");
  const [consultContact, setConsultContact] = useState("");
  const [consultSubmitted, setConsultSubmitted] = useState(false);

  // Auth / Contact Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authRole, setAuthRole] = useState<"buyer" | "agent" | "developer">("buyer");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [fullNameInput, setFullNameInput] = useState("");
  const [formFeedback, setFormFeedback] = useState<string | null>(null);

  // Newsletter State
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormFeedback("Connecting to Sola API...");
    try {
      if (authMode === "login") {
        const res = await authApi.login({
          email: emailInput.trim(),
          password: passwordInput,
        });
        if (!res.ok) {
          throw new Error(res.message || "Login failed");
        }
        setFormFeedback(res.message || "Signed in successfully!");
      } else {
        const res = await authApi.register({
          fullName: fullNameInput.trim(),
          email: emailInput.trim(),
          password: passwordInput,
          role: authRole,
        });
        if (!res.ok) {
          throw new Error(res.message || "Registration failed");
        }
        setFormFeedback(res.message || "Account registered successfully!");
      }
      setTimeout(() => setIsModalOpen(false), 1000);
    } catch (err: any) {
      setFormFeedback(err.message || "Failed to process request.");
    }
  };

  return (
    <div className={styles.mainWrapper}>
      {/* Top Header */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#000000"
              strokeWidth="2.5"
              strokeLinecap="square"
              strokeLinejoin="miter"
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
        </div>

        <nav className={styles.nav}>
          <a href="#home" className={styles.navItem}>
            Home
          </a>
          <a href="#residences" className={styles.navItem}>
            Residences
          </a>
          <a href="#services" className={styles.navItem}>
            Services
          </a>
          <a href="#system" className={styles.navItem}>
            Our System
          </a>
        </nav>

        <div className={styles.headerRight}>
          <div className={styles.langSelector}>
            <span role="img" aria-label="UK flag" style={{ fontSize: "1.1rem" }}>
              🇬🇧
            </span>
            <span>En</span>
            <ChevronDown size={14} />
          </div>

          {isAuthenticated && user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Link
                href="/dashboard"
                className={styles.contactBtn}
                style={{ textDecoration: "none", display: "inline-block" }}
              >
                Dashboard ({user.role})
              </Link>
              <button
                type="button"
                onClick={() => logout()}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "#6a717e",
                  cursor: "pointer",
                }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className={styles.navItem}
                style={{ fontWeight: 700, color: "#000000" }}
              >
                Sign In
              </Link>

              <Link
                href="/register"
                className={styles.contactBtn}
                style={{ textDecoration: "none", display: "inline-block" }}
              >
                Register
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className={styles.hero} id="home">
        {/* Left Side Content */}
        <div className={styles.heroLeft}>
          <h1 className={styles.heroTitle}>
            Easiest way to find
            <br />
            your dream place
          </h1>

          <p className={styles.heroSubtitle}>
            this is where you can find a dream place for you of
            <br />
            various types, all over the world at affordable prices.
          </p>

          {/* Search Tabs & Box Overlapping Right Image */}
          <div className={styles.searchWrapper}>
            <div className={styles.searchTabs}>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === "buy" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("buy")}
              >
                Buy
                {activeTab === "buy" && <span className={styles.tabIndicator} />}
              </button>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === "rent" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("rent")}
              >
                Rent
                {activeTab === "rent" && <span className={styles.tabIndicator} />}
              </button>
            </div>

            <div className={styles.searchBox}>
              <div className={styles.searchItem}>
                <label className={styles.searchItemLabel}>Location</label>
                <input
                  type="text"
                  className={styles.searchItemValue}
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="e.g. Bole, Addis Ababa"
                />
              </div>

              <div className={styles.divider} />

              <div className={styles.searchItem}>
                <label className={styles.searchItemLabel}>Start</label>
                <input
                  type="text"
                  className={styles.searchItemValue}
                  value={startText}
                  onChange={(e) => setStartText(e.target.value)}
                />
              </div>

              <div className={styles.divider} />

              <div className={styles.searchItem}>
                <label className={styles.searchItemLabel}>End</label>
                <input
                  type="text"
                  className={styles.searchItemValue}
                  value={endText}
                  onChange={(e) => setEndText(e.target.value)}
                />
              </div>

              <button
                type="button"
                className={styles.searchIconBtn}
                aria-label="Search properties"
                onClick={() => {
                  const target = document.getElementById("residences");
                  target?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <Search size={20} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          {/* 3 Proof Stats (200, 500+, 100+) */}
          <div className={styles.statsRow}>
            <div className={styles.statBlock}>
              <span className={styles.statNum}>200</span>
              <span className={styles.statLabel}>
                Awward
                <br />
                Winning
              </span>
            </div>

            <div className={styles.statBlock}>
              <span className={styles.statNum}>500+</span>
              <span className={styles.statLabel}>
                Happy
                <br />
                Costumer
              </span>
            </div>

            <div className={styles.statBlock}>
              <span className={styles.statNum}>100+</span>
              <span className={styles.statLabel}>
                Property
                <br />
                Ready
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Building Hero Visual Attached Directly to Right Edge */}
        <div className={styles.heroRight}>
          <div className={styles.buildingFrame}>
            <Image
              src="/building-nobg.png"
              alt="Contemporary architectural luxury building"
              width={1024}
              height={860}
              priority
              className={styles.buildingImg}
            />

            {/* Circular Rotating Badge Directly Over Image */}
            <div className={styles.sticker}>
              <svg className={styles.stickerSvg} viewBox="0 0 100 100">
                <path
                  id="circlePath"
                  d="M 50, 50 m -35, 0 a 35,35 0 1,1 70,0 a 35,35 0 1,1 -70,0"
                  fill="none"
                />
                <text fontSize="8.8" fontWeight="800" fill="#000000" letterSpacing="2.1">
                  <textPath href="#circlePath" startOffset="0%">
                    SOLANOVA • TECH • SOLUTIONS
                  </textPath>
                </text>
              </svg>
              <div className={styles.stickerCenterArrow}>
                <ArrowUpRight size={22} strokeWidth={2.5} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* SECTION 1: Popular Residences (Clean, Borderless Floating Cards) */}
      <section className={styles.sectionBlock} id="residences">
        <div className={styles.sectionHeadingRow}>
          <div>
            <h2 className={styles.sectionMainTitle}>Popular Residences</h2>
            <p className={styles.sectionMainSubtitle}>
              Hand-curated architectural homes inspected for title verification and construction quality.
            </p>
          </div>

          <div className={styles.categoryFilterGroup}>
            {(["all", "penthouse", "villa", "apartment"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                className={`${styles.filterBtn} ${propCategory === cat ? styles.filterBtnActive : ""}`}
                onClick={() => setPropCategory(cat)}
              >
                {cat === "all" ? "All Types" : cat.charAt(0).toUpperCase() + cat.slice(1) + "s"}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.cardsGrid}>
          {/* Card 1: Horizon Penthouse */}
          {(propCategory === "all" || propCategory === "penthouse") && (
            <article className={styles.sharpCard}>
              <div className={styles.cardImgWrap}>
                <Image
                  src="/property-penthouse.jpg"
                  alt="Grand Horizon Penthouse"
                  width={640}
                  height={400}
                  className={styles.cardImg}
                />
                <div className={styles.cardTagRow}>
                  <div className={styles.verifiedPill}>
                    <ShieldCheck size={14} />
                    <span>Verified Title</span>
                  </div>
                  <div className={styles.cardPricePill}>$420,000</div>
                </div>
              </div>

              <div className={styles.cardContent}>
                <h3 className={styles.cardTitle}>Grand Horizon Penthouse</h3>
                <div className={styles.cardLoc}>
                  <MapPin size={15} />
                  <span>Bole Atlantic, Addis Ababa</span>
                </div>

                <div className={styles.cardSpecsRow}>
                  <div className={styles.specItem}>
                    <Bed size={15} />
                    <span><strong className={styles.specVal}>3</strong> Beds</span>
                  </div>
                  <div className={styles.specItem}>
                    <Bath size={15} />
                    <span><strong className={styles.specVal}>3.5</strong> Baths</span>
                  </div>
                  <div className={styles.specItem}>
                    <Maximize2 size={15} />
                    <span><strong className={styles.specVal}>280</strong> m²</span>
                  </div>
                </div>

                <div className={styles.cardActionRow}>
                  <button
                    type="button"
                    className={styles.btnCardPrimary}
                    onClick={() => {
                      setAuthMode("login");
                      setIsModalOpen(true);
                    }}
                  >
                    Schedule Visit
                  </button>
                  <button
                    type="button"
                    className={styles.btnCardOutline}
                    onClick={() => alert("Details: Grand Horizon Penthouse with panoramic terrace.")}
                  >
                    Specs
                  </button>
                </div>
              </div>
            </article>
          )}

          {/* Card 2: Olive Sanctuary Villa */}
          {(propCategory === "all" || propCategory === "villa") && (
            <article className={styles.sharpCard}>
              <div className={styles.cardImgWrap}>
                <Image
                  src="/property-villa.jpg"
                  alt="The Olive Sanctuary Villa"
                  width={640}
                  height={400}
                  className={styles.cardImg}
                />
                <div className={styles.cardTagRow}>
                  <div className={styles.verifiedPill}>
                    <ShieldCheck size={14} />
                    <span>Direct Developer</span>
                  </div>
                  <div className={styles.cardPricePill}>$680,000</div>
                </div>
              </div>

              <div className={styles.cardContent}>
                <h3 className={styles.cardTitle}>The Olive Sanctuary Villa</h3>
                <div className={styles.cardLoc}>
                  <MapPin size={15} />
                  <span>Old Airport Diplomatic Zone</span>
                </div>

                <div className={styles.cardSpecsRow}>
                  <div className={styles.specItem}>
                    <Bed size={15} />
                    <span><strong className={styles.specVal}>5</strong> Beds</span>
                  </div>
                  <div className={styles.specItem}>
                    <Bath size={15} />
                    <span><strong className={styles.specVal}>6</strong> Baths</span>
                  </div>
                  <div className={styles.specItem}>
                    <Maximize2 size={15} />
                    <span><strong className={styles.specVal}>520</strong> m²</span>
                  </div>
                </div>

                <div className={styles.cardActionRow}>
                  <button
                    type="button"
                    className={styles.btnCardPrimary}
                    onClick={() => {
                      setAuthMode("login");
                      setIsModalOpen(true);
                    }}
                  >
                    Schedule Visit
                  </button>
                  <button
                    type="button"
                    className={styles.btnCardOutline}
                    onClick={() => alert("Details: Olive Sanctuary Villa with private pool and gardens.")}
                  >
                    Specs
                  </button>
                </div>
              </div>
            </article>
          )}

          {/* Card 3: Urban Skyline Residence */}
          {(propCategory === "all" || propCategory === "apartment") && (
            <article className={styles.sharpCard}>
              <div className={styles.cardImgWrap}>
                <Image
                  src="/hero-building.jpg"
                  alt="Metropolitan Skyline Residences"
                  width={640}
                  height={400}
                  className={styles.cardImg}
                />
                <div className={styles.cardTagRow}>
                  <div className={styles.verifiedPill}>
                    <ShieldCheck size={14} />
                    <span>Pre-Construction</span>
                  </div>
                  <div className={styles.cardPricePill}>$245,000</div>
                </div>
              </div>

              <div className={styles.cardContent}>
                <h3 className={styles.cardTitle}>Metropolitan Skyline Loft</h3>
                <div className={styles.cardLoc}>
                  <MapPin size={15} />
                  <span>Kazanchis Financial District</span>
                </div>

                <div className={styles.cardSpecsRow}>
                  <div className={styles.specItem}>
                    <Bed size={15} />
                    <span><strong className={styles.specVal}>2</strong> Beds</span>
                  </div>
                  <div className={styles.specItem}>
                    <Bath size={15} />
                    <span><strong className={styles.specVal}>2</strong> Baths</span>
                  </div>
                  <div className={styles.specItem}>
                    <Maximize2 size={15} />
                    <span><strong className={styles.specVal}>145</strong> m²</span>
                  </div>
                </div>

                <div className={styles.cardActionRow}>
                  <button
                    type="button"
                    className={styles.btnCardPrimary}
                    onClick={() => {
                      setAuthMode("login");
                      setIsModalOpen(true);
                    }}
                  >
                    Schedule Visit
                  </button>
                  <button
                    type="button"
                    className={styles.btnCardOutline}
                    onClick={() => alert("Details: Modern Loft in financial center.")}
                  >
                    Specs
                  </button>
                </div>
              </div>
            </article>
          )}
        </div>
      </section>

      {/* SECTION 2: Core Platform Services (Directly Usable For Users) */}
      <section className={styles.sectionBlock} id="services" style={{ paddingTop: 0 }}>
        <div className={styles.sectionHeadingRow}>
          <div>
            <h2 className={styles.sectionMainTitle}>Core Services For You</h2>
            <p className={styles.sectionMainSubtitle}>
              Direct tools to search verified homes, book accompanied private walkthroughs, or list your property with full title protection.
            </p>
          </div>
        </div>

        <div className={styles.bentoGrid}>
          {/* Service 1: Buy & Rent Verified Residences */}
          <div 
            className={styles.bentoCard}
            style={{ cursor: "pointer" }}
            onClick={() => {
              const target = document.getElementById("residences");
              target?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <h3 className={styles.bentoTitle}>Find & Buy Verified Homes</h3>
            <p className={styles.bentoDesc}>
              Browse luxury penthouses, modern villas, and executive apartments across Addis Ababa with 100% audited land registry deeds.
            </p>
            <div className={styles.bentoActionRow}>
              <span className={styles.bentoActionText}>Browse Residences</span>
              <div className={styles.cardArrowBtn}>
                <ArrowUpRight size={22} strokeWidth={2.4} />
              </div>
            </div>
          </div>

          {/* Service 2: Schedule In-Person Walkthrough */}
          <div 
            className={styles.bentoCard}
            style={{ cursor: "pointer" }}
            onClick={() => {
              const target = document.getElementById("system");
              target?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <h3 className={styles.bentoTitle}>Book Private Walkthrough</h3>
            <p className={styles.bentoDesc}>
              Schedule an in-person property inspection or HD live video tour with an accredited local architect and receive complete architectural floor plans.
            </p>
            <div className={styles.bentoActionRow}>
              <span className={styles.bentoActionText}>Schedule Inspection</span>
              <div className={styles.cardArrowBtn}>
                <ArrowUpRight size={22} strokeWidth={2.4} />
              </div>
            </div>
          </div>

          {/* Service 3: List Your Property With Title Clearance */}
          <div 
            className={styles.bentoCard}
            style={{ cursor: "pointer" }}
            onClick={() => {
              setAuthRole("agent");
              setAuthMode("register");
              setIsModalOpen(true);
            }}
          >
            <h3 className={styles.bentoTitle}>List Your Property</h3>
            <p className={styles.bentoDesc}>
              Are you an owner, broker, or developer? Submit your residential property for legal title verification and connect directly with high-intent buyers.
            </p>
            <div className={styles.bentoActionRow}>
              <span className={styles.bentoActionText}>List Property Now</span>
              <div className={styles.cardArrowBtn}>
                <ArrowUpRight size={22} strokeWidth={2.4} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: The Sola Properties System & Usable Platform Capabilities */}
      <section className={styles.sectionBlock} id="system" style={{ paddingTop: 0 }}>
        <div className={styles.sectionHeadingRow}>
          <div>
            <h2 className={styles.sectionMainTitle}>The Sola Properties System</h2>
            <p className={styles.sectionMainSubtitle}>
              An authenticated real estate ecosystem designed for Addis Ababa. We connect home buyers, diaspora investors, licensed brokers, and verified developers with audited municipal land registry deeds.
            </p>
          </div>
        </div>

        {/* 3 Core System Role Cards (Usable Platform Pillars) */}
        <div className={styles.systemCardsGrid}>
          {/* Card 1: Buyers & Diaspora */}
          <div className={styles.systemCard}>
            <div className={styles.systemCardTop}>
              <div className={styles.systemIconBox}>
                <ShieldCheck size={26} strokeWidth={2.2} />
              </div>
              <span className={styles.systemRoleTag}>For Buyers & Diaspora</span>
            </div>
            <h3 className={styles.systemCardTitle}>Verified Residential Purchases</h3>
            <p className={styles.systemCardDesc}>
              Search authentic villas, penthouses, and apartments across Bole, Old Airport, Kazanchis, and Sarbet. Every listing is legally audited before publishing, eliminating phantom listings and duplicate broker commissions.
            </p>
            <div className={styles.systemFeatureList}>
              <div className={styles.systemFeatureItem}>
                <CheckCircle2 size={16} />
                <span>100% municipal title deed clearance</span>
              </div>
              <div className={styles.systemFeatureItem}>
                <CheckCircle2 size={16} />
                <span>Schedule direct in-person & virtual walkthroughs</span>
              </div>
              <div className={styles.systemFeatureItem}>
                <CheckCircle2 size={16} />
                <span>Zero hidden broker markup on property prices</span>
              </div>
            </div>
            <button
              type="button"
              className={styles.systemCardBtn}
              onClick={() => {
                const target = document.getElementById("residences");
                target?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <span>Explore Residences</span>
              <ArrowUpRight size={18} strokeWidth={2.4} />
            </button>
          </div>

          {/* Card 2: Licensed Brokers */}
          <div className={styles.systemCard}>
            <div className={styles.systemCardTop}>
              <div className={styles.systemIconBox}>
                <UserCheck size={26} strokeWidth={2.2} />
              </div>
              <span className={styles.systemRoleTag}>For Licensed Brokers</span>
            </div>
            <h3 className={styles.systemCardTitle}>Accredited Agent Network</h3>
            <p className={styles.systemCardDesc}>
              Empowering professional real estate agents in Ethiopia with digital licensing verification. Manage authentic client property listings, connect with pre-qualified buyers, and protect deal commissions.
            </p>
            <div className={styles.systemFeatureList}>
              <div className={styles.systemFeatureItem}>
                <CheckCircle2 size={16} />
                <span>Digital identity & broker license verification</span>
              </div>
              <div className={styles.systemFeatureItem}>
                <CheckCircle2 size={16} />
                <span>Direct client inquiries without intermediaries</span>
              </div>
              <div className={styles.systemFeatureItem}>
                <CheckCircle2 size={16} />
                <span>Automated commission tracking & audit logs</span>
              </div>
            </div>
            <button
              type="button"
              className={styles.systemCardBtn}
              onClick={() => {
                setAuthRole("agent");
                setAuthMode("register");
                setIsModalOpen(true);
              }}
            >
              <span>Join as Licensed Agent</span>
              <ArrowUpRight size={18} strokeWidth={2.4} />
            </button>
          </div>

          {/* Card 3: Vetted Developers */}
          <div className={styles.systemCard}>
            <div className={styles.systemCardTop}>
              <div className={styles.systemIconBox}>
                <Building2 size={26} strokeWidth={2.2} />
              </div>
              <span className={styles.systemRoleTag}>For Property Developers</span>
            </div>
            <h3 className={styles.systemCardTitle}>Developer Project Showcase</h3>
            <p className={styles.systemCardDesc}>
              Showcase upcoming residential buildings, modern towers, and gated communities directly to serious local and diaspora investors with complete architectural plans and structural milestones.
            </p>
            <div className={styles.systemFeatureList}>
              <div className={styles.systemFeatureItem}>
                <CheckCircle2 size={16} />
                <span>Verified construction milestone documentation</span>
              </div>
              <div className={styles.systemFeatureItem}>
                <CheckCircle2 size={16} />
                <span>Direct developer-to-buyer sales inquiries</span>
              </div>
              <div className={styles.systemFeatureItem}>
                <CheckCircle2 size={16} />
                <span>Admin-approved master zoning & permits</span>
              </div>
            </div>
            <button
              type="button"
              className={styles.systemCardBtn}
              onClick={() => {
                setAuthRole("developer");
                setAuthMode("register");
                setIsModalOpen(true);
              }}
            >
              <span>Developer Registration</span>
              <ArrowUpRight size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        {/* Usable Match & Tour Request Box */}
        <div className={styles.consultBox}>
          <div className={styles.consultTextSide}>
            <span className={styles.consultBadge}>Direct Platform Assistance</span>
            <h3 className={styles.consultTitle}>Looking for a Specific Residence in Addis Ababa?</h3>
            <p className={styles.consultDesc}>
              Tell us what you are looking for. Our accredited concierge matches you with legally vetted properties and arranges private on-site inspections.
            </p>
          </div>

          <div className={styles.consultFormSide}>
            <div className={styles.consultFormRow}>
              <div className={styles.consultField}>
                <label className={styles.consultLabel}>Preferred Area</label>
                <select
                  className={styles.consultSelect}
                  value={consultLocation}
                  onChange={(e) => setConsultLocation(e.target.value)}
                >
                  <option value="Bole">Bole & Atlas</option>
                  <option value="Old Airport">Old Airport Diplomatic Zone</option>
                  <option value="Kazanchis">Kazanchis Financial Core</option>
                  <option value="Sarbet">Sarbet & Vatican Corridor</option>
                  <option value="CMC & Summit">CMC & Summit Area</option>
                </select>
              </div>

              <div className={styles.consultField}>
                <label className={styles.consultLabel}>Purpose</label>
                <select
                  className={styles.consultSelect}
                  value={consultType}
                  onChange={(e) => setConsultType(e.target.value as "buy" | "rent")}
                >
                  <option value="buy">Buying Property</option>
                  <option value="rent">Renting Long-Term</option>
                </select>
              </div>
            </div>

            <div className={styles.consultField} style={{ marginTop: 12 }}>
              <label className={styles.consultLabel}>Phone / WhatsApp / Email</label>
              <input
                type="text"
                className={styles.consultInput}
                placeholder="+251 9... or diaspora@example.com"
                value={consultContact}
                onChange={(e) => setConsultContact(e.target.value)}
              />
            </div>

            <button
              type="button"
              className={styles.consultSubmitBtn}
              onClick={() => {
                if (consultContact.trim()) {
                  setConsultSubmitted(true);
                  alert(`Request received for ${consultLocation} (${consultType === "buy" ? "Purchase" : "Rental"}). A licensed advisor will reach out to ${consultContact} shortly.`);
                } else {
                  alert("Please enter your phone number, WhatsApp, or email address.");
                }
              }}
            >
              <span>Request Verified Property Match</span>
              <ArrowRight size={18} strokeWidth={2.4} />
            </button>

            {consultSubmitted && (
              <div className={styles.consultSuccessNotice}>
                ✓ Inquiry submitted. A licensed Sola advisor will contact you within 2 hours.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CREATIVE ARCHITECTURAL FOOTER */}
      <footer className={styles.creativeFooter}>
        {/* Architectural Ledger & Directory */}
        <div className={styles.footerLedgerGrid}>
          <div>
            <div style={{ fontSize: "1.3rem", fontWeight: 850, letterSpacing: "-0.03em", marginBottom: 12 }}>
              Sola Properties
            </div>
            <p style={{ color: "#8a93a5", lineHeight: 1.6, fontSize: "0.92rem", maxWidth: 300, marginBottom: 16 }}>
              A product of Solanova Tech Solutions. Curated architectural residences and verified real estate platform across Addis Ababa, Ethiopia.
            </p>
            <div style={{ fontSize: "0.82rem", color: "#6e7787" }}>
              Bole Sub-City, Addis Ababa, Ethiopia
            </div>
          </div>

          <div>
            <div className={styles.footerLedgerColHeader}>Explore Platform</div>
            <ul className={styles.footerLedgerList}>
              <li><a href="#residences" className={styles.footerLedgerLink}>Popular Residences</a></li>
              <li><a href="#services" className={styles.footerLedgerLink}>Core Services</a></li>
              <li><a href="#system" className={styles.footerLedgerLink}>How System Works</a></li>
            </ul>
          </div>

          <div>
            <div className={styles.footerLedgerColHeader}>User Portals</div>
            <ul className={styles.footerLedgerList}>
              <li>
                <button
                  type="button"
                  className={styles.footerLedgerBtn}
                  onClick={() => {
                    setAuthRole("buyer");
                    setAuthMode("login");
                    setIsModalOpen(true);
                  }}
                >
                  Buyer & Diaspora Portal
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={styles.footerLedgerBtn}
                  onClick={() => {
                    setAuthRole("agent");
                    setAuthMode("login");
                    setIsModalOpen(true);
                  }}
                >
                  Licensed Agent Network
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={styles.footerLedgerBtn}
                  onClick={() => {
                    setAuthRole("developer");
                    setAuthMode("login");
                    setIsModalOpen(true);
                  }}
                >
                  Developer Partner Access
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={styles.footerLedgerBtn}
                  onClick={() => {
                    setFormFeedback(null);
                    setIsModalOpen(true);
                  }}
                >
                  Contact Sola Support
                </button>
              </li>
            </ul>
          </div>

          <div>
            <div className={styles.footerLedgerColHeader}>Private Registry VIP Dispatch</div>
            <p style={{ color: "#8a93a5", fontSize: "0.88rem", marginBottom: 14 }}>
              Receive off-market residential acquisitions before public announcement.
            </p>
            <div className={styles.vipNewsletterBox}>
              <input
                type="email"
                className={styles.vipInput}
                placeholder="Enter email address..."
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
              />
              <button
                type="button"
                className={styles.vipSubmitBtn}
                onClick={() => {
                  if (newsletterEmail) {
                    setNewsletterSubscribed(true);
                    alert(`Private registry VIP advisory enabled for: ${newsletterEmail}`);
                  }
                }}
              >
                <span>JOIN</span>
                <ArrowRight size={15} strokeWidth={2.4} />
              </button>
            </div>
            {newsletterSubscribed && (
              <span style={{ fontSize: "0.8rem", color: "#10b981", marginTop: 8, display: "block" }}>
                ✓ Subscribed to private registry
              </span>
            )}
          </div>
        </div>

        {/* Monumental Typographic Watermark */}
        <div className={styles.footerMonumentMarquee}>
          <div className={styles.monumentText}>
            SOLA PROPERTIES • SOLANOVA TECH • ADDIS ABABA
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={styles.footerCadastralBar}>
          <div>© 2026 Sola Properties • Solanova Tech Solutions. All rights reserved.</div>
        </div>
      </footer>

      {/* Sola Backend Contact & Portal Modal (Sharp Edge) */}
      {isModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <X size={20} className={styles.modalClose} onClick={() => setIsModalOpen(false)} />

            <h3 className={styles.modalTitle}>
              {authMode === "login" ? "Sign In to Sola Properties" : "Create Sola Account"}
            </h3>
            <p className={styles.modalDesc}>
              Connect with verified property listings and real estate agents.
            </p>

            {formFeedback && (
              <div style={{ padding: "8px 12px", background: "#f0f4f8", fontSize: "0.85rem", marginBottom: 16 }}>
                {formFeedback}
              </div>
            )}

            <form onSubmit={handleAuthSubmit}>
              {authMode === "register" && (
                <>
                  <input
                    type="text"
                    required
                    className={styles.formInput}
                    placeholder="Full Name"
                    value={fullNameInput}
                    onChange={(e) => setFullNameInput(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                    {(["buyer", "agent", "developer"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setAuthRole(r)}
                        style={{
                          flex: 1,
                          padding: "8px 0",
                          borderRadius: 0,
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          border: authRole === r ? "2px solid #000" : "1px solid #dcdfe4",
                          background: authRole === r ? "#000" : "#fff",
                          color: authRole === r ? "#fff" : "#000",
                          textTransform: "capitalize",
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <input
                type="email"
                required
                className={styles.formInput}
                placeholder="Email Address"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />

              <input
                type="password"
                required
                className={styles.formInput}
                placeholder="Password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />

              <button type="submit" className={styles.formSubmitBtn}>
                {authMode === "login" ? "Sign In" : "Register"}
              </button>
            </form>

            {authMode === "login" && (
              <div style={{ marginTop: 10, textAlign: "right", fontSize: "0.82rem" }}>
                <Link
                  href="/forgot-password"
                  style={{ color: "#000000", fontWeight: 700, textDecoration: "underline" }}
                  onClick={() => setIsModalOpen(false)}
                >
                  Forgot password?
                </Link>
              </div>
            )}

            <div style={{ marginTop: 16, textAlign: "center", fontSize: "0.85rem", color: "#666" }}>
              {authMode === "login" ? (
                <span>
                  Don&apos;t have an account?{" "}
                  <strong style={{ color: "#000", cursor: "pointer" }} onClick={() => setAuthMode("register")}>
                    Register
                  </strong>
                </span>
              ) : (
                <span>
                  Already registered?{" "}
                  <strong style={{ color: "#000", cursor: "pointer" }} onClick={() => setAuthMode("login")}>
                    Sign In
                  </strong>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
