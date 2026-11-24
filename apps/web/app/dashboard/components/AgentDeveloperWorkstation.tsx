"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building,
  Users,
  Calendar,
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Upload,
  Download,
  MessageSquare,
  ShieldCheck,
  FileText,
} from "lucide-react";
import {
  Property,
  PropertyCategory,
  PropertyLocation,
  Referral,
  ReferralMessage,
  ReferralFollowUp,
  PropertyVisit,
  Transaction,
  Commission,
  propertyApi,
  propertyAuthApi,
  referralApi,
  visitApi,
  transactionApi,
  commissionApi,
} from "../../../lib/api";
import { useToast } from "../../../context/ToastContext";
import styles from "./workstations.module.css";

interface AgentDeveloperWorkstationProps {
  role: "agent" | "developer";
  activeTab:
    | "inventory"
    | "authorizations"
    | "leads"
    | "visits"
    | "transactions"
    | "commissions";
}

export function AgentDeveloperWorkstation({
  role,
  activeTab,
}: AgentDeveloperWorkstationProps) {
  const { showToast } = useToast();
  // Inventory State
  const [properties, setProperties] = useState<Property[]>([]);
  const [categories, setCategories] = useState<PropertyCategory[]>([]);
  const [locations, setLocations] = useState<PropertyLocation[]>([]);
  const [propLoading, setPropLoading] = useState(false);
  const [createPropModal, setCreatePropModal] = useState(false);
  const [newProp, setNewProp] = useState({
    title: "",
    description: "",
    category_id: "",
    location_id: "",
    price: 250000,
    size_sqm: 120,
    bedrooms: 2,
    bathrooms: 2,
    payment_plan: "cash" as "cash" | "installment" | "mortgage",
    features: "parking,security,balcony",
  });
  const [createPropSubmitting, setCreatePropSubmitting] = useState(false);

  // Authorizations State
  const [authorizations, setAuthorizations] = useState<any[]>([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [grantAgentEmail, setGrantAgentEmail] = useState("");
  const [grantPropId, setGrantPropId] = useState("");
  const [grantSubmitting, setGrantSubmitting] = useState(false);

  // Leads & Pipeline State
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [activeLead, setActiveLead] = useState<Referral | null>(null);
  const [leadMessages, setLeadMessages] = useState<ReferralMessage[]>([]);
  const [leadFollowUps, setLeadFollowUps] = useState<ReferralFollowUp[]>([]);
  const [newLeadMsg, setNewLeadMsg] = useState("");
  const [newFollowUpNote, setNewFollowUpNote] = useState("");

  // Visits State
  const [visits, setVisits] = useState<PropertyVisit[]>([]);
  const [visitLoading, setVisitLoading] = useState(false);
  const [outcomeModalVisit, setOutcomeModalVisit] = useState<PropertyVisit | null>(null);
  const [outcomeVal, setOutcomeVal] = useState<"interested" | "not_interested" | "requested_another_visit">("interested");
  const [outcomeNotes, setOutcomeNotes] = useState("");

  // Transactions State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [createTxModal, setCreateTxModal] = useState(false);
  const [newTx, setNewTx] = useState({
    referralId: "",
    sale_amount: 300000,
    closing_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  // Commissions State
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [commissionSummary, setCommissionSummary] = useState<any>(null);
  const [commLoading, setCommLoading] = useState(false);

  // Feedback State
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  const handleExportLeads = async () => {
    setExportingCsv(true);
    const res = await referralApi.exportMyReferrals();
    setExportingCsv(false);
    if (!res.ok) {
      setFeedback({ ok: false, msg: res.message || "Could not download leads CSV" });
    }
  };

  const handleExportTx = async () => {
    setExportingCsv(true);
    const res = await transactionApi.export();
    setExportingCsv(false);
    if (!res.ok) {
      setFeedback({ ok: false, msg: res.message || "Could not download transactions CSV" });
    }
  };

  const handleExportCommissions = async () => {
    setExportingCsv(true);
    const res = await commissionApi.exportCommissions();
    setExportingCsv(false);
    if (!res.ok) {
      setFeedback({ ok: false, msg: res.message || "Could not download commissions CSV" });
    }
  };

  // Load Categories & Locations for selectors
  useEffect(() => {
    propertyApi.getCategories().then((res) => {
      if (res.ok && res.data) {
        setCategories(res.data.categories || res.data.data || []);
      }
    });
    propertyApi.getLocations().then((res) => {
      if (res.ok && res.data) {
        setLocations(res.data.locations || res.data.data || []);
      }
    });
  }, []);

  // Tab Data Loader
  useEffect(() => {
    setFeedback(null);
    if (activeTab === "inventory") {
      setPropLoading(true);
      propertyApi
        .getMyProperties()
        .then((res) => {
          if (res.ok && res.data) {
            const list = res.data.items || res.data.properties || res.data.data || [];
            setProperties(Array.isArray(list) ? list : []);
          }
        })
        .finally(() => setPropLoading(false));
    } else if (activeTab === "authorizations") {
      setAuthLoading(true);
      const call =
        role === "developer"
          ? propertyAuthApi.listApprovedAgents()
          : propertyAuthApi.listAgentAuthorizedProperties();
      call
        .then((res: any) => {
          if (res.ok && res.data) {
            const list =
              res.data.items ||
              res.data.agents ||
              res.data.properties ||
              res.data.data ||
              [];
            setAuthorizations(Array.isArray(list) ? list : []);
          }
        })
        .finally(() => setAuthLoading(false));
    } else if (activeTab === "leads") {
      setLeadsLoading(true);
      referralApi
        .getMyReferrals()
        .then((res) => {
          if (res.ok && res.data) {
            const list =
              res.data.referrals ||
              res.data.items ||
              res.data.data ||
              (Array.isArray(res.data) ? res.data : []);
            setReferrals(Array.isArray(list) ? list : []);
          }
        })
        .finally(() => setLeadsLoading(false));
    } else if (activeTab === "visits") {
      setVisitLoading(true);
      referralApi.getMyReferrals().then(async (refRes) => {
        const refList =
          refRes.data?.referrals ||
          refRes.data?.items ||
          refRes.data?.data ||
          (Array.isArray(refRes.data) ? refRes.data : []);
        if (Array.isArray(refList) && refList.length > 0) {
          const allVisits: PropertyVisit[] = [];
          for (const r of refList.slice(0, 10)) {
            const vRes = await visitApi.getSellerVisits(r.id);
            if (vRes.ok && vRes.data) {
              const vList =
                (vRes.data as any)?.data?.items ||
                (vRes.data as any)?.items ||
                (vRes.data as any)?.visits ||
                (Array.isArray((vRes.data as any)?.data) ? (vRes.data as any)?.data : []);
              if (Array.isArray(vList)) {
                allVisits.push(
                  ...vList.map((v: any) => ({
                    ...v,
                    property_title:
                      v.property_title ||
                      r.property_title ||
                      r.property?.title ||
                      `Referral #${r.id.slice(0, 8)}`,
                  }))
                );
              }
            }
          }
          setVisits(allVisits);
        } else {
          setVisits([]);
        }
        setVisitLoading(false);
      });
    } else if (activeTab === "transactions") {
      setTxLoading(true);
      transactionApi
        .list()
        .then((res: any) => {
          if (res.ok && res.data) {
            const list = Array.isArray(res.data)
              ? res.data
              : res.data.items || res.data.transactions || res.data.data || [];
            setTransactions(Array.isArray(list) ? list : []);
          }
        })
        .finally(() => setTxLoading(false));
    } else if (activeTab === "commissions") {
      setCommLoading(true);
      commissionApi
        .listCommissions()
        .then((res: any) => {
          if (res.ok && res.data) {
            const list =
              (res.data as any)?.data ||
              (res.data as any)?.items ||
              (res.data as any)?.commissions ||
              (Array.isArray(res.data) ? res.data : []);
            setCommissions(Array.isArray(list) ? list : []);
            if ((res.data as any)?.summary) {
              setCommissionSummary((res.data as any).summary);
            }
          }
        })
        .finally(() => setCommLoading(false));
    }
  }, [activeTab, role]);

  // Create Property
  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProp.category_id || !newProp.location_id) {
      showToast("Please select both a property category and location.", "warning");
      return;
    }
    setCreatePropSubmitting(true);
    try {
      const res = await propertyApi.createProperty({
        title: newProp.title.trim(),
        description: newProp.description.trim() || undefined,
        category_id: newProp.category_id,
        location_id: newProp.location_id,
        price: Number(newProp.price),
        size_sqm: Number(newProp.size_sqm),
        bedrooms: Number(newProp.bedrooms),
        bathrooms: Number(newProp.bathrooms),
        payment_plan: newProp.payment_plan,
        features: newProp.features
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean),
      });

      if (res.ok) {
        setFeedback({ ok: true, msg: "Property listing created successfully!" });
        setCreatePropModal(false);
        // Reload properties
        const refresh = await propertyApi.getMyProperties();
        if (refresh.ok && refresh.data) {
          const list = refresh.data.items || refresh.data.properties || refresh.data.data || [];
          setProperties(Array.isArray(list) ? list : []);
        }
      } else {
        setFeedback({ ok: false, msg: res.message || "Failed to create property." });
      }
    } catch (err: any) {
      setFeedback({ ok: false, msg: err.message || "Error creating property." });
    } finally {
      setCreatePropSubmitting(false);
    }
  };

  // Update Property Status
  const handleUpdatePropStatus = async (
    propId: string,
    status: "inactive" | "sold"
  ) => {
    try {
      await propertyApi.updateStatus(propId, { status });
      setProperties((prev) =>
        prev.map((p) => (p.id === propId ? { ...p, status } : p))
      );
    } catch {
      // ignore
    }
  };

  // Grant Authorization
  const handleGrantAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setGrantSubmitting(true);
    try {
      const res = await propertyAuthApi.authorizeAgent(grantPropId, grantAgentEmail.trim());
      if (res.ok) {
        setGrantAgentEmail("");
        setFeedback({ ok: true, msg: "Agent authorized for property marketing." });
        const refresh = await propertyAuthApi.listApprovedAgents();
        if (refresh.ok && refresh.data) {
          const list = refresh.data.items || refresh.data.agents || refresh.data.data || [];
          setAuthorizations(Array.isArray(list) ? list : []);
        }
      } else {
        setFeedback({ ok: false, msg: res.message || "Failed to grant authorization." });
      }
    } catch (err: any) {
      setFeedback({ ok: false, msg: err.message || "Error granting authorization." });
    } finally {
      setGrantSubmitting(false);
    }
  };

  // Referral Lead Actions
  const handleLeadDecision = async (
    referralId: string,
    decision: "accepted" | "rejected"
  ) => {
    try {
      await referralApi.respondReferral(referralId, { decision });
      setReferrals((prev) =>
        prev.map((r) =>
          r.id === referralId
            ? { ...r, status: decision === "accepted" ? "accepted" : "rejected" }
            : r
        )
      );
    } catch {
      // ignore
    }
  };

  const handleLeadStatusChange = async (
    referralId: string,
    status: any
  ) => {
    try {
      await referralApi.updateStatus(referralId, { status });
      setReferrals((prev) =>
        prev.map((r) => (r.id === referralId ? { ...r, status } : r))
      );
    } catch {
      // ignore
    }
  };

  // Open Lead Drawer
  const handleOpenLead = async (lead: Referral) => {
    setActiveLead(lead);
    try {
      const [msgRes, fuRes] = await Promise.all([
        referralApi.getMessages(lead.id),
        referralApi.getFollowUps(lead.id),
      ]);
      if (msgRes.ok && msgRes.data) {
        setLeadMessages(msgRes.data.messages || msgRes.data.data || []);
      }
      if (fuRes.ok && fuRes.data) {
        setLeadFollowUps(fuRes.data.followUps || fuRes.data.data || []);
      }
    } catch {
      // ignore
    }
  };

  const handleSendLeadMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLead || !newLeadMsg.trim()) return;
    try {
      await referralApi.sendMessage(activeLead.id, { message: newLeadMsg.trim() });
      setNewLeadMsg("");
      const refresh = await referralApi.getMessages(activeLead.id);
      if (refresh.ok && refresh.data) {
        setLeadMessages(refresh.data.messages || refresh.data.data || []);
      }
    } catch {
      // ignore
    }
  };

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLead || !newFollowUpNote.trim()) return;
    try {
      await referralApi.createFollowUp(activeLead.id, { notes: newFollowUpNote.trim() });
      setNewFollowUpNote("");
      const refresh = await referralApi.getFollowUps(activeLead.id);
      if (refresh.ok && refresh.data) {
        setLeadFollowUps(refresh.data.followUps || refresh.data.data || []);
      }
    } catch {
      // ignore
    }
  };

  // Visit Outcome Submission
  const handleRecordOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcomeModalVisit) return;
    try {
      await visitApi.recordOutcome(outcomeModalVisit.id, {
        outcome: outcomeVal,
        outcomeNote: outcomeNotes.trim() || undefined,
      });
      setVisits((prev) =>
        prev.map((v) =>
          v.id === outcomeModalVisit.id
            ? { ...v, status: "completed", outcome: outcomeVal, outcome_notes: outcomeNotes }
            : v
        )
      );
      setOutcomeModalVisit(null);
    } catch {
      // ignore
    }
  };

  // Submit Deal Closing / Transaction
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTx.referralId) {
      showToast("Please provide the associated Referral ID.", "warning");
      return;
    }
    try {
      const res = await transactionApi.create({
        referralId: newTx.referralId.trim(),
        sale_amount: Number(newTx.sale_amount),
        closing_date: newTx.closing_date,
        notes: newTx.notes.trim() || undefined,
      });
      if (res.ok) {
        setCreateTxModal(false);
        setFeedback({ ok: true, msg: "Transaction closing submitted for compliance verification!" });
        const refresh = await transactionApi.list();
        if (refresh.ok && refresh.data) {
          const list = Array.isArray(refresh.data)
            ? refresh.data
            : (refresh.data as any).items || (refresh.data as any).transactions || (refresh.data as any).data || [];
          setTransactions(Array.isArray(list) ? list : []);
        }
      } else {
        setFeedback({ ok: false, msg: res.message || "Failed to submit transaction." });
      }
    } catch (err: any) {
      setFeedback({ ok: false, msg: err.message || "Error submitting transaction." });
    }
  };

  return (
    <div className={styles.workstationWrapper}>
      {feedback && (
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: feedback.ok ? "#ecfdf5" : "#fef2f2",
            border: `1px solid ${feedback.ok ? "#10b981" : "#ef4444"}`,
            color: feedback.ok ? "#065f46" : "#991b1b",
            fontSize: "0.85rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {feedback.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* 1. PROPERTY INVENTORY TAB */}
      {activeTab === "inventory" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Properties & Listings</h2>
              <p className={styles.sectionSubtitle}>
                Manage your property details, photos, and prices.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreatePropModal(true)}
              className={styles.actionBtnPrimary}
            >
              <Plus size={14} />
              <span>Add New Property</span>
            </button>
          </div>

          {propLoading ? (
            <div className={styles.emptyBlock}>Loading properties...</div>
          ) : properties.length === 0 ? (
            <div className={styles.emptyBlock}>
              <Building size={36} color="#9ca3af" />
              <h4 className={styles.emptyBlockTitle}>No Properties Yet</h4>
              <p className={styles.emptyBlockDesc}>
                Add homes or commercial properties to show them to buyers.
              </p>
            </div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.tableTh}>Property Title</th>
                    <th className={styles.tableTh}>Location</th>
                    <th className={styles.tableTh}>Price</th>
                    <th className={styles.tableTh}>Area / Specs</th>
                    <th className={styles.tableTh}>Status</th>
                    <th className={styles.tableTh}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map((p) => (
                    <tr key={p.id} className={styles.tableRow}>
                      <td className={styles.tableTd}>
                        <strong>{p.title}</strong>
                        <div style={{ fontSize: "0.72rem", color: "#8c95a6" }}>
                          ID: {p.id.slice(0, 8)}
                        </div>
                      </td>
                      <td className={styles.tableTd}>
                        {p.location_name || p.address || "Addis Ababa"}
                      </td>
                      <td className={styles.tableTd}>
                        <strong>{Number(p.price).toLocaleString()} ETB</strong>
                      </td>
                      <td className={styles.tableTd}>
                        {p.size_sqm ? `${p.size_sqm} m²` : "—"} &bull;{" "}
                        {p.bedrooms ? `${p.bedrooms} Beds` : "—"}
                      </td>
                      <td className={styles.tableTd}>
                        <span
                          className={`${styles.badge} ${
                            p.status === "active"
                              ? styles.badgeActive
                              : p.status === "pending_approval"
                              ? styles.badgePending
                              : p.status === "sold"
                              ? styles.badgeCompleted
                              : styles.badgeDraft
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className={styles.tableTd}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <Link
                            href={`/properties/${p.id}`}
                            className={styles.actionBtnSecondary}
                            style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                          >
                            View
                          </Link>
                          {p.status === "active" && (
                            <button
                              type="button"
                              onClick={() => handleUpdatePropStatus(p.id, "inactive")}
                              className={styles.actionBtnSecondary}
                              style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                            >
                              Deactivate
                            </button>
                          )}
                          {p.status === "active" && (
                            <button
                              type="button"
                              onClick={() => handleUpdatePropStatus(p.id, "sold")}
                              className={styles.actionBtnPrimary}
                              style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                            >
                              Mark Sold
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CREATE PROPERTY MODAL */}
          {createPropModal && (
            <div className={styles.modalOverlay}>
              <div className={styles.modalBox}>
                <button
                  className={styles.modalCloseBtn}
                  onClick={() => setCreatePropModal(false)}
                >
                  <X size={20} />
                </button>
                <h3 className={styles.modalTitle}>Register New Property Listing</h3>
                <p className={styles.modalDesc}>
                  Submit property details. Postings require Sola compliance review before public display.
                </p>

                <form onSubmit={handleCreateProperty}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Property Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Horizon Residences - Penthouse Suite"
                      className={styles.formInput}
                      value={newProp.title}
                      onChange={(e) => setNewProp({ ...newProp, title: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGrid}>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Category</label>
                      <select
                        required
                        className={styles.formSelect}
                        value={newProp.category_id}
                        onChange={(e) => setNewProp({ ...newProp, category_id: e.target.value })}
                      >
                        <option value="">Select Category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Location / District</label>
                      <select
                        required
                        className={styles.formSelect}
                        value={newProp.location_id}
                        onChange={(e) => setNewProp({ ...newProp, location_id: e.target.value })}
                      >
                        <option value="">Select Location</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.city || "Addis Ababa"})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.formGrid}>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Price (ETB)</label>
                      <input
                        type="number"
                        required
                        min={1000}
                        className={styles.formInput}
                        value={newProp.price}
                        onChange={(e) => setNewProp({ ...newProp, price: Number(e.target.value) })}
                      />
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Size (m²)</label>
                      <input
                        type="number"
                        required
                        min={10}
                        className={styles.formInput}
                        value={newProp.size_sqm}
                        onChange={(e) => setNewProp({ ...newProp, size_sqm: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className={styles.formGrid}>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Bedrooms</label>
                      <input
                        type="number"
                        min={0}
                        className={styles.formInput}
                        value={newProp.bedrooms}
                        onChange={(e) => setNewProp({ ...newProp, bedrooms: Number(e.target.value) })}
                      />
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Bathrooms</label>
                      <input
                        type="number"
                        min={0}
                        className={styles.formInput}
                        value={newProp.bathrooms}
                        onChange={(e) => setNewProp({ ...newProp, bathrooms: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className={styles.formGrid}>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Payment Plan</label>
                      <select
                        className={styles.formSelect}
                        value={newProp.payment_plan}
                        onChange={(e) =>
                          setNewProp({
                            ...newProp,
                            payment_plan: e.target.value as any,
                          })
                        }
                      >
                        <option value="cash">Cash</option>
                        <option value="installment">Installment / Milestone</option>
                        <option value="mortgage">Mortgage Supported</option>
                      </select>
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Features (comma separated)</label>
                      <input
                        type="text"
                        placeholder="parking, elevator, balcony"
                        className={styles.formInput}
                        value={newProp.features}
                        onChange={(e) => setNewProp({ ...newProp, features: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Property Description</label>
                    <textarea
                      rows={3}
                      className={styles.formTextarea}
                      value={newProp.description}
                      onChange={(e) => setNewProp({ ...newProp, description: e.target.value })}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={createPropSubmitting}
                    className={styles.actionBtnPrimary}
                    style={{ width: "100%", height: 46, justifyContent: "center" }}
                  >
                    <span>
                      {createPropSubmitting ? "Creating Asset..." : "Submit Listing"}
                    </span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. AUTHORIZATIONS TAB */}
      {activeTab === "authorizations" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Agent Permissions</h2>
              <p className={styles.sectionSubtitle}>
                {role === "developer"
                  ? "Allow trusted agents to market and sell your properties."
                  : "Properties you are approved to market and sell for developers."}
              </p>
            </div>
          </div>

          {role === "developer" && (
            <form onSubmit={handleGrantAuth} style={{ marginBottom: 28, padding: 20, backgroundColor: "#fafbfc", border: "1px solid #e5e7eb" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 800 }}>
                Authorize an Agent
              </h4>
              <div className={styles.formGrid}>
                <input
                  type="email"
                  required
                  placeholder="Agent Email Address"
                  className={styles.formInput}
                  value={grantAgentEmail}
                  onChange={(e) => setGrantAgentEmail(e.target.value)}
                />
                <select
                  required
                  className={styles.formSelect}
                  value={grantPropId}
                  onChange={(e) => setGrantPropId(e.target.value)}
                >
                  <option value="">Select Property</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={grantSubmitting}
                className={styles.actionBtnPrimary}
                style={{ marginTop: 12 }}
              >
                <span>{grantSubmitting ? "Authorizing..." : "Grant Permission"}</span>
              </button>
            </form>
          )}

          {authLoading ? (
            <div className={styles.emptyBlock}>Loading permissions...</div>
          ) : authorizations.length === 0 ? (
            <div className={styles.emptyBlock}>
              <ShieldCheck size={36} color="#9ca3af" />
              <h4 className={styles.emptyBlockTitle}>No Authorizations Yet</h4>
              <p className={styles.emptyBlockDesc}>
                Authorizations let developers partner with agents to market and sell properties.
              </p>
            </div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.tableTh}>Property</th>
                    <th className={styles.tableTh}>
                      {role === "developer" ? "Authorized Agent" : "Location"}
                    </th>
                    {role === "agent" && <th className={styles.tableTh}>List Price</th>}
                    <th className={styles.tableTh}>Status</th>
                    <th className={styles.tableTh}>Date Granted</th>
                  </tr>
                </thead>
                <tbody>
                  {authorizations.map((a: any) => (
                    <tr key={a.id || a.property_id} className={styles.tableRow}>
                      <td className={styles.tableTd}>
                        <strong>{a.title || a.property_title || a.property_id}</strong>
                        <div style={{ fontSize: "0.72rem", color: "#8c95a6" }}>
                          ID: {(a.id || a.property_id || "").slice(0, 8)}
                        </div>
                      </td>
                      {role === "developer" ? (
                        <td className={styles.tableTd}>
                          <strong>{a.full_name || a.agent_name || a.agent_email}</strong>
                          {a.agency_name && (
                            <div style={{ fontSize: "0.72rem", color: "#8c95a6" }}>{a.agency_name}</div>
                          )}
                        </td>
                      ) : (
                        <td className={styles.tableTd}>
                          {a.location_name || a.address || "Addis Ababa"}
                          {a.category_name && (
                            <div style={{ fontSize: "0.72rem", color: "#8c95a6" }}>{a.category_name}</div>
                          )}
                        </td>
                      )}
                      {role === "agent" && (
                        <td className={styles.tableTd}>
                          <strong>{a.price ? `${Number(a.price).toLocaleString()} ETB` : "—"}</strong>
                        </td>
                      )}
                      <td className={styles.tableTd}>
                        <span className={`${styles.badge} ${styles.badgeActive}`}>
                          {a.status || "Authorized"}
                        </span>
                      </td>
                      <td className={styles.tableTd}>
                        {new Date(a.authorized_at || a.created_at || Date.now()).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. LEADS & REFERRALS PIPELINE TAB */}
      {activeTab === "leads" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Buyer Inquiries</h2>
              <p className={styles.sectionSubtitle}>
                Track inquiries from interested buyers from start to close.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportLeads}
              disabled={exportingCsv}
              className={styles.actionBtnSecondary}
            >
              <Download size={14} />
              <span>{exportingCsv ? "Exporting..." : "Export CSV"}</span>
            </button>
          </div>

          {leadsLoading ? (
            <div className={styles.emptyBlock}>Loading buyer inquiries...</div>
          ) : referrals.length === 0 ? (
            <div className={styles.emptyBlock}>
              <Users size={36} color="#9ca3af" />
              <h4 className={styles.emptyBlockTitle}>No Inquiries Yet</h4>
              <p className={styles.emptyBlockDesc}>
                When buyers send inquiries about your properties, they will appear here.
              </p>
            </div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.tableTh}>Buyer</th>
                    <th className={styles.tableTh}>Property</th>
                    <th className={styles.tableTh}>Status</th>
                    <th className={styles.tableTh}>Update Status</th>
                    <th className={styles.tableTh}>Notes & Messages</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.id} className={styles.tableRow}>
                      <td className={styles.tableTd}>
                        <strong>{r.buyer_name || "Verified Buyer"}</strong>
                        <div style={{ fontSize: "0.72rem", color: "#8c95a6" }}>
                          {r.buyer_email || r.buyer_phone || "Confidential Contact"}
                        </div>
                      </td>
                      <td className={styles.tableTd}>
                        {r.property?.title || r.property_title || r.property_id.slice(0, 8)}
                      </td>
                      <td className={styles.tableTd}>
                        <span
                          className={`${styles.badge} ${
                            r.status === "closed_won"
                              ? styles.badgeCompleted
                              : r.status === "in_progress"
                              ? styles.badgeInProgress
                              : r.status === "rejected"
                              ? styles.badgeRejected
                              : styles.badgePending
                          }`}
                        >
                          {r.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className={styles.tableTd}>
                        {r.status === "assigned" ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleLeadDecision(r.id, "accepted")}
                              className={styles.actionBtnPrimary}
                              style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => handleLeadDecision(r.id, "rejected")}
                              className={styles.actionBtnDanger}
                            >
                              Decline
                            </button>
                          </div>
                        ) : (
                          <select
                            className={styles.formSelect}
                            style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                            value={r.status}
                            onChange={(e) => handleLeadStatusChange(r.id, e.target.value)}
                          >
                            <option value="accepted">Accepted</option>
                            <option value="in_progress">In Progress</option>
                            <option value="agreement">Contract Pending</option>
                            <option value="closed_won">Deal Closed</option>
                            <option value="closed_lost">Lost / Inactive</option>
                          </select>
                        )}
                      </td>
                      <td className={styles.tableTd}>
                        <button
                          type="button"
                          onClick={() => handleOpenLead(r)}
                          className={styles.actionBtnSecondary}
                          style={{ padding: "4px 8px", fontSize: "0.72rem" }}
                        >
                          <MessageSquare size={12} />
                          <span>Notes & Chat</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* LEAD DRAWER / MODAL */}
          {activeLead && (
            <div className={styles.modalOverlay}>
              <div className={styles.modalBox}>
                <button
                  className={styles.modalCloseBtn}
                  onClick={() => setActiveLead(null)}
                >
                  <X size={20} />
                </button>
                <h3 className={styles.modalTitle}>Buyer Inquiry</h3>
                <p className={styles.modalDesc}>
                  Buyer: <strong>{activeLead.buyer_name || "Verified Buyer"}</strong> &bull; Ref: {activeLead.id.slice(0, 8)}
                </p>

                {/* Internal Follow-Up Log */}
                <h4 style={{ fontSize: "0.88rem", fontWeight: 800, margin: "16px 0 8px" }}>
                  Private Notes
                </h4>
                <div style={{ maxHeight: 140, overflowY: "auto", border: "1px solid #e5e7eb", padding: 10, marginBottom: 12, backgroundColor: "#fafbfc" }}>
                  {leadFollowUps.length === 0 ? (
                    <div style={{ color: "#9ca3af", fontSize: "0.8rem" }}>No private notes added yet.</div>
                  ) : (
                    leadFollowUps.map((fu) => (
                      <div key={fu.id} style={{ fontSize: "0.8rem", marginBottom: 6, borderBottom: "1px solid #edf0f4", paddingBottom: 4 }}>
                        <span style={{ fontWeight: 700 }}>{fu.author_name || "Advisor"}:</span> {fu.notes}
                        <div style={{ fontSize: "0.68rem", color: "#8c95a6" }}>
                          {new Date(fu.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={handleAddFollowUp} style={{ display: "flex", gap: 6, marginBottom: 20 }}>
                  <input
                    type="text"
                    required
                    placeholder="Add a private note..."
                    className={styles.formInput}
                    value={newFollowUpNote}
                    onChange={(e) => setNewFollowUpNote(e.target.value)}
                  />
                  <button type="submit" className={styles.actionBtnSecondary}>
                    Add Note
                  </button>
                </form>

                {/* Direct Messages */}
                <h4 style={{ fontSize: "0.88rem", fontWeight: 800, margin: "0 0 8px" }}>
                  Messages with Buyer
                </h4>
                <div className={styles.chatBox}>
                  {leadMessages.length === 0 ? (
                    <div style={{ color: "#9ca3af", fontSize: "0.8rem", textAlign: "center", padding: 12 }}>
                      No messages yet.
                    </div>
                  ) : (
                    leadMessages.map((m) => (
                      <div
                        key={m.id}
                        className={`${styles.chatMessage} ${
                          m.sender_role === "agent" || m.sender_role === "developer"
                            ? styles.chatMessageUser
                            : styles.chatMessageOther
                        }`}
                      >
                        <div style={{ fontWeight: 800, fontSize: "0.72rem" }}>
                          {m.sender_name || m.sender_role}
                        </div>
                        <div>{m.message}</div>
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={handleSendLeadMsg} className={styles.chatInputRow}>
                  <input
                    type="text"
                    required
                    placeholder="Type a message to buyer..."
                    className={styles.formInput}
                    value={newLeadMsg}
                    onChange={(e) => setNewLeadMsg(e.target.value)}
                  />
                  <button type="submit" className={styles.actionBtnPrimary}>
                    Send
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. VISITS & TOURS TAB */}
      {activeTab === "visits" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Property Visits & Tours</h2>
              <p className={styles.sectionSubtitle}>
                View scheduled visits and record feedback from buyers.
              </p>
            </div>
          </div>

          {visitLoading ? (
            <div className={styles.emptyBlock}>Loading visits...</div>
          ) : visits.length === 0 ? (
            <div className={styles.emptyBlock}>
              <Calendar size={36} color="#9ca3af" />
              <h4 className={styles.emptyBlockTitle}>No Visits Scheduled Yet</h4>
              <p className={styles.emptyBlockDesc}>
                When buyers request a visit to your properties, they will appear here.
              </p>
            </div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.tableTh}>Property</th>
                    <th className={styles.tableTh}>Requested Date</th>
                    <th className={styles.tableTh}>Location</th>
                    <th className={styles.tableTh}>Status</th>
                    <th className={styles.tableTh}>Outcome</th>
                    <th className={styles.tableTh}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id} className={styles.tableRow}>
                      <td className={styles.tableTd}>
                        <strong>{v.property_title || v.id.slice(0, 8)}</strong>
                      </td>
                      <td className={styles.tableTd}>
                        {new Date(v.requested_at).toLocaleString()}
                      </td>
                      <td className={styles.tableTd}>{v.location || "On-site"}</td>
                      <td className={styles.tableTd}>
                        <span
                          className={`${styles.badge} ${
                            v.status === "completed"
                              ? styles.badgeCompleted
                              : v.status === "scheduled"
                              ? styles.badgeScheduled
                              : styles.badgePending
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td className={styles.tableTd}>
                        {v.outcome ? (
                          <span style={{ fontWeight: 700, textTransform: "capitalize" }}>
                            {v.outcome.replace(/_/g, " ")}
                          </span>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>Pending Outcome</span>
                        )}
                      </td>
                      <td className={styles.tableTd}>
                        {v.status !== "completed" && (
                          <button
                            type="button"
                            onClick={() => setOutcomeModalVisit(v)}
                            className={styles.actionBtnPrimary}
                            style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                          >
                            Log Outcome
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* OUTCOME MODAL */}
          {outcomeModalVisit && (
            <div className={styles.modalOverlay}>
              <div className={styles.modalBox}>
                <button
                  className={styles.modalCloseBtn}
                  onClick={() => setOutcomeModalVisit(null)}
                >
                  <X size={20} />
                </button>
                <h3 className={styles.modalTitle}>Record Visit Result</h3>
                <p className={styles.modalDesc}>
                  Property: <strong>{outcomeModalVisit.property_title || outcomeModalVisit.id}</strong>
                </p>

                <form onSubmit={handleRecordOutcome}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Visit Result</label>
                    <select
                      className={styles.formSelect}
                      value={outcomeVal}
                      onChange={(e) => setOutcomeVal(e.target.value as any)}
                    >
                      <option value="interested">Interested in buying</option>
                      <option value="requested_another_visit">Requested another visit</option>
                      <option value="not_interested">Not interested</option>
                    </select>
                  </div>

                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Visitor Notes</label>
                    <textarea
                      rows={3}
                      className={styles.formTextarea}
                      placeholder="e.g. Buyer liked the property, wants to discuss price next week."
                      value={outcomeNotes}
                      onChange={(e) => setOutcomeNotes(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    className={styles.actionBtnPrimary}
                    style={{ width: "100%", height: 44, justifyContent: "center" }}
                  >
                    Save Visit Result
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. TRANSACTIONS & CLOSINGS TAB */}
      {activeTab === "transactions" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Closed Deals & Sales</h2>
              <p className={styles.sectionSubtitle}>
                Submit completed sales to record your closing and commission.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setCreateTxModal(true)}
                className={styles.actionBtnPrimary}
              >
                <Plus size={14} />
                <span>Record a Sale</span>
              </button>
              <button
                type="button"
                onClick={handleExportTx}
                disabled={exportingCsv}
                className={styles.actionBtnSecondary}
              >
                <Download size={14} />
                <span>{exportingCsv ? "Exporting..." : "Export CSV"}</span>
              </button>
            </div>
          </div>

          {txLoading ? (
            <div className={styles.emptyBlock}>Loading sales...</div>
          ) : transactions.length === 0 ? (
            <div className={styles.emptyBlock}>
              <DollarSign size={36} color="#9ca3af" />
              <h4 className={styles.emptyBlockTitle}>No Closed Deals Yet</h4>
              <p className={styles.emptyBlockDesc}>
                When a sale is agreed, submit the details here to record the sale and process your commission.
              </p>
            </div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.tableTh}>Property</th>
                    <th className={styles.tableTh}>Sale Value</th>
                    <th className={styles.tableTh}>Buyer</th>
                    <th className={styles.tableTh}>Closing Date</th>
                    <th className={styles.tableTh}>Verification Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className={styles.tableRow}>
                      <td className={styles.tableTd}>
                        <strong>{t.property_title || t.property_id}</strong>
                      </td>
                      <td className={styles.tableTd}>
                        <strong>{Number(t.sale_amount).toLocaleString()} ETB</strong>
                      </td>
                      <td className={styles.tableTd}>{t.buyer_name || "Verified Buyer"}</td>
                      <td className={styles.tableTd}>
                        {new Date(t.closing_date).toLocaleDateString()}
                      </td>
                      <td className={styles.tableTd}>
                        <span
                          className={`${styles.badge} ${
                            t.status === "verified"
                              ? styles.badgeActive
                              : t.status === "rejected"
                              ? styles.badgeRejected
                              : styles.badgePending
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CREATE TRANSACTION MODAL */}
          {createTxModal && (
            <div className={styles.modalOverlay}>
              <div className={styles.modalBox}>
                <button
                  className={styles.modalCloseBtn}
                  onClick={() => setCreateTxModal(false)}
                >
                  <X size={20} />
                </button>
                <h3 className={styles.modalTitle}>Record a Closed Sale</h3>
                <p className={styles.modalDesc}>
                  Enter the details of the completed sale.
                </p>

                <form onSubmit={handleCreateTransaction}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Buyer Inquiry / Referral ID</label>
                    <input
                      type="text"
                      required
                      placeholder="Paste Referral ID from the Inquiries tab"
                      className={styles.formInput}
                      value={newTx.referralId}
                      onChange={(e) => setNewTx({ ...newTx, referralId: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGrid}>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Final Sale Amount (ETB)</label>
                      <input
                        type="number"
                        required
                        min={1000}
                        className={styles.formInput}
                        value={newTx.sale_amount}
                        onChange={(e) => setNewTx({ ...newTx, sale_amount: Number(e.target.value) })}
                      />
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Closing Date</label>
                      <input
                        type="date"
                        required
                        className={styles.formInput}
                        value={newTx.closing_date}
                        onChange={(e) => setNewTx({ ...newTx, closing_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Notes / Contract Reference</label>
                    <textarea
                      rows={3}
                      className={styles.formTextarea}
                      value={newTx.notes}
                      onChange={(e) => setNewTx({ ...newTx, notes: e.target.value })}
                    />
                  </div>

                  <button
                    type="submit"
                    className={styles.actionBtnPrimary}
                    style={{ width: "100%", height: 44, justifyContent: "center" }}
                  >
                    Submit for Settlement Verification
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. COMMISSIONS TAB */}
      {activeTab === "commissions" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Commissions & Payouts</h2>
              <p className={styles.sectionSubtitle}>
                Track your earned commission fees and payouts.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportCommissions}
              disabled={exportingCsv}
              className={styles.actionBtnSecondary}
            >
              <Download size={14} />
              <span>{exportingCsv ? "Exporting..." : "Export CSV"}</span>
            </button>
          </div>

          {/* Commission Summary Cards */}
          {commissionSummary && (
            <div className={styles.kpiGrid} style={{ marginBottom: 24 }}>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Total Commission</span>
                <span className={styles.kpiValue}>
                  {Number(commissionSummary.total_commission || 0).toLocaleString()} ETB
                </span>
                <span className={styles.kpiSubtext}>Total commission earned</span>
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Amount Paid</span>
                <span className={styles.kpiValue}>
                  {Number(commissionSummary.paid_total || 0).toLocaleString()} ETB
                </span>
                <span className={styles.kpiSubtext}>Paid to you</span>
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Outstanding Balance</span>
                <span className={styles.kpiValue}>
                  {Number(commissionSummary.outstanding || 0).toLocaleString()} ETB
                </span>
                <span className={styles.kpiSubtext}>Pending payment</span>
              </div>
            </div>
          )}

          {commLoading ? (
            <div className={styles.emptyBlock}>Loading commissions...</div>
          ) : commissions.length === 0 ? (
            <div className={styles.emptyBlock}>
              <DollarSign size={36} color="#9ca3af" />
              <h4 className={styles.emptyBlockTitle}>No Commissions Yet</h4>
              <p className={styles.emptyBlockDesc}>
                When deals are approved, your earned commissions will appear here.
              </p>
            </div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.tableTh}>Deal Ref</th>
                    <th className={styles.tableTh}>Sale Amount</th>
                    <th className={styles.tableTh}>Commission</th>
                    <th className={styles.tableTh}>Status</th>
                    <th className={styles.tableTh}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c: any) => (
                    <tr key={c.id} className={styles.tableRow}>
                      <td className={styles.tableTd}>
                        <strong>
                          {c.transactionId
                            ? c.transactionId.slice(0, 8)
                            : c.transaction_id
                            ? c.transaction_id.slice(0, 8)
                            : c.id.slice(0, 8)}
                        </strong>
                      </td>
                      <td className={styles.tableTd}>
                        {Number(c.saleAmount ?? c.sale_amount ?? 0).toLocaleString()} ETB
                      </td>
                      <td className={styles.tableTd}>
                        <strong>
                          {Number(
                            c.totalCommission ??
                              c.total_commission ??
                              c.sellerAmount ??
                              c.seller_amount ??
                              0
                          ).toLocaleString()} ETB
                        </strong>
                      </td>
                      <td className={styles.tableTd}>
                        <span
                          className={`${styles.badge} ${
                            c.status === "paid"
                              ? styles.badgeCompleted
                              : c.status === "approved"
                              ? styles.badgeActive
                              : styles.badgePending
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className={styles.tableTd}>
                        {new Date(c.createdAt || c.created_at || Date.now()).toLocaleDateString()}
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
