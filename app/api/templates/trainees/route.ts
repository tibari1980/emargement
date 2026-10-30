import ExcelJS from "exceljs";

const SAMPLE_TRAINEES = [
  { lastName: "Dupont", firstName: "Claire", email: "claire.dupont@exemple.fr" },
  { lastName: "Martin", firstName: "Lucas", email: "lucas.martin@exemple.fr" },
  { lastName: "Benali", firstName: "Youssef", email: "youssef.benali@exemple.fr" },
  { lastName: "Leroy", firstName: "Camille", email: "camille.leroy@exemple.fr" },
  { lastName: "Moreau", firstName: "Thomas", email: "thomas.moreau@exemple.fr" },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format")?.toLowerCase() ?? "xlsx";

  if (format === "csv") {
    // CSV with UTF-8 BOM so Microsoft Excel opens French accents properly
    const header = "Nom;Prénom;Email\r\n";
    const rows = SAMPLE_TRAINEES.map((t) => `${t.lastName};${t.firstName};${t.email}`).join("\r\n");
    const csvContent = "\ufeff" + header + rows + "\r\n";

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="modele_import_stagiaires.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  // Generate Excel (.xlsx) workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ESRP / CFRP Valentin Haüy";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Stagiaires", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // Define Columns
  sheet.columns = [
    { header: "Nom", key: "lastName", width: 22 },
    { header: "Prénom", key: "firstName", width: 22 },
    { header: "Email", key: "email", width: 32 },
  ];

  // Header styling (Valentin Haüy Primary Blue)
  const headerRow = sheet.getRow(1);
  headerRow.height = 28;
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Calibri" };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF003366" }, // #003366
  };

  // Add sample rows
  SAMPLE_TRAINEES.forEach((trainee) => {
    const row = sheet.addRow(trainee);
    row.height = 20;
    row.alignment = { vertical: "middle" };
    row.font = { size: 10, name: "Calibri" };
  });

  // Add borders to all cells
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
      "Content-Disposition": 'attachment; filename="modele_import_stagiaires.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
