// Shared Admin SDK initialisation for the maintenance scripts.
// Uses service-account.json (project root) or the FIREBASE_ADMIN_* variables.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cert, initializeApp } from "firebase-admin/app";

export function initAdmin() {
  const keyFile = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_FILE ?? "service-account.json");
  if (!process.env.FIREBASE_ADMIN_PRIVATE_KEY && existsSync(keyFile)) {
    const key = JSON.parse(readFileSync(keyFile, "utf8"));
    initializeApp({ credential: cert(key) });
    return key.project_id;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\n/g, "\n");
  if (!clientEmail || !privateKey) {
    console.error(
      "Clé de compte de service introuvable : placez le fichier téléchargé depuis la console Firebase " +
        "(Paramètres du projet → Comptes de service → Générer une clé privée) à la racine du projet " +
        "sous le nom service-account.json.",
    );
    process.exit(1);
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return projectId;
}
