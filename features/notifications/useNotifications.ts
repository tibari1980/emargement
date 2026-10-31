"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import type { AppNotification } from "@/lib/domain/types";
import {
  subscribeNotifications,
  markAsRead as markAsReadData,
  markAllAsRead as markAllAsReadData,
  deleteNotification as deleteNotificationData,
  createNotification as createNotificationData,
  getUnreadCount,
} from "@/lib/data/notifications";

export function useNotifications() {
  const { profile } = useAuth();
  const announce = useAnnounce();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const userRef = { id: profile.id, role: profile.role };

    const unsubscribe = subscribeNotifications(userRef, (items) => {
      setNotifications(items);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [profile]);

  const unreadCount = useMemo(() => getUnreadCount(notifications), [notifications]);

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read),
    [notifications]
  );

  const markAsRead = useCallback(
    async (notificationId: string) => {
      const item = notifications.find((n) => n.id === notificationId);
      await markAsReadData(notificationId);
      if (item) {
        announce(`Notification "${item.title}" marquée comme lue.`, "polite");
      }
    },
    [notifications, announce]
  );

  const markAllAsRead = useCallback(async () => {
    if (!profile) return;
    await markAllAsReadData({ id: profile.id, role: profile.role });
    announce("Toutes les notifications ont été marquées comme lues.", "polite");
  }, [profile, announce]);

  const deleteNotification = useCallback(
    async (notificationId: string) => {
      await deleteNotificationData(notificationId);
      announce("Notification supprimée.", "polite");
    },
    [announce]
  );

  const createNotification = useCallback(
    async (data: Omit<AppNotification, "id" | "createdAt" | "read">) => {
      const id = await createNotificationData(data);
      announce(`Nouvelle notification : ${data.title}`, "polite");
      return id;
    },
    [announce]
  );

  return {
    notifications,
    unreadCount,
    unreadNotifications,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createNotification,
  };
}
