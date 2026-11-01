import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatShortDate, todayIso } from "@/lib/core/dates";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/domain/types";
import { sanitizeForSpreadsheet } from "@/lib/security/sanitize";

export interface UserExportRow {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  active: boolean;
  formationTitle?: string;
}

export interface UsersExportPayload {
  /** Optional active filter label (e.g. "Formateur" or "Tous les rôles") */
  filterLabel?: string;
  users: UserExportRow[];
}

// A4 landscape, in PDF points.
const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 36;
const ROW_HEIGHT = 19;

const PDF_COLUMNS = [
  { title: "N°", width: 36 },
  { title: "Nom complet", width: 210 },
  { title: "Adresse email", width: 235 },
  { title: "Rôle / Profil", width: 175 },
  { title: "Statut du compte", width: 114 },
];

function safe(text: string): string {
  return text
    .replace(/[\u00a0\u202f\u2009]/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^ -~\u00a1-\u00ff\u2026\u20ac]/g, "?");
}

function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let value = safe(text);
  while (value.length > 1 && font.widthOfTextAtSize(value, size) > maxWidth) {
    value = value.slice(0, -2) + "…";
  }
  return value;
}

export function usersExportFileName(payload: UsersExportPayload, ext: "pdf" | "xlsx"): string {
  return `utilisateurs-esrp-cfrp-${todayIso()}.${ext}`;
}

function sortUsers(users: UserExportRow[]): UserExportRow[] {
  return [...users].sort((a, b) => {
    if (a.role !== b.role) return ROLE_LABELS[a.role].localeCompare(ROLE_LABELS[b.role], "fr");
    return a.fullName.localeCompare(b.fullName, "fr");
  });
}

/**
 * Generates an official A4 Landscape PDF listing the exported user accounts.
 */
export async function buildUsersPdf(payload: UsersExportPayload): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const sorted = sortUsers(payload.users);
  const activeCount = sorted.filter((u) => u.active).length;
  const inactiveCount = sorted.length - activeCount;

  const docTitle = `Répertoire des Utilisateurs & Habilitations — ESRP / CFRP Valentin Haüy`;
  pdf.setTitle(docTitle);
  pdf.setAuthor("ESRP / CFRP Valentin Haüy");
  pdf.setLanguage("fr-FR");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const navy = rgb(0.05, 0.18, 0.36);
  const black = rgb(0.08, 0.08, 0.08);
  const grey = rgb(0.35, 0.35, 0.35);

  let page!: PDFPage;
  let y = 0;

  const drawFooter = (p: PDFPage) => {
    p.drawLine({
      start: { x: MARGIN, y: 32 },
      end: { x: PAGE_WIDTH - MARGIN, y: 32 },
      thickness: 0.6,
      color: rgb(0.8, 0.8, 0.8),
    });
    p.drawText(
      safe(
        `ESRP / CFRP Valentin Haüy — Édité le ${formatShortDate(todayIso())} — Application développée par Tibari Zeroual`,
      ),
      { x: MARGIN, y: 20, size: 7.5, font, color: grey },
    );
  };

  const drawTableHeader = () => {
    const headerHeight = 22;
    page.drawRectangle({
      x: MARGIN,
      y: y - headerHeight + 6,
      width: PAGE_WIDTH - 2 * MARGIN,
      height: headerHeight,
      color: navy,
    });
    let x = MARGIN + 5;
    for (const col of PDF_COLUMNS) {
      page.drawText(safe(col.title), {
        x,
        y: y - 8,
        size: 8.5,
        font: bold,
        color: rgb(1, 1, 1),
      });
      x += col.width;
    }
    y -= headerHeight + 4;
  };

  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;

    page.drawText(
      safe("ESRP / CFRP Valentin Haüy — Plateforme d'Émargement & Suivi Pédagogique"),
      { x: MARGIN, y, size: 10, font: bold, color: navy },
    );
    y -= 18;
    page.drawText(safe(docTitle), { x: MARGIN, y, size: 14, font: bold, color: black });
    y -= 16;

    const filterInfo = payload.filterLabel ? ` — Filtre : ${payload.filterLabel}` : "";
    const summaryLine = `Total : ${sorted.length} compte(s) (${activeCount} actif(s), ${inactiveCount} désactivé(s))${filterInfo}`;
    page.drawText(safe(summaryLine), { x: MARGIN, y, size: 9.5, font: bold, color: grey });
    y -= 18;

    drawTableHeader();
    drawFooter(page);
  };

  newPage();

  if (sorted.length === 0) {
    y -= 16;
    page.drawText(safe("Aucun compte utilisateur à afficher pour cette sélection."), {
      x: MARGIN + 4,
      y,
      size: 10,
      font,
      color: grey,
    });
  } else {
    sorted.forEach((u, idx) => {
      if (y < MARGIN + 48) {
        newPage();
      }

      if (idx % 2 === 1) {
        page.drawRectangle({
          x: MARGIN,
          y: y - 13,
          width: PAGE_WIDTH - 2 * MARGIN,
          height: ROW_HEIGHT,
          color: rgb(0.96, 0.97, 0.99),
        });
      }

      const cells = [
        String(idx + 1),
        u.fullName,
        u.email || "— (Sans compte de connexion)",
        ROLE_LABELS[u.role] ?? u.role,
        u.active ? "Actif" : "Désactivé",
      ];

      let x = MARGIN + 5;
      cells.forEach((cell, colIdx) => {
        const isBoldCol = colIdx === 1 || colIdx === 3;
        const cellFont = isBoldCol ? bold : font;
        page.drawText(truncate(cell, cellFont, 8.5, PDF_COLUMNS[colIdx].width - 8), {
          x,
          y: y - 7,
          size: 8.5,
          font: cellFont,
          color: colIdx === 3 ? navy : black,
        });
        x += PDF_COLUMNS[colIdx].width;
      });

      page.drawLine({
        start: { x: MARGIN, y: y - 13 },
        end: { x: PAGE_WIDTH - MARGIN, y: y - 13 },
        thickness: 0.4,
        color: rgb(0.86, 0.88, 0.91),
      });

      y -= ROW_HEIGHT;
    });
  }

  return pdf.save();
}

/**
 * Generates an official Excel (.xlsx) workbook with 2 sheets:
 * 1. Utilisateurs (complete list of accounts with Role, Email, Status)
 * 2. Synthese_Roles (breakdown by role)
 */
export async function buildUsersExcel(payload: UsersExportPayload): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ESRP / CFRP Valentin Haüy — Émargement";
  workbook.created = new Date();

  const sorted = sortUsers(payload.users);
  const activeCount = sorted.filter((u) => u.active).length;

  /* =========================================================================
   * FEUILLE 1 : Liste des Utilisateurs
   * ========================================================================= */
  const sheet = workbook.addWorksheet("Utilisateurs", {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  sheet.addRow(["ESRP / CFRP Valentin Haüy — Répertoire des Utilisateurs & Habilitations"]).font = {
    bold: true,
    size: 14,
    color: { argb: "FF0D2E5C" },
  };
  sheet.addRow([
    "Total utilisateurs",
    sorted.length,
    "Comptes actifs",
    activeCount,
    "Comptes désactivés",
    sorted.length - activeCount,
  ]);
  sheet.addRow([
    "Périmètre exporté",
    sanitizeForSpreadsheet(payload.filterLabel || "Tous les rôles"),
    "Date d'édition",
    formatShortDate(todayIso()),
  ]);
  sheet.addRow([]);

  const tableHeader = sheet.addRow([
    "N°",
    "Nom complet",
    "Adresse email",
    "Rôle / Profil",
    "Statut du compte",
    "Type d'accès",
  ]);
  tableHeader.height = 24;
  tableHeader.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  tableHeader.alignment = { vertical: "middle", horizontal: "left" };
  tableHeader.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D2E5C" } };
  });

  sorted.forEach((u, index) => {
    const accessType =
      u.role === "trainee" ? "Stagiaire (sans connexion)" : "Personnel habilité (connexion sécurisée)";
    const row = sheet.addRow([
      index + 1,
      sanitizeForSpreadsheet(u.fullName),
      sanitizeForSpreadsheet(u.email || "—"),
      sanitizeForSpreadsheet(ROLE_LABELS[u.role] ?? u.role),
      u.active ? "Actif" : "Désactivé",
      accessType,
    ]);
    row.alignment = { vertical: "middle" };
  });

  const colWidths = [8, 32, 36, 26, 18, 36];
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  /* =========================================================================
   * FEUILLE 2 : Synthèse par Rôle
   * ========================================================================= */
  const summarySheet = workbook.addWorksheet("Synthese_Roles", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  summarySheet.addRow(["Synthèse des comptes par profil d'habilitation"]).font = {
    bold: true,
    size: 13,
    color: { argb: "FF0D2E5C" },
  };
  summarySheet.addRow([]);

  const roleHeader = summarySheet.addRow(["Rôle / Profil", "Total comptes", "Comptes actifs", "Comptes désactivés"]);
  roleHeader.font = { bold: true };
  roleHeader.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F2" } };
  });

  for (const r of ROLES) {
    const inRole = sorted.filter((u) => u.role === r);
    const activeInRole = inRole.filter((u) => u.active).length;
    summarySheet.addRow([
      ROLE_LABELS[r],
      inRole.length,
      activeInRole,
      inRole.length - activeInRole,
    ]);
  }

  summarySheet.getColumn(1).width = 30;
  summarySheet.getColumn(2).width = 18;
  summarySheet.getColumn(3).width = 18;
  summarySheet.getColumn(4).width = 20;

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
