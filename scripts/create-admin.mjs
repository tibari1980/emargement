// Creates the first administrator account (the admin UI needs one to exist).
//
//   npm run create-admin -- "Prénom Nom" admin@exemple.fr "MotDePasse123"

import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./firebase-admin-init.mjs";

const [fullName, email, password] = process.argv.slice(2);
if (!fullName || !email || !password || password.length < 8) {
  console.error('Usage : npm run create-admin -- "Nom complet" email "mot de passe (8 caractères minimum)"');
  process.exit(1);
}

initAdmin();
const auth = getAuth();
let user;
try {
  user = await auth.getUserByEmail(email);
  console.log(`Compte d'authentification existant : ${user.uid}`);
} catch {
  user = await auth.createUser({ email, password, displayName: fullName });
  console.log(`Compte d'authentification créé : ${user.uid}`);
}

await getFirestore().collection("users").doc(user.uid).set(
  { fullName, email: email.toLowerCase(), role: "admin", sector: null, createdAt: FieldValue.serverTimestamp() },
  { merge: true },
);
console.log(`${fullName} est administrateur.`);
