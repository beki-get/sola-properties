"use client";

import React, { createContext, useContext, useState, useCallback, useId } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  toast: {
    info: (message: string, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setToasts((prev) => [...prev, { id, message, type }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toast = {
    info: (msg: string, dur?: number) => showToast(msg, "info", dur),
    success: (msg: string, dur?: number) => showToast(msg, "success", dur),
    warning: (msg: string, dur?: number) => showToast(msg, "warning", dur),
    error: (msg: string, dur?: number) => showToast(msg, "error", dur),
  };

  return (
    <ToastContext.Provider value={{ showToast, toast }}>
      {children}
      {/* Toast Notification Container */}
      <div
        role="region"
        aria-live="polite"
        aria-label="Notifications"
        style={{
          position: "fixed",
          top: 24,
          right: 24,
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: 420,
          width: "calc(100vw - 48px)",
          pointerEvents: "none",
        }}
      >
        {toasts.map((item) => {
          const icon =
            item.type === "success" ? (
              <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0 }} />
            ) : item.type === "warning" ? (
              <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
            ) : item.type === "error" ? (
              <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
            ) : (
              <Info size={18} color="#60a5fa" style={{ flexShrink: 0 }} />
            );

          const borderColor =
            item.type === "success"
              ? "rgba(16, 185, 129, 0.3)"
              : item.type === "warning"
              ? "rgba(245, 158, 11, 0.4)"
              : item.type === "error"
              ? "rgba(239, 68, 68, 0.4)"
              : "rgba(255, 255, 255, 0.15)";

          return (
            <div
              key={item.id}
              style={{
                pointerEvents: "auto",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "14px 18px",
                backgroundColor: "#0a0d14",
                color: "#f9fafb",
                border: `1px solid ${borderColor}`,
                boxShadow:
                  "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)",
                animation: "toastSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              }}
            >
              {icon}
              <div
                style={{
                  flex: 1,
                  fontSize: "0.88rem",
                  lineHeight: "1.45",
                  fontWeight: 500,
                  color: "#f3f4f6",
                }}
              >
                {item.message}
              </div>
              <button
                type="button"
                onClick={() => removeToast(item.id)}
                aria-label="Close notification"
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 2,
                  margin: "-2px -4px 0 0",
                  cursor: "pointer",
                  color: "#9ca3af",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <style jsx global>{`
        @keyframes toastSlideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
