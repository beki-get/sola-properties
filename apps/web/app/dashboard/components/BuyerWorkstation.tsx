"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Heart,
  Calendar,
  MessageSquare,
  Sparkles,
  Trash2,
  ExternalLink,
  Send,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  FavoriteItem,
  PropertyVisit,
  Referral,
  ReferralMessage,
  Property,
  favoriteApi,
  visitApi,
  referralApi,
  propertyApi,
} from "../../../lib/api";
import styles from "./workstations.module.css";

interface BuyerWorkstationProps {
  activeTab: "favorites" | "tours" | "inquiries" | "recommendations";
}

export function BuyerWorkstation({ activeTab }: BuyerWorkstationProps) {
  // State for Favorites
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [favLoading, setFavLoading] = useState(false);

  // State for Tours
  const [tours, setTours] = useState<PropertyVisit[]>([]);
  const [tourLoading, setTourLoading] = useState(false);

  // State for Inquiries / Referrals
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [refLoading, setRefLoading] = useState(false);
  const [activeChatRef, setActiveChatRef] = useState<Referral | null>(null);
  const [messages, setMessages] = useState<ReferralMessage[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // State for Recommendations
  const [recommendations, setRecommendations] = useState<Property[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  // Load active tab data
  useEffect(() => {
    if (activeTab === "favorites") {
      setFavLoading(true);
      favoriteApi
        .list()
        .then((res) => {
          if (res.ok && res.data) {
            setFavorites(res.data.favorites || res.data.data || []);
          }
        })
        .finally(() => setFavLoading(false));
    } else if (activeTab === "tours") {
      setTourLoading(true);
      visitApi
        .getBuyerVisits()
        .then((res) => {
          if (res.ok && res.data) {
            setTours(res.data.visits || res.data.data || []);
          }
        })
        .finally(() => setTourLoading(false));
    } else if (activeTab === "inquiries") {
      setRefLoading(true);
      referralApi
        .getBuyerReferrals()
        .then((res) => {
          if (res.ok && res.data) {
            setReferrals(res.data.referrals || res.data.data || []);
          }
        })
        .finally(() => setRefLoading(false));
    } else if (activeTab === "recommendations") {
      setRecLoading(true);
      propertyApi
        .getRecommended()
        .then((res) => {
          if (res.ok && res.data) {
            setRecommendations(res.data.properties || res.data.data || []);
          }
        })
        .finally(() => setRecLoading(false));
    }
  }, [activeTab]);

  // Remove Favorite
  const handleRemoveFavorite = async (propertyId: string) => {
    try {
      await favoriteApi.remove(propertyId);
      setFavorites((prev) =>
        prev.filter((f) => f.property_id !== propertyId && f.property?.id !== propertyId)
      );
    } catch {
      // ignore
    }
  };

  // Cancel Visit
  const handleCancelTour = async (visitId: string) => {
    if (!confirm("Are you sure you wish to cancel this scheduled tour?")) return;
    try {
      await visitApi.cancelVisit(visitId);
      setTours((prev) =>
        prev.map((t) => (t.id === visitId ? { ...t, status: "cancelled" } : t))
      );
    } catch {
      // ignore
    }
  };

  // Open Chat for Referral
  const handleOpenChat = async (referral: Referral) => {
    setActiveChatRef(referral);
    setChatLoading(true);
    try {
      const res = await referralApi.getMessages(referral.id);
      if (res.ok && res.data) {
        setMessages(res.data.messages || res.data.data || []);
      }
    } catch {
      // ignore
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatRef || !newMsg.trim()) return;
    try {
      const res = await referralApi.sendMessage(activeChatRef.id, {
        message: newMsg.trim(),
      });
      if (res.ok) {
        setNewMsg("");
        // Reload messages
        const refresh = await referralApi.getMessages(activeChatRef.id);
        if (refresh.ok && refresh.data) {
          setMessages(refresh.data.messages || refresh.data.data || []);
        }
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className={styles.workstationWrapper}>
      {/* 1. FAVORITES TAB */}
      {activeTab === "favorites" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Shortlisted Properties</h2>
              <p className={styles.sectionSubtitle}>
                Verified residential and commercial assets saved for institutional comparison.
              </p>
            </div>
          </div>

          {favLoading ? (
            <div className={styles.emptyBlock}>Loading shortlisted properties...</div>
          ) : favorites.length === 0 ? (
            <div className={styles.emptyBlock}>
              <Heart size={36} color="#9ca3af" />
              <h4 className={styles.emptyBlockTitle}>No Shortlisted Properties</h4>
              <p className={styles.emptyBlockDesc}>
                Browse the property catalog and click "Save to Shortlist" to keep track of your top investments.
              </p>
              <Link
                href="/properties"
                className={styles.actionBtnPrimary}
                style={{ marginTop: 16 }}
              >
                Browse Catalog
              </Link>
            </div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.tableTh}>Property</th>
                    <th className={styles.tableTh}>Location</th>
                    <th className={styles.tableTh}>Price</th>
                    <th className={styles.tableTh}>Area / Beds</th>
                    <th className={styles.tableTh}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {favorites.map((fav) => {
                    const prop = fav.property;
                    return (
                      <tr key={fav.id} className={styles.tableRow}>
                        <td className={styles.tableTd}>
                          <strong>{prop?.title || fav.property_id}</strong>
                        </td>
                        <td className={styles.tableTd}>
                          {prop?.location_name || prop?.address || "Addis Ababa"}
                        </td>
                        <td className={styles.tableTd}>
                          <strong>
                            {prop?.price ? `$${Number(prop.price).toLocaleString()}` : "—"}
                          </strong>
                        </td>
                        <td className={styles.tableTd}>
                          {prop?.size_sqm ? `${prop.size_sqm} m²` : "—"} &bull;{" "}
                          {prop?.bedrooms ? `${prop.bedrooms} Bed` : "—"}
                        </td>
                        <td className={styles.tableTd}>
                          <div style={{ display: "flex", gap: 8 }}>
                            <Link
                              href={`/properties/${fav.property_id}`}
                              className={styles.actionBtnSecondary}
                              style={{ padding: "4px 8px", fontSize: "0.72rem" }}
                            >
                              <ExternalLink size={12} />
                              <span>View</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleRemoveFavorite(fav.property_id)}
                              className={styles.actionBtnDanger}
                            >
                              <Trash2 size={12} />
                              <span>Remove</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. TOURS & VISITS TAB */}
      {activeTab === "tours" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Private Tours & Visits</h2>
              <p className={styles.sectionSubtitle}>
                On-site property visits scheduled with accredited agents.
              </p>
            </div>
          </div>

          {tourLoading ? (
            <div className={styles.emptyBlock}>Loading scheduled visits...</div>
          ) : tours.length === 0 ? (
            <div className={styles.emptyBlock}>
              <Calendar size={36} color="#9ca3af" />
              <h4 className={styles.emptyBlockTitle}>No Scheduled Visits</h4>
              <p className={styles.emptyBlockDesc}>
                You can request on-site tours directly from any property specification page.
              </p>
            </div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.tableTh}>Property / Ref</th>
                    <th className={styles.tableTh}>Requested Date</th>
                    <th className={styles.tableTh}>Meeting Location</th>
                    <th className={styles.tableTh}>Status</th>
                    <th className={styles.tableTh}>Outcome</th>
                    <th className={styles.tableTh}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tours.map((t) => (
                    <tr key={t.id} className={styles.tableRow}>
                      <td className={styles.tableTd}>
                        <strong>{t.property_title || t.referral_id || t.id.slice(0, 8)}</strong>
                      </td>
                      <td className={styles.tableTd}>
                        {new Date(t.requested_at).toLocaleString()}
                      </td>
                      <td className={styles.tableTd}>{t.location || "On-site"}</td>
                      <td className={styles.tableTd}>
                        <span
                          className={`${styles.badge} ${
                            t.status === "scheduled"
                              ? styles.badgeScheduled
                              : t.status === "completed"
                              ? styles.badgeCompleted
                              : t.status === "cancelled"
                              ? styles.badgeCancelled
                              : styles.badgePending
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className={styles.tableTd}>
                        {t.outcome ? (
                          <span style={{ textTransform: "capitalize", fontWeight: 700 }}>
                            {t.outcome.replace(/_/g, " ")}
                          </span>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>Pending Tour</span>
                        )}
                      </td>
                      <td className={styles.tableTd}>
                        {t.status !== "completed" && t.status !== "cancelled" && (
                          <button
                            type="button"
                            onClick={() => handleCancelTour(t.id)}
                            className={styles.actionBtnDanger}
                          >
                            <span>Cancel</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. INQUIRIES & CHAT TAB */}
      {activeTab === "inquiries" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Inquiries & Referral Messages</h2>
              <p className={styles.sectionSubtitle}>
                Active communication threads with accredited real estate advisors and developers.
              </p>
            </div>
          </div>

          {refLoading ? (
            <div className={styles.emptyBlock}>Loading inquiries...</div>
          ) : referrals.length === 0 ? (
            <div className={styles.emptyBlock}>
              <MessageSquare size={36} color="#9ca3af" />
              <h4 className={styles.emptyBlockTitle}>No Active Inquiries</h4>
              <p className={styles.emptyBlockDesc}>
                When you inquire about a property, a secure direct messaging pipeline will open here.
              </p>
            </div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.tableTh}>Property</th>
                    <th className={styles.tableTh}>Advisor / Developer</th>
                    <th className={styles.tableTh}>Stage</th>
                    <th className={styles.tableTh}>Initiated</th>
                    <th className={styles.tableTh}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.id} className={styles.tableRow}>
                      <td className={styles.tableTd}>
                        <strong>{r.property?.title || r.property_title || r.property_id}</strong>
                      </td>
                      <td className={styles.tableTd}>{r.seller_name || "Assigned Agent"}</td>
                      <td className={styles.tableTd}>
                        <span
                          className={`${styles.badge} ${
                            r.status === "closed_won"
                              ? styles.badgeCompleted
                              : r.status === "in_progress"
                              ? styles.badgeInProgress
                              : styles.badgePending
                          }`}
                        >
                          {r.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className={styles.tableTd}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td className={styles.tableTd}>
                        <button
                          type="button"
                          onClick={() => handleOpenChat(r)}
                          className={styles.actionBtnPrimary}
                          style={{ padding: "4px 10px", fontSize: "0.72rem" }}
                        >
                          <MessageSquare size={12} />
                          <span>Messages</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CHAT MODAL */}
          {activeChatRef && (
            <div className={styles.modalOverlay}>
              <div className={styles.modalBox}>
                <button
                  className={styles.modalCloseBtn}
                  onClick={() => setActiveChatRef(null)}
                >
                  <X size={20} />
                </button>
                <h3 className={styles.modalTitle}>Advisor Communication Thread</h3>
                <p className={styles.modalDesc}>
                  Property:{" "}
                  <strong>
                    {activeChatRef.property?.title || activeChatRef.property_id}
                  </strong>
                </p>

                <div className={styles.chatBox}>
                  {chatLoading ? (
                    <div style={{ textAlign: "center", color: "#6b7280" }}>
                      Retrieving messages...
                    </div>
                  ) : messages.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#9ca3af", padding: 20 }}>
                      No messages recorded yet. Start the conversation below.
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`${styles.chatMessage} ${
                          m.sender_role === "buyer"
                            ? styles.chatMessageUser
                            : styles.chatMessageOther
                        }`}
                      >
                        <div style={{ fontWeight: 800, fontSize: "0.75rem", marginBottom: 2 }}>
                          {m.sender_name || m.sender_role}
                        </div>
                        <div>{m.message}</div>
                        <div className={styles.chatMeta}>
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSendMessage} className={styles.chatInputRow}>
                  <input
                    type="text"
                    required
                    placeholder="Type your message to the advisor..."
                    className={styles.formInput}
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                  />
                  <button type="submit" className={styles.actionBtnPrimary}>
                    <Send size={14} />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. AI RECOMMENDATIONS TAB */}
      {activeTab === "recommendations" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Tailored Investment Matches</h2>
              <p className={styles.sectionSubtitle}>
                Architectural listings matched to your budget, preferred locations, and target specs.
              </p>
            </div>
          </div>

          {recLoading ? (
            <div className={styles.emptyBlock}>Evaluating match criteria...</div>
          ) : recommendations.length === 0 ? (
            <div className={styles.emptyBlock}>
              <Sparkles size={36} color="#9ca3af" />
              <h4 className={styles.emptyBlockTitle}>No Matches Found</h4>
              <p className={styles.emptyBlockDesc}>
                Adjust your buyer preferences (budget range, preferred locations) under the "Profile" tab to discover targeted properties.
              </p>
            </div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.tableTh}>Listing Title</th>
                    <th className={styles.tableTh}>District</th>
                    <th className={styles.tableTh}>Price</th>
                    <th className={styles.tableTh}>Specs</th>
                    <th className={styles.tableTh}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map((p) => (
                    <tr key={p.id} className={styles.tableRow}>
                      <td className={styles.tableTd}>
                        <strong>{p.title}</strong>
                      </td>
                      <td className={styles.tableTd}>
                        {p.location_name || p.address || "Addis Ababa"}
                      </td>
                      <td className={styles.tableTd}>
                        <strong>${Number(p.price).toLocaleString()}</strong>
                      </td>
                      <td className={styles.tableTd}>
                        {p.size_sqm ? `${p.size_sqm} m²` : "—"} &bull;{" "}
                        {p.bedrooms ? `${p.bedrooms} Bed` : "—"}
                      </td>
                      <td className={styles.tableTd}>
                        <Link
                          href={`/properties/${p.id}`}
                          className={styles.actionBtnPrimary}
                          style={{ padding: "4px 10px", fontSize: "0.72rem" }}
                        >
                          <span>View Property</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
