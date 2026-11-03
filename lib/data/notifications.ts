import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  updateDoc,
  deleteDoc,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/core/firebase";
import type { AppNotification, Role } from "@/lib/domain/types";
import { COLLECTIONS, stripMeta, withId } from "./db";
import type { Actor } from "./audit";

const notificationsCollection = () => collection(getDb(), COLLECTIONS.notifications);
const LOCAL_NOTIFS_KEY = "avh_persisted_notifications_v2";

// In-memory & localStorage reactive store for offline/fast resilience
const initialDemoNotifications: AppNotification[] = [
  {
    id: "notif-welcome",
    title: "Bienvenue sur l'Espace Valentin Haüy",
    message: "Plateforme certifiée d'émargement et de suivi pédagogique conforme aux exigences de l'ASP.",
    type: "info",
    createdAt: new Date().toISOString(),
    read: false,
  },
  {
    id: "notif-asp-info",
    title: "Protection des justificatifs administratifs",
    message: "Les absences justifiées enregistrées par le secrétariat sont automatiquement protégées contre les pénalités ASP.",
    type: "success",
    createdAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
    read: false,
  },
  {
    id: "notif-a11y-shortcuts",
    title: "Accessibilité & Raccourcis clavier",
    message: "Raccourcis disponibles : Alt + M (mode sombre), Alt + A (options visuelles), Alt + N (centre de notifications), NVDA + F7.",
    type: "info",
    createdAt: new Date(Date.now() - 3600_000 * 4).toISOString(),
    read: false,
  },
];

let localNotifications: AppNotification[] = [...initialDemoNotifications];
let localNotifsLoaded = false;

function ensureLocalNotifsLoaded() {
  if (localNotifsLoaded || typeof window === "undefined") return;
  localNotifsLoaded = true;
  try {
    const raw = localStorage.getItem(LOCAL_NOTIFS_KEY);
    if (raw) {
      const parsed: AppNotification[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        localNotifications = parsed;
      }
    }
  } catch {}
}

function saveLocalNotifs() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_NOTIFS_KEY, JSON.stringify(localNotifications.slice(0, 50)));
  } catch {}
}

type ChangeListener = () => void;
const listeners = new Set<ChangeListener>();

function notifyListeners() {
  saveLocalNotifs();
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.warn("Notification listener error:", e);
    }
  }
}

/** Filter notifications for a specific user and role */
export function filterNotificationsForUser(
  items: AppNotification[],
  user: { id: string; role: Role }
): AppNotification[] {
  return items
    .filter((n) => {
      if (n.userId && n.userId === user.id) return true;
      if (n.targetRole && n.targetRole === user.role) return true;
      if (!n.userId && !n.targetRole) return true; // broadcast
      return false;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * List all notifications for the given user.
 */
export async function listNotifications(user: { id: string; role: Role }): Promise<AppNotification[]> {
  try {
    const raceTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Firestore timeout")), 600)
    );
    const fetchFirestore = async () => {
      const snap = await getDocs(notificationsCollection());
      if (snap.empty) return filterNotificationsForUser(localNotifications, user);
      const items = snap.docs.map((d) => withId<AppNotification>(d));
      return filterNotificationsForUser(items, user);
    };
    return await Promise.race([fetchFirestore(), raceTimeout]);
  } catch {
    return filterNotificationsForUser(localNotifications, user);
  }
}

/**
 * Subscribe to real-time notification changes for the current user.
 */
export function subscribeNotifications(
  user: { id: string; role: Role },
  callback: (notifications: AppNotification[]) => void
): Unsubscribe {
  ensureLocalNotifsLoaded();
  // Always emit local data immediately (0ms)
  callback(filterNotificationsForUser(localNotifications, user));

  // Local listener for in-memory updates
  const localListener: ChangeListener = () => {
    callback(filterNotificationsForUser(localNotifications, user));
  };
  listeners.add(localListener);

  // Firestore onSnapshot with limit(50) for scalability
  let unsubFirestore: Unsubscribe | null = null;
  try {
    const q = query(notificationsCollection(), limit(50));
    unsubFirestore = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const items = snap.docs.map((d) => withId<AppNotification>(d));
          const mergedMap = new Map<string, AppNotification>();
          localNotifications.forEach((n) => mergedMap.set(n.id, n));
          items.forEach((n) => mergedMap.set(n.id, n));
          localNotifications = Array.from(mergedMap.values());
          saveLocalNotifs();
          callback(filterNotificationsForUser(localNotifications, user));
        }
      },
      () => {
        // Fallback already handled by local listener
      }
    );
  } catch {
    // Ignore offline errors
  }

  return () => {
    listeners.delete(localListener);
    if (unsubFirestore) unsubFirestore();
  };
}

/**
 * Create a new notification.
 */
export async function createNotification(
  data: Omit<AppNotification, "id" | "createdAt" | "read">,
  _actor?: Actor
): Promise<string> {
  const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const notification: AppNotification = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
    read: false,
  };

  // Update local store
  localNotifications = [notification, ...localNotifications];
  notifyListeners();

  // Try saving to Firestore
  try {
    await setDoc(doc(notificationsCollection(), id), stripMeta(notification));
  } catch {
    // In-memory fallback is active
  }

  return id;
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(notificationId: string): Promise<void> {
  localNotifications = localNotifications.map((n) =>
    n.id === notificationId ? { ...n, read: true } : n
  );
  notifyListeners();

  try {
    await updateDoc(doc(notificationsCollection(), notificationId), { read: true });
  } catch {
    // Fallback updated
  }
}

/**
 * Mark all notifications for the given user as read.
 */
export async function markAllAsRead(user: { id: string; role: Role }): Promise<void> {
  localNotifications = localNotifications.map((n) => {
    const isTarget =
      (n.userId && n.userId === user.id) ||
      (n.targetRole && n.targetRole === user.role) ||
      (!n.userId && !n.targetRole);
    return isTarget ? { ...n, read: true } : n;
  });
  notifyListeners();

  try {
    // Best effort firestore update
    const userNotifs = filterNotificationsForUser(localNotifications, user);
    for (const notif of userNotifs) {
      if (!notif.read) {
        updateDoc(doc(notificationsCollection(), notif.id), { read: true }).catch(() => {});
      }
    }
  } catch {
    // Handled
  }
}

/**
 * Delete a notification.
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  localNotifications = localNotifications.filter((n) => n.id !== notificationId);
  notifyListeners();

  try {
    await deleteDoc(doc(notificationsCollection(), notificationId));
  } catch {
    // Handled
  }
}

/**
 * Helper to count unread notifications.
 */
export function getUnreadCount(notifications: AppNotification[]): number {
  return notifications.filter((n) => !n.read).length;
}
