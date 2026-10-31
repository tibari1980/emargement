import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  deleteDoc,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/core/firebase";
import type { AppNotification, Role, NotificationType } from "@/lib/domain/types";
import { COLLECTIONS, stripMeta, withId } from "./db";
import type { Actor } from "./audit";

const notificationsCollection = () => collection(getDb(), COLLECTIONS.notifications);

// In-memory reactive store for demo and offline resilience
const initialDemoNotifications: AppNotification[] = [
  // Trainer notifications
  {
    id: "notif-trn-1",
    targetRole: "trainer",
    title: "Rappel d'émargement",
    message: "Séance Bureautique JAWS (Salle A104) en cours — Pensez à enregistrer les présences avant la fin de l'heure.",
    type: "urgent",
    actionUrl: "/trainer/emargement",
    actionLabel: "Émarger la séance",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    sourceEvent: "session_pending",
  },
  {
    id: "notif-trn-2",
    targetRole: "trainer",
    title: "Justificatif médical validé",
    message: "L'absence de Lucas Martin a été justifiée par le secrétariat (Certificat médical du 28 au 31 octobre).",
    type: "info",
    actionUrl: "/trainer/emargement",
    actionLabel: "Voir la séance",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    sourceEvent: "justification_validated",
  },
  {
    id: "notif-trn-3",
    targetRole: "trainer",
    title: "Nouveau stagiaire intégré",
    message: "Sophie Laurent a été affectée au groupe TIP 1ère Année et ajoutée à votre liste d'appel.",
    type: "info",
    actionUrl: "/planning",
    actionLabel: "Consulter le planning",
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    sourceEvent: "trainee_enrolled",
  },

  // Secretariat notifications
  {
    id: "notif-sec-1",
    targetRole: "secretary",
    title: "Formateur absent — Suppléance requise",
    message: "Michel Leroy est absent ce matin. Action requise : assigner un suppléant ou valider l'Option B (TP supervisé en autonomie).",
    type: "urgent",
    actionUrl: "/secretary/emargement",
    actionLabel: "Gérer l'émargement",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    sourceEvent: "trainer_absence",
  },
  {
    id: "notif-sec-2",
    targetRole: "secretary",
    title: "Nouveau justificatif d'absence à traiter",
    message: "Chloé Petit a transmis un arrêt de travail de 3 jours à consigner dans le registre officiel.",
    type: "warning",
    actionUrl: "/secretary/justifications",
    actionLabel: "Examiner le justificatif",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    sourceEvent: "justification_pending",
  },
  {
    id: "notif-sec-3",
    targetRole: "secretary",
    title: "Échéance Télétransmission ASP (RSFP)",
    message: "Le calcul des heures d'assiduité du mois d'octobre est finalisé. Bordereau prêt pour envoi à l'ASP.",
    type: "info",
    actionUrl: "/pedagogical/reports?mode=asp",
    actionLabel: "Ouvrir le bordereau ASP",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    sourceEvent: "asp_deadline",
  },

  // Pedagogical Lead notifications
  {
    id: "notif-ped-1",
    targetRole: "pedagogical_lead",
    title: "Alerte Décrochage Qualiopi",
    message: "Thomas Bernard cumule plus de 2 heures de retard non justifiées ce mois-ci. Risque de retenue ASP.",
    type: "warning",
    actionUrl: "/pedagogical/reports",
    actionLabel: "Consulter l'assiduité",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    sourceEvent: "dropout_warning",
  },
  {
    id: "notif-ped-2",
    targetRole: "pedagogical_lead",
    title: "Planification des créneaux",
    message: "Grille hebdomadaire de la promotion Prépa Info mise à jour sans conflit de salles ni de formateurs.",
    type: "success",
    actionUrl: "/pedagogical/timetable",
    actionLabel: "Voir l'emploi du temps",
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    sourceEvent: "timetable_updated",
  },

  // Admin notifications
  {
    id: "notif-adm-1",
    targetRole: "admin",
    title: "Contrôle de Sécurité ANSSI",
    message: "Tous les mots de passe des comptes actifs respectent la politique de complexité 12+ caractères.",
    type: "success",
    actionUrl: "/admin/users",
    actionLabel: "Gérer les utilisateurs",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    sourceEvent: "security_audit",
  },
  {
    id: "notif-adm-2",
    targetRole: "admin",
    title: "Journal d'Audit Immuable",
    message: "18 nouveaux événements d'émargement et de gouvernance ont été scellés aujourd'hui avec horodatage.",
    type: "info",
    actionUrl: "/admin/audit",
    actionLabel: "Consulter le journal",
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    sourceEvent: "audit_checkpoint",
  },
];

let localNotifications: AppNotification[] = [...initialDemoNotifications];
type ChangeListener = () => void;
const listeners = new Set<ChangeListener>();

function notifyListeners() {
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
  // Always emit local data immediately
  callback(filterNotificationsForUser(localNotifications, user));

  // Local listener for in-memory updates
  const localListener: ChangeListener = () => {
    callback(filterNotificationsForUser(localNotifications, user));
  };
  listeners.add(localListener);

  // Firestore onSnapshot if available
  let unsubFirestore: Unsubscribe | null = null;
  try {
    const q = notificationsCollection();
    unsubFirestore = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const items = snap.docs.map((d) => withId<AppNotification>(d));
          callback(filterNotificationsForUser(items, user));
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
