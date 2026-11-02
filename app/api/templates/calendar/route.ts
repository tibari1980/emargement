import ExcelJS from "exceljs";

const SAMPLE_CALENDAR = [
  {
    title: "Vacances d'Hiver",
    type: "Vacances / fermeture",
    startDate: "2027-02-13",
    endDate: "2027-02-28",
  },
  {
    title: "Pont de l'Ascension",
    type: "Vacances / fermeture",
    startDate: "2027-05-07",
    endDate: "2027-05-07",
  },
  {
    title: "Journée Pédagogique Institutionnelle",
    type: "Vacances / fermeture",
    startDate: "2027-06-18",
    endDate: "2027-06-18",
  },
  {
    title: "Fermeture Annuelle d'Été",
    type: "Vacances / fermeture",
    startDate: "2027-07-24",
    endDate: "2027-08-22",
  },
  {
    title: "Fête du Travail",
    type: "Jour férié",
    startDate: "2027-05-01",
    endDate: "2027-05-01",
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format")?.toLowerCase() ?? "xlsx";

  if (format === "csv") {
    // CSV with UTF-8 BOM so Microsoft Excel opens French accents properly
    const header = "Intitulé;Type;Premier jour;Dernier jour\r\n";
    const rows = SAMPLE_CALENDAR.map(
      (c) => `${c.title};${c.type};${c.startDate};${c.endDate}`
    ).join("\r\n");
    const csvContent = "\ufeff" + header + rows + "\r\n";

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="modele_import_calendrier.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  // Generate Excel (.xlsx) workbook with strict date formats and dropdown list
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ESRP / CFRP Valentin Haüy";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Calendrier", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // Define Columns
  sheet.columns = [
    { header: "Intitulé", key: "title", width: 34 },
    { header: "Type", key: "type", width: 26 },
    { header: "Premier jour", key: "startDate", width: 20 },
    { header: "Dernier jour", key: "endDate", width: 20 },
  ];

  // Header styling (Valentin Haüy Primary Blue)
  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Calibri" };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF003366" }, // #003366
  };

  // Add sample rows
  SAMPLE_CALENDAR.forEach((item) => {
    const row = sheet.addRow(item);
    row.height = 22;
    row.alignment = { vertical: "middle" };
    row.font = { size: 10, name: "Calibri" };

    // Format date cells as actual date format in Excel
    const startCell = row.getCell(3);
    const endCell = row.getCell(4);
    startCell.numFmt = "yyyy-mm-dd";
    endCell.numFmt = "yyyy-mm-dd";
  });

  // Add validation dropdown list on Column 2 (Type) for rows 2 to 100
  for (let r = 2; r <= 100; r++) {
    const typeCell = sheet.getCell(`B${r}`);
    typeCell.dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Vacances / fermeture,Jour férié"'],
      showErrorMessage: true,
      errorTitle: "Type invalide",
      error: "Veuillez sélectionner 'Vacances / fermeture' ou 'Jour férié' dans la liste.",
    };

    const startCell = sheet.getCell(`C${r}`);
    const endCell = sheet.getCell(`D${r}`);
    startCell.numFmt = "yyyy-mm-dd";
    endCell.numFmt = "yyyy-mm-dd";
  }

  // Add borders to sample cells
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFD0D7DE" } },
        left: { style: "thin", color: { argb: "FFD0D7DE" } },
        bottom: { style: "thin", color: { argb: "FFD0D7DE" } },
        right: { style: "thin", color: { argb: "FFD0D7DE" } },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modele_import_calendrier.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
