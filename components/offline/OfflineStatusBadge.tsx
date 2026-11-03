"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CloudUpload, RefreshCw, Wifi, WifiOff, X } from "lucide-react";
import { useAnnounce } from "@/components/AccessibleAnnouncer";
import { Button, focusRing } from "@/components/ui/Button";
import { useOfflineSync } from "@/lib/offline/syncManager";

/**
 * Accessible Offline Status & Synchronisation Badge (RGAA 4.1 AAA).
 * Displays real-time connectivity status, pending offline attendance count,
 * and allows triggering immediate synchronization.
 */
export function OfflineStatusBadge() {
  const announce = useAnnounce();
  const { isOnline, isSyncing, pendingCount, lastSyncTime, lastError, triggerSync } = useOfflineSync();
  const [modalOpen, setModalOpen] = useState(false);
  const prevOnlineRef = useRef(isOnline);

  // Announce network state transitions to screen readers
  useEffect(() => {
    if (prevOnlineRef.current !== isOnline) {
      if (isOnline) {
        announce("Connexion Internet rétablie. Synchronisation automatique des émargements en cours.");
      } else {
        announce("Connexion Internet perdue. Mode autonome actif : vos émargements sont sécurisés sur cet appareil.");
      }
      prevOnlineRef.current = isOnline;
    }
  }, [isOnline, announce]);

  const handleManualSync = async () => {
    announce("Lancement de la synchronisation des données...");
    await triggerSync();
    announce("Synchronisation terminée.");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-xl border px-2 sm:px-2.5 py-1 text-xs font-bold transition-all min-h-10 ${focusRing} ${
          !isOnline
            ? "border-amber-500/50 bg-amber-500/10 text-amber-500 dark:text-amber-400"
            : pendingCount > 0
              ? "border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-300"
              : "border-border-subtle bg-surface-container-high text-on-surface-variant hover:text-primary hover:bg-surface-variant"
        }`}
        aria-label={`État réseau : ${
          !isOnline
            ? `Hors ligne, ${pendingCount} émargement${pendingCount > 1 ? "s" : ""} en attente.`
            : isSyncing
              ? "Synchronisation en cours..."
              : pendingCount > 0
                ? `${pendingCount} émargement${pendingCount > 1 ? "s" : ""} en attente de synchronisation.`
                : "En ligne, données synchronisées."
        } Cliquez pour afficher les détails.`}
        title="État du mode hors-ligne et synchronisation"
      >
        {isSyncing ? (
          <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
        ) : !isOnline ? (
          <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
        ) : pendingCount > 0 ? (
          <CloudUpload className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400 animate-pulse" aria-hidden="true" />
        ) : (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-status-present opacity-75 animate-ping"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-status-present"></span>
          </span>
        )}

        <span className="hidden sm:inline">
          {isSyncing
            ? "Synchronisation…"
            : !isOnline
              ? "Hors-ligne"
              : pendingCount > 0
                ? `${pendingCount} en attente`
                : "En ligne"}
        </span>

        {pendingCount > 0 && !isSyncing && (
          <span className="inline-flex sm:hidden h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1">
            {pendingCount}
          </span>
        )}
      </button>

      {/* Accessible Detail Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="offline-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface-container-lowest p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    !isOnline ? "bg-amber-500/10 text-amber-500" : "bg-status-present-bg text-status-present"
                  }`}
                  aria-hidden="true"
                >
                  {!isOnline ? <WifiOff className="h-5 w-5" /> : <Wifi className="h-5 w-5" />}
                </div>
                <div>
                  <h2 id="offline-modal-title" className="text-base font-bold text-on-surface">
                    Mode Hors-Ligne &amp; Synchronisation
                  </h2>
                  <p className="text-xs text-on-surface-variant">ESRP / CFRP Valentin Haüy</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className={`rounded-xl p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors ${focusRing}`}
                aria-label="Fermer la fenêtre d'information hors-ligne"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 py-4 text-sm text-on-surface">
              {/* Network Status Card */}
              <div className="rounded-xl border border-border-subtle bg-surface-container-high/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                    Connectivité Réseau
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isOnline
                        ? "bg-status-present-bg text-status-present"
                        : "bg-amber-500/10 text-amber-500 dark:text-amber-400"
                    }`}
                  >
                    {isOnline ? "Connecté à Internet" : "Déconnecté (Mode Autonome)"}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">
                  {isOnline
                    ? "Votre appareil communique en temps réel avec la base de données certifiée."
                    : "En cas de coupure réseau, vos pointages sont stockés et horodatés sur cet appareil sans interruption."}
                </p>
              </div>

              {/* Pending Queue Count */}
              <div className="rounded-xl border border-border-subtle bg-surface-container-high/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                    File d&apos;Attente Locale (IndexedDB)
                  </span>
                  <span className="font-bold text-sm text-primary">
                    {pendingCount} émargement{pendingCount > 1 ? "s" : ""} en attente
                  </span>
                </div>
                {lastSyncTime && (
                  <p className="text-xs text-on-surface-variant">
                    Dernière synchronisation réussie :{" "}
                    <span className="font-semibold text-on-surface">
                      {new Date(lastSyncTime).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </p>
                )}
                {lastError && (
                  <p className="text-xs text-status-absent font-semibold">
                    Dernier incident : {lastError}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border-subtle">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Fermer
              </Button>
              <Button
                variant="primary"
                onClick={handleManualSync}
                disabled={isSyncing || !isOnline || pendingCount === 0}
                className="gap-2"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Synchronisation…</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    <span>Synchroniser maintenant</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

