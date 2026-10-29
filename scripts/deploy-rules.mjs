// Publishes firestore.rules to the Firebase project (no Firebase CLI needed).
//
//   npm run deploy-rules

import { readFileSync } from "node:fs";
import { getSecurityRules } from "firebase-admin/security-rules";
import { initAdmin } from "./firebase-admin-init.mjs";

const projectId = initAdmin();
const source = readFileSync("firestore.rules", "utf8");
const ruleset = await getSecurityRules().releaseFirestoreRulesetFromSource(source);
console.log(`Règles Firestore publiées sur ${projectId} (ruleset ${ruleset.name}).`);
