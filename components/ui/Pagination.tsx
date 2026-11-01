"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { focusRing } from "./Button";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemName?: string;
  ariaLabel?: string;
}

/**
 * Standard accessible Pagination component conforming to RGAA 4.1 AAA.
 * Provides keyboard navigation, clear ARIA states, page-size selection, and high-contrast support.
 */
export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  itemName = "éléments",
  ariaLabel = "Navigation dans les pages",
}: PaginationProps) {
  if (totalItems <= 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate visible page numbers with intelligent truncation (e.g. 1 ... 4 5 6 ... 10)
  const getPageNumbers = (): (number | "ellipsis")[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | "ellipsis")[] = [];
    const delta = 1; // Show current page +/- 1

    const left = currentPage - delta;
    const right = currentPage + delta;

    pages.push(1);

    if (left > 3) {
      pages.push("ellipsis");
    } else if (left === 3) {
      pages.push(2);
    }

    for (let i = Math.max(2, left); i <= Math.min(totalPages - 1, right); i++) {
      pages.push(i);
    }

    if (right < totalPages - 2) {
      pages.push("ellipsis");
    } else if (right === totalPages - 2) {
      pages.push(totalPages - 1);
    }

    pages.push(totalPages);
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <nav
      role="navigation"
      aria-label={ariaLabel}
      className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 py-4 px-1 sm:px-2 border-t border-border-subtle text-sm text-on-surface"
    >
      {/* Information & Page Size Selector */}
      <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-on-surface-variant font-medium">
        <span>
          Affichage de <strong className="font-bold text-on-surface">{startItem}</strong> à{" "}
          <strong className="font-bold text-on-surface">{endItem}</strong> sur{" "}
          <strong className="font-bold text-on-surface">{totalItems}</strong> {itemName}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-0 sm:ml-2">
            <label htmlFor="pagination-page-size" className="text-xs text-on-surface-variant">
              Par page :
            </label>
            <select
              id="pagination-page-size"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label={`Nombre de ${itemName} par page`}
              className={`rounded-lg border border-border-subtle bg-surface-container-high px-2 py-1 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary ${focusRing}`}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Screen Reader Live Region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Page {currentPage} sur {totalPages}, affichage des {itemName} {startItem} à {endItem}
      </div>

      {/* Navigation Buttons (only show if totalPages > 1) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between sm:justify-end gap-1">
          {/* First Page */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1}
            aria-label="Aller à la première page"
            className={`hidden sm:inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-border-subtle bg-surface-container-high p-1.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-variant disabled:opacity-30 disabled:cursor-not-allowed ${focusRing}`}
          >
            <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Première page</span>
          </button>

          {/* Previous Page */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Aller à la page précédente"
            className={`inline-flex min-h-11 sm:min-h-9 items-center gap-1 rounded-lg border border-border-subtle bg-surface-container-high px-2.5 py-1 text-xs font-bold text-on-surface transition-colors hover:bg-surface-variant disabled:opacity-30 disabled:cursor-not-allowed ${focusRing}`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden xs:inline">Précédent</span>
          </button>

          {/* Page Numbers (Desktop) */}
          <div className="hidden sm:flex items-center gap-1 mx-1">
            {pages.map((p, idx) => {
              if (p === "ellipsis") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="min-h-9 min-w-9 flex items-center justify-center text-xs text-on-surface-variant select-none"
                    aria-hidden="true"
                  >
                    …
                  </span>
                );
              }

              const isCurrent = p === currentPage;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-current={isCurrent ? "page" : undefined}
                  aria-label={isCurrent ? `Page actuelle, page ${p}` : `Aller à la page ${p}`}
                  className={`min-h-9 min-w-9 rounded-lg border text-xs font-bold transition-all ${focusRing} ${
                    isCurrent
                      ? "border-primary bg-primary-container text-on-primary shadow-xs"
                      : "border-border-subtle bg-surface-container-high text-on-surface hover:bg-surface-variant"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Mobile Current Page Indicator */}
          <span className="inline-flex sm:hidden px-2 text-xs font-bold text-on-surface">
            {currentPage} / {totalPages}
          </span>

          {/* Next Page */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Aller à la page suivante"
            className={`inline-flex min-h-11 sm:min-h-9 items-center gap-1 rounded-lg border border-border-subtle bg-surface-container-high px-2.5 py-1 text-xs font-bold text-on-surface transition-colors hover:bg-surface-variant disabled:opacity-30 disabled:cursor-not-allowed ${focusRing}`}
          >
            <span className="hidden xs:inline">Suivant</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Last Page */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
            aria-label="Aller à la dernière page"
            className={`hidden sm:inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-border-subtle bg-surface-container-high p-1.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-variant disabled:opacity-30 disabled:cursor-not-allowed ${focusRing}`}
          >
            <ChevronsRight className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Dernière page</span>
          </button>
        </div>
      )}
    </nav>
  );
}
