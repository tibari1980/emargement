"use client";

import { useEffect } from "react";
import { initOfflineSyncManager } from "@/lib/offline/syncManager";

/**
 * Client component that registers the PWA Service Worker
 * and initializes offline synchronization listeners.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    // Initialize offline sync manager event listeners
    initOfflineSyncManager();

    // Register Service Worker in supporting browsers (production & modern environments)
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.info("[PWA] Service Worker registered successfully with scope:", registration.scope);
          })
          .catch((error) => {
            console.warn("[PWA] Service Worker registration failed (expected during certain dev setups):", error);
          });
      });
    }
  }, []);

  return null;
}

