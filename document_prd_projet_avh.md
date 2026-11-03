# 📄 Product Requirement Document (PRD)

## Application Web d'Émargement et de Suivi de Présence — ESRP Valentin Haüy

\---

## 1\. Context \& Business Goals

### 1.1 Objective

Build an accessible, robust, and automated attendance management web application for **ESRP Valentin Haüy** (Association Valentin Haüy). The application manages daily trainee attendance, trainer check-ins, holiday/vacation calendars, and generates monthly attendance/absence reports required for ASP remuneration.

### 1.2 Target Audience \& Accessibility Focus

* **Administrators \& Secretaries:** Manage users, batch import trainees via CSV/Excel, and configure establishment holidays/vacations.
* **Pedagogical Leads (Responsables Pédagogiques):** Set up weekly course schedules and generate/export monthly time sheets.
* **Trainers (Formateurs):** Visually impaired or blind professionals using screen readers (**NVDA, JAWS, Orca**). They need an ultra-accessible interface to check trainees in, mark absences, and record late arrivals with exact times.
* **Trainees (Stagiaires):** Enrolled in qualification, preparatory, or autonomy modules.

\---

## 2\. Tech Stack \& Infrastructure

* **Framework:** Next.js (App Router, TypeScript)
* **Styling \& UI Accessibility:** Tailwind CSS + Radix UI / WAI-ARIA primitive elements
* **Database \& Authentication:** Firebase (Firestore NoSQL Database, Firebase Authentication)
* **Domain \& Security:** Cloudflare (DNS, SSL, DDoS protection)
* **Hosting:** Hostinger (Node.js / Next.js deployment environment)
* **Development IDE \& AI Assistant:** Visual Studio Code + Claude

\---

## 3\. Organizational Structure \& Course Offerings

The application natively supports the official ESRP Valentin Haüy training portfolio across 4 main sectors:

1. **Healthcare \& Paramedical:** Massagiste-Kinésithérapeute (State Diploma), Massage Well-being Practitioner.
2. **Tertiary \& Administrative:** Receptionist \& Administrative Manager (Chargé d'accueil et de gestion administrative).
3. **IT \& Digital:** Local IT Support Technician (Technicien informatique de proximité).
4. **Technical \& Mechanical:** Bicycle Mechanic (Mécanicien cycles).
5. **Preparatory Courses:** Tremplin-DV (5 months), IT Preparatory, Scientific Refresher.
6. **Autonomie Modules:** Braille training, Adapted IT (NVDA/JAWS/Braille displays), Accessible Telephony (iOS/Android), Mobility/Locomotion instructions.

\---

## 4\. User Roles \& Key Features

### 4.1 Administrator (`admin`)

* Full system access.
* Manage user accounts, role assignments, and sector configurations.

### 4.2 Secretary (`secretary`)

* **Bulk Import:** Upload `.csv` or `.xlsx` files to register batches of trainees into courses.
* **Calendar Management:** Create and update **Public Holidays (Jours Fériés)** and **Vacation / Closure Periods (Périodes de Vacances)**.
* **Absence Justification:** Record official medical or administrative justifications for trainee absences.

### 4.3 Pedagogical Lead (`pedagogical\_lead`)

* **Schedule Configuration:** Set default daily theoretical hours (Monday to Friday, e.g., `09:00 - 17:00`, 7h/day) per course.
* **Monthly Calculations:** View auto-calculated total monthly attendance/absence hours per trainee (excluding holidays and vacation days).
* **Exporting:** Export official reports to **PDF** (for funders) and **Excel (`.xlsx`)** (for HR/internal reporting).

### 4.4 Trainer (`trainer`) — *Ultra-Accessible*

* View current day's assigned course session.
* Single-click/Keyboard toggle for trainee status: **Present**, **Absent**, or **Late**.
* **Precise Late Arrival:** If "Late" is selected, input exact arrival time (e.g., `09:45`).
* Screen reader live updates (`aria-live`) for immediate audio feedback upon saving.

\---

## 5\. Monthly Hours Calculation Engine

### 5.1 Business Rules

* **Working Days:** Monday to Friday only (Saturdays and Sundays are excluded automatically).
* **Closures:** Days tagged as Public Holidays or Vacations in the `holidays` collection are excluded from theoretical required hours.
* **Late Arrivals:** Late minutes are aggregated and deducted from attendance hours.

### 5.2 Mathematical Model

$$\\text{Theoretical Hours} = \\sum (\\text{Working Days} - \\text{Holiday/Vacation Days}) \\times \\text{Course Daily Hours}$$

$$\\text{Total Absence (Hours)} = \\sum (\\text{Absent Hours}) + \\frac{\\sum (\\text{Late Minutes})}{60}$$

$$\\text{Effective Presence (Hours)} = \\text{Theoretical Hours} - \\text{Total Absence}$$

\---

## 6\. Firestore Database Schema

```text
📁 users (Collection)
 └── 📄 {userId}
      ├── fullName: string
      ├── email: string
      ├── role: "admin" | "secretary" | "pedagogical\_lead" | "trainer" | "trainee"
      ├── sector: "paramedical" | "tertiary" | "digital" | "autonomy"
      └── createdAt: timestamp

📁 courses (Collection)
 └── 📄 {courseId}
      ├── title: string
      ├── sector: string
      ├── pedagogicalLeadId: string
      ├── defaultStartTime: string // "09:00"
      ├── defaultEndTime: string   // "17:00"
      ├── dailyHours: number       // 7
      └── traineeIds: array<string>

📁 holidays (Collection)
 └── 📄 {holidayId}
      ├── title: string // "Toussaint", "Fermeture Hiver"
      ├── startDate: string // "YYYY-MM-DD"
      ├── endDate: string   // "YYYY-MM-DD"
      └── type: "holiday" | "vacation"

📁 attendances (Collection)
 └── 📄 {attendanceId}
      ├── courseId: string
      ├── traineeId: string
      ├── date: string // "YYYY-MM-DD"
      ├── status: "present" | "absent" | "late" | "excused"
      ├── arrivalTime: string | null // "09:45"
      ├── excuseReason: string | null
      ├── validatedByTrainerId: string
      └── updatedAt: timestamp
```

\---

## 7\. Accessibility Guidelines for Claude (WAI-ARIA \& Screen Readers)

When writing React components with Claude in VS Code, ensure the following rules are respected:

1. **Semantic HTML First:** Always use native elements (`<main>`, `<nav>`, `<header>`, `<table>`, `<button>`, `<input>`) instead of generic `<div>` click listeners.
2. **Keyboard Navigation:** Ensure 100% of actions are operable via `Tab`, `Shift+Tab`, `Space`, `Enter`, and `Arrow keys`.
3. **Screen Reader Feedback (`aria-live`):** Include a polite ARIA live region component so status changes (e.g., *"Stagiaire Jean Dupont marqué présent à 09h00"*) are announced verbally without interrupting focus.
4. **Focus Management:** Maintain visible, high-contrast focus rings (`focus-visible:ring-2`) and avoid nested modal traps.

\---

## 8\. Recommended Next.js Project Structure

```text
avh-emargement/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx             # Login page
│   ├── admin/
│   │   ├── users/page.tsx             # Manage users \& roles
│   │   ├── import/page.tsx            # Batch CSV/Excel import
│   │   └── calendar/page.tsx          # Manage holidays \& vacation dates
│   ├── pedagogical/
│   │   ├── courses/page.tsx           # Setup course schedules
│   │   └── reports/page.tsx           # Monthly calculations \& PDF/Excel exports
│   ├── trainer/
│   │   └── emargement/page.tsx        # Accessible attendance sheet
│   ├── api/
│   │   ├── export-pdf/route.ts        # PDF generation API
│   │   └── export-excel/route.ts      # Excel generation API
│   ├── layout.tsx                     # Root layout with accessibility wrappers
│   └── page.tsx                       # Role-based redirector
├── components/
│   ├── ui/                            # Accessible Radix/Tailwind components
│   └── AccessibleAnnouncer.tsx        # ARIA Live region component
├── lib/
│   ├── firebase.ts                    # Firebase Client/Admin setup
│   ├── hoursCalculator.ts             # Monthly hours calculation algorithm
│   └── csvParser.ts                   # CSV/Excel parsing helper
└── public/
```







== Firebase :



information de la base de données firebase :
// Import the functions you need from the SDKs you need

import { initializeApp } from "firebase/app";

// TODO: Add SDKs for Firebase products that you want to use

// https://firebase.google.com/docs/web/setup#available-libraries



// Your web app's Firebase configuration

const firebaseConfig = {

&#x20; apiKey: "AIzaSyCvDKGZ\_9JuWQlYy60C0KNIsIX1aLAJsPA",

&#x20; authDomain: "cfrp-emargement-projet.firebaseapp.com",

&#x20; projectId: "cfrp-emargement-projet",

&#x20; storageBucket: "cfrp-emargement-projet.firebasestorage.app",

&#x20; messagingSenderId: "464823544585",

&#x20; appId: "1:464823544585:web:538050cd7c2b64808981d8"

};



// Initialize Firebase

const app = initializeApp(firebaseConfig);

