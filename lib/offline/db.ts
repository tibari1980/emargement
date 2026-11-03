import type { PendingAttendanceRecord } from "./types";

const DB_NAME = "avh_offline_db_v1";
const STORE_NAME = "pending_attendances";
const DB_VERSION = 1;
const FALLBACK_KEY = "avh_offline_pending_records_v1";

// In-memory fallback (e.g. for Node.js / Vitest environment without browser globals)
const memoryStore = new Map<string, PendingAttendanceRecord>();

function isIndexedDBAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(new Error("IndexedDB not available"));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
        store.createIndex("clientTimestamp", "clientTimestamp", { unique: false });
        store.createIndex("date", "date", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

function loadLocalStorageFallback(): Map<string, PendingAttendanceRecord> {
  if (typeof window === "undefined") return memoryStore;
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (raw) {
      const list: PendingAttendanceRecord[] = JSON.parse(raw);
      const map = new Map<string, PendingAttendanceRecord>();
      list.forEach((r) => map.set(r.id, r));
      return map;
    }
  } catch {}
  return memoryStore;
}

function saveLocalStorageFallback(map: Map<string, PendingAttendanceRecord>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(Array.from(map.values())));
  } catch {}
}

/**
 * Enqueues or updates a pending attendance record in IndexedDB (or fallback).
 */
export async function enqueuePendingAttendance(record: PendingAttendanceRecord): Promise<void> {
  if (isIndexedDBAvailable()) {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      return;
    } catch (err) {
      console.warn("IndexedDB put failed, falling back to storage:", err);
    }
  }

  // Fallback
  memoryStore.set(record.id, record);
  saveLocalStorageFallback(memoryStore);
}

/**
 * Retrieves all pending attendance records awaiting synchronization.
 */
export async function getPendingAttendances(): Promise<PendingAttendanceRecord[]> {
  if (isIndexedDBAvailable()) {
    try {
      const db = await openDB();
      return await new Promise<PendingAttendanceRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("IndexedDB getAll failed, falling back:", err);
    }
  }

  const map = loadLocalStorageFallback();
  return Array.from(map.values());
}

/**
 * Removes a synchronized record by ID.
 */
export async function removePendingAttendance(id: string): Promise<void> {
  if (isIndexedDBAvailable()) {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      return;
    } catch (err) {
      console.warn("IndexedDB delete failed, falling back:", err);
    }
  }

  memoryStore.delete(id);
  const map = loadLocalStorageFallback();
  map.delete(id);
  saveLocalStorageFallback(map);
}

/**
 * Counts all pending records awaiting synchronization.
 */
export async function countPendingAttendances(): Promise<number> {
  if (isIndexedDBAvailable()) {
    try {
      const db = await openDB();
      return await new Promise<number>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("IndexedDB count failed, falling back:", err);
    }
  }

  const map = loadLocalStorageFallback();
  return map.size;
}

/**
 * Generates an anonymous device/session signature to audit offline sync source.
 */
export function getOrCreateDeviceSignature(): string {
  if (typeof window === "undefined") return "server-env";
  const KEY = "avh_device_signature_v1";
  try {
    let sig = localStorage.getItem(KEY);
    if (!sig) {
      sig = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem(KEY, sig);
    }
    return sig;
  } catch {
    return `dev_session_${Date.now()}`;
  }
}

