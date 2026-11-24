"use client";

import React, { useMemo, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemName?: string;
  style?: React.CSSProperties;
  alwaysShow?: boolean;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  itemName = "items",
  style,
  alwaysShow = true,
}: PaginationProps) {
  if (totalItems === 0) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // If alwaysShow is false and only 1 page, hide
  if (!alwaysShow && totalPages <= 1) {
    return null;
  }

  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(totalItems, currentPage * pageSize);

  // Generate page numbers with ellipsis if many pages
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
        paddingTop: 18,
        paddingBottom: 10,
        marginTop: 14,
        borderTop: "1px solid #e5e7eb",
        fontSize: "0.84rem",
        ...style,
      }}
    >
      <div style={{ color: "#6b7280", fontWeight: 500 }}>
        Showing <strong style={{ color: "#111827" }}>{start}</strong>–
        <strong style={{ color: "#111827" }}>{end}</strong> of{" "}
        <strong style={{ color: "#111827" }}>{totalItems}</strong> {itemName}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            backgroundColor: "#ffffff",
            border: "1px solid #d1d5db",
            color: currentPage <= 1 ? "#9ca3af" : "#111827",
            cursor: currentPage <= 1 ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: "0.82rem",
            opacity: currentPage <= 1 ? 0.5 : 1,
            transition: "all 0.15s ease",
          }}
        >
          <ChevronLeft size={15} />
          <span>Prev</span>
        </button>

        {/* Page Number Buttons */}
        {pageNumbers.map((p, idx) => {
          if (p === "...") {
            return (
              <span
                key={`ellipsis-${idx}`}
                style={{
                  padding: "0 6px",
                  color: "#9ca3af",
                  fontWeight: 700,
                  userSelect: "none",
                }}
              >
                &hellip;
              </span>
            );
          }

          const pageNum = Number(p);
          const isActive = pageNum === currentPage;

          return (
            <button
              key={pageNum}
              type="button"
              onClick={() => onPageChange(pageNum)}
              style={{
                minWidth: 34,
                height: 32,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 8px",
                backgroundColor: isActive ? "#0a0d14" : "#ffffff",
                color: isActive ? "#ffffff" : "#111827",
                border: `1px solid ${isActive ? "#0a0d14" : "#d1d5db"}`,
                fontWeight: isActive ? 700 : 500,
                fontSize: "0.82rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {pageNum}
            </button>
          );
        })}

        {/* Next Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            backgroundColor: "#ffffff",
            border: "1px solid #d1d5db",
            color: currentPage >= totalPages ? "#9ca3af" : "#111827",
            cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: "0.82rem",
            opacity: currentPage >= totalPages ? 0.5 : 1,
            transition: "all 0.15s ease",
          }}
        >
          <span>Next</span>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

/**
 * Universal pagination hook for in-memory or client-side paginated tables & listings
 */
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Reset page if out of bounds when items change
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    page,
    setPage,
    totalPages,
    totalItems,
    pageSize,
    pagedItems,
  };
}
