"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Users,
  Building,
  DollarSign,
  FileText,
  TrendingUp,
  Download,
  Plus,
  X,
  Search,
  Filter,
} from "lucide-react";
import {
  Property,
  Referral,
  ReferralIssue,
  Transaction,
  CommissionAgreement,
  Commission,
  Dispute,
  AdminUser,
  AuditLog,
  AdminReport,
  FinanceAdminReport,
  PropertyCategory,
  PropertyLocation,
  adminManagementApi,
  referralApi,
  transactionApi,
  disputeApi,
  commissionApi,
  reportApi,
  propertyApi,
} from "../../../lib/api";
import styles from "./workstations.module.css";

interface AdminWorkstationProps {
  role: "admin" | "finance_admin";
  activeTab:
    | "admin-properties"
    | "admin-referrals"
    | "admin-transactions"
    | "admin-commissions"
    | "admin-users"
    | "admin-taxonomy"
    | "admin-audit"
    | "admin-reports";
}

export function AdminWorkstation({ role, activeTab }: AdminWorkstationProps) {
  // 1. Pending Properties
  const [pendingProps, setPendingProps] = useState<Property[]>([]);
  const [pendingPropsLoading, setPendingPropsLoading] = useState(false);

  // 2. Master Referrals & Issues
  const [adminReferrals, setAdminReferrals] = useState<Referral[]>([]);
  const [adminIssues, setAdminIssues] = useState<ReferralIssue[]>([]);
  const [refLoading, setRefLoading] = useState(false);

  // 3. Transactions & Disputes
  const [adminTxs, setAdminTxs] = useState<Transaction[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  // 4. Commissions & Agreements
  const [agreements, setAgreements] = useState<CommissionAgreement[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [commLoading, setCommLoading] = useState(false);
  const [createAgreementModal, setCreateAgreementModal] = useState(false);
  const [newAgreement, setNewAgreement] = useState({
    sellerId: "",
    rate: 0.03,
    terms: "Standard institutional broker commission schedule.",
  });

  // 5. User Management
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [createUserModal, setCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    fullName: "",
    email: "",
    role: "admin" as "admin" | "finance_admin",
  });

  // 6. Taxonomy (Categories & Locations)
  const [categories, setCategories] = useState<PropertyCategory[]>([]);
  const [locations, setLocations] = useState<PropertyLocation[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newLocName, setNewLocName] = useState("");
  const [newLocSubCity, setNewLocSubCity] = useState("");

  // 7. Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // 8. Executive Reports
  const [report, setReport] = useState<AdminReport | FinanceAdminReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // General Feedback
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Tab Data Loader
  useEffect(() => {
    setFeedback(null);
    if (activeTab === "admin-properties") {
      setPendingPropsLoading(true);
      adminManagementApi
        .getPendingProperties()
        .then((res) => {
          if (res.ok && res.data) {
            setPendingProps(res.data.properties || res.data.data || []);
          }
        })
        .finally(() => setPendingPropsLoading(false));
    } else if (activeTab === "admin-referrals") {
      setRefLoading(true);
      Promise.all([
        referralApi.getAdminReferrals(),
        referralApi.getAdminIssues(),
      ])
        .then(([refRes, issueRes]) => {
          if (refRes.ok && refRes.data) {
            setAdminReferrals(refRes.data.referrals || refRes.data.data || []);
          }
          if (issueRes.ok && issueRes.data) {
            setAdminIssues(issueRes.data.issues || issueRes.data.data || []);
          }
        })
        .finally(() => setRefLoading(false));
    } else if (activeTab === "admin-transactions") {
      setTxLoading(true);
      transactionApi
        .list()
        .then((txRes) => {
          if (txRes.ok && txRes.data) {
            setAdminTxs(txRes.data.transactions || txRes.data.data || []);
          }
        })
        .finally(() => setTxLoading(false));
    } else if (activeTab === "admin-commissions") {
      setCommLoading(true);
      Promise.all([
        commissionApi.getAgreements(),
        commissionApi.listCommissions(),
      ])
        .then(([agrRes, comRes]) => {
          if (agrRes.ok && agrRes.data) {
            setAgreements(agrRes.data.agreements || agrRes.data.data || []);
          }
          if (comRes.ok && comRes.data) {
            setCommissions(comRes.data.commissions || comRes.data.data || []);
          }
        })
        .finally(() => setCommLoading(false));
    } else if (activeTab === "admin-users") {
      setUserLoading(true);
      adminManagementApi
        .getUsers()
        .then((res) => {
          if (res.ok && res.data) {
            setUsers(res.data.users || res.data.data || []);
          }
        })
        .finally(() => setUserLoading(false));
    } else if (activeTab === "admin-taxonomy") {
      Promise.all([propertyApi.getCategories(), propertyApi.getLocations()]).then(
        ([cRes, lRes]) => {
          if (cRes.ok && cRes.data) {
            setCategories(cRes.data.categories || cRes.data.data || []);
          }
          if (lRes.ok && lRes.data) {
            setLocations(lRes.data.locations || lRes.data.data || []);
          }
        }
      );
    } else if (activeTab === "admin-audit") {
      setAuditLoading(true);
      adminManagementApi
        .getAuditLogs()
        .then((res) => {
          if (res.ok && res.data) {
            setAuditLogs(res.data.logs || res.data.data || []);
          }
        })
        .finally(() => setAuditLoading(false));
    } else if (activeTab === "admin-reports") {
      setReportLoading(true);
      const call =
        role === "finance_admin"
          ? reportApi.getFinanceAdminReport()
          : reportApi.getAdminReport();
      call
        .then((res) => {
          if (res.ok && res.data) {
            setReport(res.data.report || res.data.data || null);
          }
        })
        .finally(() => setReportLoading(false));
    }
  }, [activeTab, role]);

  // Decide Property
  const handleDecideProperty = async (
    propId: string,
    decision: "approved" | "rejected"
  ) => {
    try {
      const res = await adminManagementApi.decideProperty(propId, { decision });
      if (res.ok) {
        setPendingProps((prev) => prev.filter((p) => p.id !== propId));
        setFeedback({ ok: true, msg: `Property listing ${decision} successfully.` });
      } else {
        setFeedback({ ok: false, msg: res.message || "Action failed." });
      }
    } catch (err: any) {
      setFeedback({ ok: false, msg: err.message || "Network error." });
    }
  };

  // Decide Transaction
  const handleDecideTx = async (
    txId: string,
    decision: "verified" | "rejected"
  ) => {
    try {
      const res = await transactionApi.decide(txId, { decision });
      if (res.ok) {
        setAdminTxs((prev) =>
          prev.map((t) => (t.id === txId ? { ...t, status: decision } : t))
        );
        setFeedback({ ok: true, msg: `Transaction closing ${decision}.` });
      } else {
        setFeedback({ ok: false, msg: res.message || "Action failed." });
      }
    } catch (err: any) {
      setFeedback({ ok: false, msg: err.message || "Network error." });
    }
  };

  // User Status Toggle
  const handleUpdateUserStatus = async (
    userId: string,
    status: "approved" | "suspended" | "deactivated"
  ) => {
    try {
      const res = await adminManagementApi.updateUserStatus(userId, { status });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status } : u))
        );
        setFeedback({ ok: true, msg: `User account updated to ${status}.` });
      }
    } catch {
      // ignore
    }
  };

  // Create Staff Admin User
  const handleCreateStaffUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await adminManagementApi.createAdminUser({
        fullName: newUser.fullName.trim(),
        email: newUser.email.trim(),
        role: newUser.role,
      });
      if (res.ok) {
        setCreateUserModal(false);
        setFeedback({ ok: true, msg: "New administrative staff account provisioned!" });
        const refresh = await adminManagementApi.getUsers();
        if (refresh.ok && refresh.data) {
          setUsers(refresh.data.users || refresh.data.data || []);
        }
      } else {
        setFeedback({ ok: false, msg: res.message || "Failed to create user." });
      }
    } catch (err: any) {
      setFeedback({ ok: false, msg: err.message || "Network error." });
    }
  };

  // Taxonomy Create
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      const res = await adminManagementApi.createCategory({
        name: newCatName.trim(),
        description: newCatDesc.trim() || undefined,
      });
      if (res.ok) {
        setNewCatName("");
        setNewCatDesc("");
        setFeedback({ ok: true, msg: "Category created!" });
        const cRes = await propertyApi.getCategories();
        if (cRes.ok && cRes.data) {
          setCategories(cRes.data.categories || cRes.data.data || []);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim()) return;
    try {
      const res = await adminManagementApi.createLocation({
        name: newLocName.trim(),
        sub_city: newLocSubCity.trim() || undefined,
        city: "Addis Ababa",
      });
      if (res.ok) {
        setNewLocName("");
        setNewLocSubCity("");
        setFeedback({ ok: true, msg: "Location created!" });
        const lRes = await propertyApi.getLocations();
        if (lRes.ok && lRes.data) {
          setLocations(lRes.data.locations || lRes.data.data || []);
        }
      }
    } catch {
      // ignore
    }
  };

  // Commission Agreement Create
  const handleCreateAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await commissionApi.createAgreement({
        sellerId: newAgreement.sellerId || undefined,
        commissionRatePct: Number(newAgreement.rate),
        platformSharePct: 20,
      });
      if (res.ok) {
        setCreateAgreementModal(false);
        setFeedback({ ok: true, msg: "Commission agreement recorded!" });
        const agrRes = await commissionApi.getAgreements();
        if (agrRes.ok && agrRes.data) {
          setAgreements(agrRes.data.agreements || agrRes.data.data || []);
        }
      }
    } catch {
      // ignore
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

      {/* 1. REVIEW PENDING PROPERTIES TAB */}
      {activeTab === "admin-properties" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Pending Listings Compliance Review</h2>
              <p className={styles.sectionSubtitle}>
                Audit developer and agent submissions for cadastral title accuracy and image fidelity.
              </p>
            </div>
            <button
              type="button"
              onClick={() => adminManagementApi.exportAdminProperties()}
              className={styles.actionBtnSecondary}
            >
              <Download size={14} />
              <span>Export Properties CSV</span>
            </button>
          </div>

          {pendingPropsLoading ? (
            <div className={styles.emptyBlock}>Loading review queue...</div>
          ) : pendingProps.length === 0 ? (
            <div className={styles.emptyBlock}>
              <ShieldCheck size={36} color="#10b981" />
              <h4 className={styles.emptyBlockTitle}>Review Queue Clear</h4>
              <p className={styles.emptyBlockDesc}>
                All property submissions have been audited and approved for public catalog display.
              </p>
            </div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.tableTh}>Title / Reference</th>
                    <th className={styles.tableTh}>Price</th>
                    <th className={styles.tableTh}>District</th>
                    <th className={styles.tableTh}>Submitted</th>
                    <th className={styles.tableTh}>Compliance Audit Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingProps.map((p) => (
                    <tr key={p.id} className={styles.tableRow}>
                      <td className={styles.tableTd}>
                        <strong>{p.title}</strong>
                        <div style={{ fontSize: "0.72rem", color: "#8c95a6" }}>
                          ID: {p.id.slice(0, 8)} &bull; {p.size_sqm ? `${p.size_sqm} m²` : ""}
                        </div>
                      </td>
                      <td className={styles.tableTd}>
                        <strong>${Number(p.price).toLocaleString()}</strong>
                      </td>
                      <td className={styles.tableTd}>
                        {p.location_name || p.address || "Addis Ababa"}
                      </td>
                      <td className={styles.tableTd}>
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className={styles.tableTd}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleDecideProperty(p.id, "approved")}
                            className={styles.actionBtnPrimary}
                            style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDecideProperty(p.id, "rejected")}
                            className={styles.actionBtnDanger}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. MASTER REFERRALS & ISSUES TAB */}
      {activeTab === "admin-referrals" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Master Platform Referrals & Dispute Log</h2>
              <p className={styles.sectionSubtitle}>
                Platform-wide buyer-agent routing oversight and reported lead dispute resolution.
              </p>
            </div>
          </div>

          <h3 style={{ fontSize: "1.05rem", fontWeight: 800, margin: "0 0 12px" }}>
            Active Platform Leads ({adminReferrals.length})
          </h3>
          {refLoading ? (
            <div className={styles.emptyBlock}>Loading master referrals...</div>
          ) : adminReferrals.length === 0 ? (
            <div className={styles.emptyBlock}>No referrals on platform currently.</div>
          ) : (
            <div className={styles.tableResponsive} style={{ marginBottom: 32 }}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.tableTh}>Buyer</th>
                    <th className={styles.tableTh}>Assigned Agent</th>
                    <th className={styles.tableTh}>Property</th>
                    <th className={styles.tableTh}>Stage</th>
                    <th className={styles.tableTh}>Initiated</th>
                  </tr>
                </thead>
                <tbody>
                  {adminReferrals.map((r) => (
                    <tr key={r.id} className={styles.tableRow}>
                      <td className={styles.tableTd}>
                        <strong>{r.buyer_name || "Buyer"}</strong>
                        <div style={{ fontSize: "0.72rem", color: "#8c95a6" }}>{r.buyer_email}</div>
                      </td>
                      <td className={styles.tableTd}>{r.seller_name || "Assigned Broker"}</td>
                      <td className={styles.tableTd}>
                        {r.property?.title || r.property_title || r.property_id.slice(0, 8)}
                      </td>
                      <td className={styles.tableTd}>
                        <span className={`${styles.badge} ${styles.badgePending}`}>
                          {r.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className={styles.tableTd}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 style={{ fontSize: "1.05rem", fontWeight: 800, margin: "0 0 12px" }}>
            Reported Pipeline Issues ({adminIssues.length})
          </h3>
          {adminIssues.length === 0 ? (
            <div className={styles.emptyBlock}>No pipeline disputes or issues reported.</div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.tableTh}>Issue Type</th>
                    <th className={styles.tableTh}>Description</th>
                    <th className={styles.tableTh}>Status</th>
                    <th className={styles.tableTh}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {adminIssues.map((iss) => (
                    <tr key={iss.id} className={styles.tableRow}>
                      <td className={styles.tableTd}>
                        <strong>{iss.issue_type || "Referral Conflict"}</strong>
                      </td>
                      <td className={styles.tableTd}>{iss.description}</td>
                      <td className={styles.tableTd}>
                        <span className={`${styles.badge} ${styles.badgeInvestigating}`}>
                          {iss.status}
                        </span>
                      </td>
                      <td className={styles.tableTd}>
                        {iss.status !== "resolved" && (
                          <button
                            type="button"
                            onClick={() =>
                              referralApi
                                .resolveIssue(iss.id, {
                                  resolution_note: "Arbitrated by platform compliance officer.",
                                })
                                .then(() => {
                                  setAdminIssues((prev) =>
                                    prev.map((i) =>
                                      i.id === iss.id ? { ...i, status: "resolved" } : i
                                    )
                                  );
                                })
                            }
                            className={styles.actionBtnPrimary}
                            style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                          >
                            Resolve
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

      {/* 3. SETTLEMENT APPROVALS & DISPUTES TAB */}
      {activeTab === "admin-transactions" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Transaction Settlement Approvals</h2>
              <p className={styles.sectionSubtitle}>
                Institutional closing audit: authorize commission generation and ledger disbursement.
              </p>
            </div>
          </div>

          {txLoading ? (
            <div className={styles.emptyBlock}>Loading transaction audit ledger...</div>
          ) : adminTxs.length === 0 ? (
            <div className={styles.emptyBlock}>No transactions submitted for review.</div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.tableTh}>Property Ref</th>
                    <th className={styles.tableTh}>Sale Value</th>
                    <th className={styles.tableTh}>Closing Date</th>
                    <th className={styles.tableTh}>Status</th>
                    <th className={styles.tableTh}>Verification Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminTxs.map((t) => (
                    <tr key={t.id} className={styles.tableRow}>
                      <td className={styles.tableTd}>
                        <strong>{t.property_title || t.property_id}</strong>
                      </td>
                      <td className={styles.tableTd}>
                        <strong>${Number(t.sale_amount).toLocaleString()}</strong>
                      </td>
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
                      <td className={styles.tableTd}>
                        {t.status === "submitted" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleDecideTx(t.id, "verified")}
                              className={styles.actionBtnPrimary}
                              style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                            >
                              Verify & Settle
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDecideTx(t.id, "rejected")}
                              className={styles.actionBtnDanger}
                            >
                              Reject
                            </button>
                          </div>
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

      {/* 4. COMMISSION MANAGEMENT TAB */}
      {activeTab === "admin-commissions" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Institutional Commission Administration</h2>
              <p className={styles.sectionSubtitle}>
                Configure commission agreements, authorize splits, and execute disbursement payouts.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateAgreementModal(true)}
              className={styles.actionBtnPrimary}
            >
              <Plus size={14} />
              <span>New Commission Agreement</span>
            </button>
          </div>

          <h3 style={{ fontSize: "1.05rem", fontWeight: 800, margin: "0 0 12px" }}>
            Commission Schedules & Agreements ({agreements.length})
          </h3>
          {commLoading ? (
            <div className={styles.emptyBlock}>Loading commission schedules...</div>
          ) : agreements.length === 0 ? (
            <div className={styles.emptyBlock}>No commission agreements registered.</div>
          ) : (
            <div className={styles.tableResponsive} style={{ marginBottom: 32 }}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.tableTh}>Schedule ID</th>
                    <th className={styles.tableTh}>Seller / Partner</th>
                    <th className={styles.tableTh}>Commission Rate</th>
                    <th className={styles.tableTh}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {agreements.map((a) => (
                    <tr key={a.id} className={styles.tableRow}>
                      <td className={styles.tableTd}>
                        <strong>{a.id.slice(0, 8)}</strong>
                      </td>
                      <td className={styles.tableTd}>{a.seller_name || "Platform Standard"}</td>
                      <td className={styles.tableTd}>
                        <strong>{(Number(a.commission_rate_pct) * 100).toFixed(1)}%</strong>
                      </td>
                      <td className={styles.tableTd}>
                        <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 style={{ fontSize: "1.05rem", fontWeight: 800, margin: "0 0 12px" }}>
            Itemized Commission Ledger ({commissions.length})
          </h3>
          {commissions.length === 0 ? (
            <div className={styles.emptyBlock}>No commission records generated yet.</div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.tableTh}>Ref</th>
                    <th className={styles.tableTh}>Base Amount</th>
                    <th className={styles.tableTh}>Net Payable</th>
                    <th className={styles.tableTh}>Status</th>
                    <th className={styles.tableTh}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id} className={styles.tableRow}>
                      <td className={styles.tableTd}>{c.id.slice(0, 8)}</td>
                      <td className={styles.tableTd}>${Number(c.sale_amount).toLocaleString()}</td>
                      <td className={styles.tableTd}>
                        <strong>${Number(c.total_commission).toLocaleString()}</strong>
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
                        {c.status === "pending" && (
                          <button
                            type="button"
                            onClick={() =>
                              commissionApi.approveCommission(c.id).then(() => {
                                setCommissions((prev) =>
                                  prev.map((item) =>
                                    item.id === c.id ? { ...item, status: "approved" } : item
                                  )
                                );
                              })
                            }
                            className={styles.actionBtnPrimary}
                            style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                          >
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CREATE COMMISSION AGREEMENT MODAL */}
          {createAgreementModal && (
            <div className={styles.modalOverlay}>
              <div className={styles.modalBox}>
                <button
                  className={styles.modalCloseBtn}
                  onClick={() => setCreateAgreementModal(false)}
                >
                  <X size={20} />
                </button>
                <h3 className={styles.modalTitle}>Register Commission Schedule</h3>
                <p className={styles.modalDesc}>
                  Define broker split rates for developers and accredited agencies.
                </p>

                <form onSubmit={handleCreateAgreement}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Commission Rate (Decimal, e.g. 0.03 = 3%)</label>
                    <input
                      type="number"
                      step="0.005"
                      min={0.01}
                      max={0.2}
                      required
                      className={styles.formInput}
                      value={newAgreement.rate}
                      onChange={(e) =>
                        setNewAgreement({ ...newAgreement, rate: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Agreement Terms & Scope</label>
                    <textarea
                      rows={3}
                      className={styles.formTextarea}
                      value={newAgreement.terms}
                      onChange={(e) =>
                        setNewAgreement({ ...newAgreement, terms: e.target.value })
                      }
                    />
                  </div>
                  <button
                    type="submit"
                    className={styles.actionBtnPrimary}
                    style={{ width: "100%", height: 44, justifyContent: "center" }}
                  >
                    Authorize Agreement
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. USER MANAGEMENT TAB */}
      {activeTab === "admin-users" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>User Access & Governance</h2>
              <p className={styles.sectionSubtitle}>
                Manage verified account privileges, staff assignments, and access suspensions.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setCreateUserModal(true)}
                className={styles.actionBtnPrimary}
              >
                <Plus size={14} />
                <span>Provision Staff Account</span>
              </button>
              <button
                type="button"
                onClick={() => adminManagementApi.exportUsers()}
                className={styles.actionBtnSecondary}
              >
                <Download size={14} />
                <span>Export Users CSV</span>
              </button>
            </div>
          </div>

          {userLoading ? (
            <div className={styles.emptyBlock}>Loading platform users...</div>
          ) : users.length === 0 ? (
            <div className={styles.emptyBlock}>No user records returned.</div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.tableTh}>Full Name / Email</th>
                    <th className={styles.tableTh}>Platform Role</th>
                    <th className={styles.tableTh}>Account Status</th>
                    <th className={styles.tableTh}>Created</th>
                    <th className={styles.tableTh}>Governance Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className={styles.tableRow}>
                      <td className={styles.tableTd}>
                        <strong>{u.fullName}</strong>
                        <div style={{ fontSize: "0.72rem", color: "#8c95a6" }}>{u.email}</div>
                      </td>
                      <td className={styles.tableTd}>
                        <span style={{ textTransform: "uppercase", fontWeight: 750, fontSize: "0.75rem" }}>
                          {u.role.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className={styles.tableTd}>
                        <span
                          className={`${styles.badge} ${
                            u.status === "approved"
                              ? styles.badgeActive
                              : u.status === "suspended"
                              ? styles.badgeRejected
                              : styles.badgePending
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className={styles.tableTd}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className={styles.tableTd}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {u.status !== "approved" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateUserStatus(u.id, "approved")}
                              className={styles.actionBtnPrimary}
                              style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                            >
                              Approve
                            </button>
                          )}
                          {u.status !== "suspended" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateUserStatus(u.id, "suspended")}
                              className={styles.actionBtnDanger}
                            >
                              Suspend
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

          {/* CREATE STAFF MODAL */}
          {createUserModal && (
            <div className={styles.modalOverlay}>
              <div className={styles.modalBox}>
                <button
                  className={styles.modalCloseBtn}
                  onClick={() => setCreateUserModal(false)}
                >
                  <X size={20} />
                </button>
                <h3 className={styles.modalTitle}>Provision Institutional Staff</h3>
                <p className={styles.modalDesc}>
                  Create privileged administrative access for compliance or finance controllers.
                </p>

                <form onSubmit={handleCreateStaffUser}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Staff Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Yohannes Mengistu"
                      className={styles.formInput}
                      value={newUser.fullName}
                      onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                    />
                  </div>

                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Corporate Email</label>
                    <input
                      type="email"
                      required
                      placeholder="staff@solaproperties.com"
                      className={styles.formInput}
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    />
                  </div>

                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Assigned Role</label>
                    <select
                      className={styles.formSelect}
                      value={newUser.role}
                      onChange={(e) =>
                        setNewUser({ ...newUser, role: e.target.value as any })
                      }
                    >
                      <option value="admin">Platform Administrator</option>
                      <option value="finance_admin">Finance Controller</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className={styles.actionBtnPrimary}
                    style={{ width: "100%", height: 44, justifyContent: "center" }}
                  >
                    Provision Account
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. TAXONOMY MANAGEMENT TAB */}
      {activeTab === "admin-taxonomy" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Property Taxonomy & Districts</h2>
              <p className={styles.sectionSubtitle}>
                Maintain master categories and geographical districts across Addis Ababa.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            {/* Categories */}
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 12px" }}>
                Property Categories
              </h3>
              <form onSubmit={handleCreateCategory} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input
                  type="text"
                  required
                  placeholder="New Category (e.g. Commercial Office)"
                  className={styles.formInput}
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                />
                <button type="submit" className={styles.actionBtnPrimary}>
                  Add
                </button>
              </form>
              <div style={{ border: "1px solid #e5e7eb", maxHeight: 280, overflowY: "auto" }}>
                {categories.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid #edf0f4",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>{c.name}</span>
                    <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Locations */}
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 12px" }}>
                Districts / Locations
              </h3>
              <form onSubmit={handleCreateLocation} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input
                  type="text"
                  required
                  placeholder="District (e.g. Kazanchis)"
                  className={styles.formInput}
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                />
                <button type="submit" className={styles.actionBtnPrimary}>
                  Add
                </button>
              </form>
              <div style={{ border: "1px solid #e5e7eb", maxHeight: 280, overflowY: "auto" }}>
                {locations.map((l) => (
                  <div
                    key={l.id}
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid #edf0f4",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                      {l.name} ({l.city || "Addis Ababa"})
                    </span>
                    <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. AUDIT LOGS TAB */}
      {activeTab === "admin-audit" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Immutable System Audit Trail</h2>
              <p className={styles.sectionSubtitle}>
                Compliance activity trail recording security, transactional, and status changes.
              </p>
            </div>
          </div>

          {auditLoading ? (
            <div className={styles.emptyBlock}>Loading audit trail...</div>
          ) : auditLogs.length === 0 ? (
            <div className={styles.emptyBlock}>No audit records captured yet.</div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.tableTh}>Timestamp</th>
                    <th className={styles.tableTh}>Actor</th>
                    <th className={styles.tableTh}>Action</th>
                    <th className={styles.tableTh}>Entity / Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className={styles.tableRow}>
                      <td className={styles.tableTd}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className={styles.tableTd}>
                        <strong>{log.actor_name || log.actor_id?.slice(0, 8) || "System"}</strong>
                      </td>
                      <td className={styles.tableTd}>
                        <span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                          {log.action}
                        </span>
                      </td>
                      <td className={styles.tableTd}>
                        {log.entity_type}: {log.entity_id?.slice(0, 8)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 8. EXECUTIVE PLATFORM REPORTS TAB */}
      {activeTab === "admin-reports" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Executive Platform Overview</h2>
              <p className={styles.sectionSubtitle}>
                System-wide volume, transaction velocity, and escrow settlement summaries.
              </p>
            </div>
          </div>

          {reportLoading ? (
            <div className={styles.emptyBlock}>Compiling executive platform metrics...</div>
          ) : !report ? (
            <div className={styles.emptyBlock}>
              <TrendingUp size={36} color="#9ca3af" />
              <h4 className={styles.emptyBlockTitle}>Reports Initializing</h4>
              <p className={styles.emptyBlockDesc}>Platform metrics will aggregate in real time.</p>
            </div>
          ) : (
            <div>
              <div className={styles.kpiGrid}>
                {role === "admin" ? (
                  <>
                    <div className={styles.kpiCard}>
                      <span className={styles.kpiLabel}>Total Users Registered</span>
                      <span className={styles.kpiValue}>
                        {(report as AdminReport)?.total_users ?? 0}
                      </span>
                      <span className={styles.kpiSubtext}>Buyers, agents, and developers</span>
                    </div>
                    <div className={styles.kpiCard}>
                      <span className={styles.kpiLabel}>Verified Listings</span>
                      <span className={styles.kpiValue}>
                        {(report as AdminReport)?.total_properties ?? 0}
                      </span>
                      <span className={styles.kpiSubtext}>Approved active catalog</span>
                    </div>
                    <div className={styles.kpiCard}>
                      <span className={styles.kpiLabel}>Pending Review Queue</span>
                      <span className={styles.kpiValue}>
                        {(report as AdminReport)?.pending_properties ?? 0}
                      </span>
                      <span className={styles.kpiSubtext}>Listings awaiting audit</span>
                    </div>
                    <div className={styles.kpiCard}>
                      <span className={styles.kpiLabel}>Gross Platform GMV</span>
                      <span className={styles.kpiValue}>
                        ${Number((report as AdminReport)?.total_gmv ?? 0).toLocaleString()}
                      </span>
                      <span className={styles.kpiSubtext}>Settled property capital</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.kpiCard}>
                      <span className={styles.kpiLabel}>Commissions Earned</span>
                      <span className={styles.kpiValue}>
                        ${Number((report as FinanceAdminReport)?.total_commissions_earned ?? 0).toLocaleString()}
                      </span>
                      <span className={styles.kpiSubtext}>Cumulative volume fees</span>
                    </div>
                    <div className={styles.kpiCard}>
                      <span className={styles.kpiLabel}>Platform Revenue</span>
                      <span className={styles.kpiValue}>
                        ${Number((report as FinanceAdminReport)?.platform_revenue ?? 0).toLocaleString()}
                      </span>
                      <span className={styles.kpiSubtext}>Net retained platform fees</span>
                    </div>
                    <div className={styles.kpiCard}>
                      <span className={styles.kpiLabel}>Pending Payouts</span>
                      <span className={styles.kpiValue}>
                        ${Number((report as FinanceAdminReport)?.pending_payouts ?? 0).toLocaleString()}
                      </span>
                      <span className={styles.kpiSubtext}>Commissions awaiting release</span>
                    </div>
                    <div className={styles.kpiCard}>
                      <span className={styles.kpiLabel}>Paid Commissions</span>
                      <span className={styles.kpiValue}>
                        ${Number((report as FinanceAdminReport)?.paid_commissions ?? 0).toLocaleString()}
                      </span>
                      <span className={styles.kpiSubtext}>Settled agent disbursements</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
