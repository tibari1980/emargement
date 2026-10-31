"use client";

import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
  Trash2,
} from "lucide-react";
import type { AppNotification, NotificationType } from "@/lib/domain/types";
import { focusRing } from "@/components/ui/Button";

interface NotificationItemProps {
  notification: AppNotification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onActionClick?: () => void;
}

const TYPE_CONFIG: Record<
  NotificationType,
  {
    icon: typeof Info;
    badgeLabel: string;
    badgeStyle: string;
    borderAccent: string;
  }
> = {
  urgent: {
    icon: AlertTriangle,
    badgeLabel: "Urgent",
    badgeStyle: "bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-200",
    borderAccent: "border-l-4 border-l-red-600",
  },
  warning: {
    icon: AlertCircle,
    badgeLabel: "Avertissement",
    badgeStyle: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200",
    borderAccent: "border-l-4 border-l-amber-500",
  },
  info: {
    icon: Info,
    badgeLabel: "Information",
    badgeStyle: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200",
    borderAccent: "border-l-4 border-l-blue-600",
  },
  success: {
    icon: CheckCircle2,
    badgeLabel: "Succès",
    badgeStyle: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200",
    borderAccent: "border-l-4 border-l-emerald-600",
  },
};

function formatRelativeTime(dateString: string): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays === 1) return "Hier";
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onActionClick,
}: NotificationItemProps) {
  const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.info;
  const IconComponent = config.icon;

  return (
    <article
      aria-label={`${config.badgeLabel} : ${notification.title}. ${notification.read ? "Lue." : "Non lue."}`}
      className={`relative p-3.5 sm:p-4 rounded-xl border border-border-subtle bg-surface-container-lowest transition-all hover:bg-surface-variant/40 ${
        config.borderAccent
      } ${!notification.read ? "shadow-xs ring-1 ring-primary/10" : "opacity-90"}`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Header icon and title */}
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div
            className={`p-1.5 rounded-lg border shrink-0 mt-0.5 ${config.badgeStyle}`}
            aria-hidden="true"
          >
            <IconComponent className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${config.badgeStyle}`}
              >
                {config.badgeLabel}
              </span>

              {!notification.read && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  <span>Non lue</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant font-medium ml-auto">
                <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                <time dateTime={notification.createdAt}>
                  {formatRelativeTime(notification.createdAt)}
                </time>
              </span>
            </div>

            <h4 className="text-sm font-bold text-on-surface mt-1.5 leading-snug">
              {notification.title}
            </h4>

            <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
              {notification.message}
            </p>

            {/* Direct Action Link if provided */}
            {notification.actionUrl && (
              <div className="mt-3">
                <Link
                  href={notification.actionUrl}
                  onClick={() => {
                    if (!notification.read) onMarkAsRead(notification.id);
                    if (onActionClick) onActionClick();
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-on-primary bg-primary-container hover:opacity-95 rounded-lg transition-opacity ${focusRing}`}
                >
                  <span>{notification.actionLabel || "Accéder à l'action"}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick action buttons: mark as read / delete */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {!notification.read && (
            <button
              type="button"
              onClick={() => onMarkAsRead(notification.id)}
              title="Marquer cette notification comme lue"
              aria-label={`Marquer comme lue la notification "${notification.title}"`}
              className={`p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors ${focusRing}`}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onDelete(notification.id)}
            title="Supprimer cette notification"
            aria-label={`Supprimer la notification "${notification.title}"`}
            className={`p-1.5 rounded-lg text-on-surface-variant hover:text-status-absent hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors ${focusRing}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
