"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  CheckCheck,
  Filter,
  X,
  AlertTriangle,
  Inbox,
} from "lucide-react";
import { useNotifications } from "@/features/notifications/useNotifications";
import { NotificationItem } from "./NotificationItem";
import { Button, focusRing } from "@/components/ui/Button";

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

type FilterTab = "all" | "unread" | "urgent";

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus close button when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Lock body scroll when open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const urgentCount = useMemo(
    () => notifications.filter((n) => n.type === "urgent" && !n.read).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    switch (activeTab) {
      case "unread":
        return notifications.filter((n) => !n.read);
      case "urgent":
        return notifications.filter((n) => n.type === "urgent");
      case "all":
      default:
        return notifications;
    }
  }, [notifications, activeTab]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Centre de notifications Valentin Haüy"
      className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      {/* Backdrop overlay */}
      <div
        className="flex-1 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        ref={dialogRef}
        className="relative flex flex-col w-full max-w-lg bg-surface-container-lowest h-screen max-h-screen shadow-2xl border-l-2 border-border-subtle animate-in slide-in-from-right duration-250 z-[101]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle p-4 sm:px-6 bg-surface-container/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-container text-white shadow-xs">
              <Bell className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-on-surface">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant">
                Alertes de séances, assiduité et échéances
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Fermer le centre de notifications (Touche Échap)"
              className={`p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors ${focusRing}`}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Tab Filters & Mark All Read action */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-4 sm:px-6 py-2.5 bg-surface-container/10">
          {/* Filter Pills */}
          <div
            role="tablist"
            aria-label="Filtrer les notifications"
            className="flex items-center gap-1 sm:gap-1.5"
          >
            <button
              role="tab"
              type="button"
              aria-selected={activeTab === "all"}
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${focusRing} ${
                activeTab === "all"
                  ? "bg-primary-container text-white shadow-xs"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              Toutes ({notifications.length})
            </button>

            <button
              role="tab"
              type="button"
              aria-selected={activeTab === "unread"}
              onClick={() => setActiveTab("unread")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${focusRing} ${
                activeTab === "unread"
                  ? "bg-primary-container text-white shadow-xs"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              Non lues ({unreadCount})
            </button>

            <button
              role="tab"
              type="button"
              aria-selected={activeTab === "urgent"}
              onClick={() => setActiveTab("urgent")}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${focusRing} ${
                activeTab === "urgent"
                  ? "bg-status-absent text-white shadow-xs"
                  : "text-status-absent hover:bg-red-50 dark:hover:bg-red-950/30"
              }`}
            >
              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Urgentes ({urgentCount})</span>
            </button>
          </div>

          {/* Mark all as read button */}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-primary hover:text-primary-container hover:bg-primary/5 rounded-lg transition-colors ${focusRing}`}
              aria-label="Marquer toutes les notifications comme lues"
            >
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              <span className="hidden xs:inline">Tout marquer lu</span>
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Liste des notifications"
          className="flex-1 min-h-0 overflow-y-auto p-4 sm:px-6 space-y-3 outline-none"
        >
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-on-surface-variant">
              <div className="p-4 rounded-full bg-surface-container mb-3" aria-hidden="true">
                <Inbox className="h-8 w-8 text-on-surface-variant/60" />
              </div>
              <p className="text-sm font-bold text-on-surface">
                {activeTab === "unread"
                  ? "Vous êtes à jour !"
                  : "Aucune notification à afficher"}
              </p>
              <p className="text-xs text-on-surface-variant mt-1 max-w-xs">
                {activeTab === "unread"
                  ? "Toutes les alertes d'émargement et d'assiduité ont été consultées."
                  : "Les nouvelles alertes pédagogiques et administratives s'afficheront ici."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <NotificationItem
                key={notif.id}
                notification={notif}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
                onActionClick={onClose}
              />
            ))
          )}
        </div>

        {/* Footer with keyboard hint */}
        <div className="border-t border-border-subtle p-3 px-4 sm:px-6 bg-surface-container/20 flex items-center justify-between text-xs text-on-surface-variant shrink-0">
          <span>
            Raccourci clavier : <kbd className="px-1.5 py-0.5 rounded bg-surface-container font-mono text-[11px] font-bold">Alt + N</kbd>
          </span>
          <button
            type="button"
            onClick={onClose}
            className={`font-semibold text-primary hover:underline ${focusRing} px-2 py-0.5 rounded`}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
