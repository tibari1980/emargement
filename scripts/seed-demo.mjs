// Creates one test account per role plus demonstration data, using only the
// web configuration of .env.local (Firebase client SDK, same rules as the app).
// Safe to run several times: existing accounts and data are reused.
//
//   npm run seed-demo
//
// Requires the rules of firestore.rules to be published on the project.

import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
if (!config.apiKey || !config.projectId) {
  console.error("Configuration Firebase absente : renseignez .env.local.");
  process.exit(1);
}

const PASSWORD = process.env.DEMO_PASSWORD || "AvhTest2026!";
const ACCOUNTS = [
  { key: "admin", fullName: "Alice Administratrice", email: "admin@avh-test.fr", role: "admin", sector: null },
  { key: "secretary", fullName: "Sophie Secrétaire", email: "secretariat@avh-test.fr", role: "secretary", sector: null },
  { key: "lead", fullName: "Paul Responsable", email: "responsable@avh-test.fr", role: "pedagogical_lead", sector: "digital" },
  { key: "trainer", fullName: "Thomas Formateur", email: "formateur@avh-test.fr", role: "trainer", sector: "digital" },
];
const TRAINEES = [
  "Jean Dupont",
  "Amélie Martin",
  "Karim Benali",
  "Léa Bernard",
  "Lucas Petit",
  "Chloé Moreau",
];

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
// Second instance: creating an account signs it in, the admin stays signed in on `auth`.
const creator = getAuth(initializeApp(config, "creator"));

// French public holidays (same algorithm as lib/frenchHolidays.ts).
function frenchPublicHolidays(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  const easterPlus = (n) => iso(new Date(y, month - 1, day + n));
  return [
    { title: "Jour de l'an", date: `${y}-01-01` },
    { title: "Lundi de Pâques", date: easterPlus(1) },
    { title: "Fête du Travail", date: `${y}-05-01` },
    { title: "Victoire 1945", date: `${y}-05-08` },
    { title: "Ascension", date: easterPlus(39) },
    { title: "Lundi de Pentecôte", date: easterPlus(50) },
    { title: "Fête nationale", date: `${y}-07-14` },
    { title: "Assomption", date: `${y}-08-15` },
    { title: "Toussaint", date: `${y}-11-01` },
    { title: "Armistice 1918", date: `${y}-11-11` },
    { title: "Noël", date: `${y}-12-25` },
  ];
}

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

async function accountUid(instance, account) {
  try {
    const { user } = await createUserWithEmailAndPassword(instance, account.email, PASSWORD);
    await updateProfile(user, { displayName: account.fullName });
    return { uid: user.uid, created: true };
  } catch (error) {
    if (error.code !== "auth/email-already-in-use") throw error;
    const { user } = await signInWithEmailAndPassword(instance, account.email, PASSWORD);
    return { uid: user.uid, created: false };
  }
}

const profile = (a) => ({
  fullName: a.fullName,
  email: a.email,
  role: a.role,
  sector: a.sector,
  createdAt: serverTimestamp(),
});

// 1. Administrator session.
//    - Application not installed yet: the test administrator installs it.
//    - Already installed: sign in with an existing administrator, given by
//      SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (e.g. in .env.local), or the
//      test administrator if it was created by a previous run.
const admin = ACCOUNTS[0];
const ids = {};
const installed = (await getDoc(doc(db, "settings", "bootstrap"))).exists();
if (!installed) {
  const { uid } = await accountUid(auth, admin);
  const batch = writeBatch(db);
  batch.set(doc(db, "users", uid), profile(admin));
  batch.set(doc(db, "settings", "bootstrap"), { adminId: uid, createdAt: serverTimestamp() });
  await batch.commit();
  ids.admin = uid;
  console.log(`Application installée, administrateur : ${admin.email}`);
} else {
  const email = process.env.SEED_ADMIN_EMAIL || admin.email;
  const password = process.env.SEED_ADMIN_PASSWORD || PASSWORD;
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.data()?.role !== "admin") throw new Error("not admin");
  } catch {
    console.error(
      "L'application est déjà installée : le script doit se connecter avec un compte administrateur.
" +
        "Ajoutez temporairement dans .env.local :
" +
        "  SEED_ADMIN_EMAIL=votre.email@exemple.fr
" +
        "  SEED_ADMIN_PASSWORD=votre-mot-de-passe
" +
        "puis relancez « npm run seed-demo » (et retirez ces lignes ensuite).",
    );
    process.exit(1);
  }
  console.log(`Connecté en administrateur : ${email}`);
}
const sessionUid = auth.currentUser.uid;

// 2. Staff accounts, profiles written by the administrator session.
for (const account of ACCOUNTS) {
  if (ids[account.key]) continue;
  const { uid, created } = await accountUid(creator, account);
  await signOut(creator);
  if (!(await getDoc(doc(db, "users", uid))).exists()) {
    await setDoc(doc(db, "users", uid), profile(account));
  }
  ids[account.key] = uid;
  console.log(`${created ? "Créé" : "Existant"} : ${account.email} (${account.role})`);
}

// 3. Trainees (records only: trainees do not sign in).
const existingTrainees = (await getDocs(collection(db, "users"))).docs.filter((d) => d.data().role === "trainee");
const traineeIds = [];
for (const fullName of TRAINEES) {
  const found = existingTrainees.find((d) => d.data().fullName === fullName);
  if (found) {
    traineeIds.push(found.id);
    continue;
  }
  const ref = doc(collection(db, "users"));
  await setDoc(ref, { fullName, email: "", role: "trainee", sector: "digital", createdAt: serverTimestamp() });
  traineeIds.push(ref.id);
}
console.log(`${traineeIds.length} stagiaires.`);

// 4. Demonstration course.
const courseRef = doc(db, "courses", "demo-technicien-informatique");
await setDoc(courseRef, {
  title: "Technicien informatique de proximité",
  sector: "digital",
  pedagogicalLeadId: ids.lead,
  trainerIds: [ids.trainer],
  defaultStartTime: "09:00",
  defaultEndTime: "17:00",
  dailyHours: 7,
  traineeIds,
});
console.log("Formation de démonstration : Technicien informatique de proximité.");

// 5. French public holidays of the current year.
const year = new Date().getFullYear();
const holidays = await getDocs(collection(db, "holidays"));
if (!holidays.docs.some((d) => d.data().startDate?.startsWith(String(year)))) {
  const batch = writeBatch(db);
  for (const h of frenchPublicHolidays(year)) {
    batch.set(doc(collection(db, "holidays")), { title: h.title, startDate: h.date, endDate: h.date, type: "holiday" });
  }
  await batch.commit();
  console.log(`Jours fériés ${year} ajoutés.`);
}

// 6. Some attendance of the current month, on past weekdays (as the administrator).
const today = new Date();
const closed = new Set((await getDocs(collection(db, "holidays"))).docs.map((d) => d.data().startDate));
const statuses = ["present", "present", "present", "late", "present", "absent"];
let count = 0;
const batch = writeBatch(db);
for (let d = new Date(today.getFullYear(), today.getMonth(), 1); d < today; d.setDate(d.getDate() + 1)) {
  const day = iso(d);
  if (d.getDay() === 0 || d.getDay() === 6 || closed.has(day)) continue;
  traineeIds.forEach((traineeId, i) => {
    const status = statuses[(i + d.getDate()) % statuses.length];
    batch.set(doc(db, "attendances", `${courseRef.id}_${traineeId}_${day}`), {
      courseId: courseRef.id,
      traineeId,
      date: day,
      month: day.slice(0, 7),
      status,
      arrivalTime: status === "late" ? "09:35" : null,
      excuseReason: null,
      validatedByTrainerId: sessionUid,
      updatedAt: serverTimestamp(),
    });
    count++;
  });
}
if (count) await batch.commit();
console.log(`${count} émargements de démonstration pour le mois en cours.`);

console.log(`\nComptes de test (mot de passe commun : ${PASSWORD}) :`);
for (const a of ACCOUNTS) console.log(`  ${a.role.padEnd(17)} ${a.email}`);
process.exit(0);
