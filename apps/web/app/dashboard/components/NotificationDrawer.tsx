"use client";

import React, { useState, useEffect } from "react";
import { Bell, X, CheckCheck } from "lucide-react";
import { InAppNotification, notificationApi } from "../../../lib/api";
import styles from "./workstations.module.css";

interface NotificationDrawerProps {
  onUnreadChange?: (count: number) => void;
}

export function NotificationDrawer({ onUnreadChange }: NotificationDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const fetchUnread = async () => {
    try {
      const res = await notificationApi.getUnreadCount();
      if (res.ok && res.data) {
        const count = res.data.count ?? res.data.unreadCount ?? 0;
        setUnreadCount(count);
        onUnreadChange?.(count);
      }
    } catch {
      // Ignore poll fail
    }
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await notificationApi.list();
      if (res.ok && res.data) {
        const list = res.data.notifications || res.data.data || [];
        setNotifications(list);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnread();
    const timer = setInterval(fetchUnread, 30000); // 30s poll
    return () => clearInterval(timer);
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    fetchList();
    fetchUnread();
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      onUnreadChange?.(0);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title="In-App Notifications"
        style={{
          position: "relative",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Bell size={20} color="#000000" />
        {unreadCount > 0 && (
          <span className={styles.badgeNotification}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={styles.drawerOverlay} onClick={() => setIsOpen(false)}>
          <div
            className={styles.drawerPanel}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.drawerHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Bell size={18} />
                <h3 className={styles.drawerTitle}>Notifications</h3>
                {unreadCount > 0 && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      backgroundColor: "#f3f4f6",
                      padding: "2px 6px",
                    }}
                  >
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className={styles.actionBtnSecondary}
                    style={{ height: 30, padding: "0 8px", fontSize: "0.7rem" }}
                  >
                    <CheckCheck size={14} />
                    <span>Mark all</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className={styles.drawerList}>
              {loading ? (
                <div style={{ padding: 32, textAlign: "center", fontSize: "0.85rem", color: "#6b7280" }}>
                  Retrieving notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div style={{ padding: 48, textAlign: "center", color: "#9ca3af" }}>
                  <Bell size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: "0.88rem" }}>No notifications right now.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`${styles.notifItem} ${
                      !n.is_read ? styles.notifItemUnread : ""
                    }`}
                    onClick={() => !n.is_read && handleMarkRead(n.id)}
                  >
                    <h5 className={styles.notifTitle}>{n.title}</h5>
                    <p className={styles.notifMsg}>{n.message}</p>
                    <div className={styles.notifTime}>
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
