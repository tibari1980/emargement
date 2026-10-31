"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/features/notifications/useNotifications";
import { NotificationCenter } from "./NotificationCenter";
import { focusRing } from "@/components/ui/Button";

export function NotificationBell() {
  const { unreadCount, notifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  // Global keyboard shortcut: Alt + N opens/closes the notification center
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const hasUrgent = notifications.some((n) => n.type === "urgent" && !n.read);

  const ariaLabel =
    unreadCount > 0
      ? `Centre de notifications : ${unreadCount} notification${
          unreadCount > 1 ? "s" : ""
        } non lue${unreadCount > 1 ? "s" : ""}${
          hasUrgent ? " dont des alertes urgentes" : ""
        }. Raccourci clavier Alt + N`
      : "Centre de notifications : aucune notification non lue. Raccourci clavier Alt + N";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={ariaLabel}
        title={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-border-subtle bg-surface-container-high p-2 text-primary hover:bg-surface-variant transition-colors ${focusRing}`}
      >
        <Bell className="h-5 w-5 shrink-0" aria-hidden="true" />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-extrabold text-white shadow-xs ${
              hasUrgent ? "bg-status-absent animate-pulse" : "bg-primary"
            }`}
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <NotificationCenter isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
