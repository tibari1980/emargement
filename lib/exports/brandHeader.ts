import zlib from "node:zlib";
import { rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatShortDate, todayIso } from "@/lib/core/dates";

function safePdfText(text: string): string {
  return text
    .replace(/[\u00a0\u202f\u2009]/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^ -~\u00a1-\u00ff\u2026\u20ac]/g, "?");
}

/**
 * Draws the official colored ESRP / CFRP Valentin Haüy emblem ("L'Œil de l'Autonomie & de l'Inclusion")
 * at the given (x, yBottom) coordinates on a PDFPage using crisp vector primitives.
 */
export function drawAvhColoredLogo(
  page: PDFPage,
  x: number,
  yBottom: number,
  size: number,
  boldFont: PDFFont,
): void {
  const navy = rgb(0.05, 0.18, 0.36); // #0D2E5C
  const deepBlue = rgb(0.08, 0.27, 0.52); // #144585
  const gold = rgb(0.96, 0.68, 0.06); // #F5AD0F
  const brightGold = rgb(0.99, 0.82, 0.15); // #FCD126
  const azure = rgb(0.11, 0.62, 0.88); // #1CA0E0
  const white = rgb(1, 1, 1);

  // 1. Outer Gold Frame
  page.drawRectangle({
    x,
    y: yBottom,
    width: size,
    height: size,
    color: gold,
  });

  // 2. Main Navy Emblem Background (inset by 2pt)
  page.drawRectangle({
    x: x + 2,
    y: yBottom + 2,
    width: size - 4,
    height: size - 4,
    color: navy,
  });

  // 3. Top Azure Accent Bar inside badge
  page.drawRectangle({
    x: x + 2,
    y: yBottom + size - 6,
    width: size - 4,
    height: 4,
    color: azure,
  });

  // 4. Bottom Deep Blue Banner for "AVH 1889"
  page.drawRectangle({
    x: x + 2,
    y: yBottom + 2,
    width: size - 4,
    height: 11,
    color: deepBlue,
  });

  const cx = x + size / 2;
  const cy = yBottom + size * 0.57;

  // 5. Eye Outer Sclera / Contour (Layered horizontal ellipses + golden aura)
  page.drawEllipse({
    x: cx,
    y: cy,
    xScale: size * 0.38,
    yScale: size * 0.22,
    borderColor: brightGold,
    borderWidth: 1.5,
    color: white,
  });

  // 6. Outer Iris (Azure Blue)
  page.drawCircle({
    x: cx,
    y: cy,
    size: size * 0.17,
    color: azure,
    borderColor: navy,
    borderWidth: 1,
  });

  // 7. Inner Iris Ring (Valentin Haüy Gold)
  page.drawCircle({
    x: cx,
    y: cy,
    size: size * 0.125,
    color: brightGold,
  });

  // 8. Pupil (Deep Navy)
  page.drawCircle({
    x: cx,
    y: cy,
    size: size * 0.075,
    color: navy,
  });

  // 9. Corneal Light Reflection (White highlight dot)
  page.drawCircle({
    x: cx + size * 0.045,
    y: cy + size * 0.045,
    size: size * 0.028,
    color: white,
  });

  // 10. Braille & AVH Inscription at bottom of emblem
  const label = "AVH 1889";
  const fontSize = 6.5;
  const textWidth = boldFont.widthOfTextAtSize(label, fontSize);
  page.drawText(label, {
    x: cx - textWidth / 2,
    y: yBottom + 4.5,
    size: fontSize,
    font: boldFont,
    color: brightGold,
  });
}

export interface OfficialPdfHeaderOptions {
  page: PDFPage;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  font: PDFFont;
  bold: PDFFont;
  docTitle: string;
  subtitleLines: string[];
  badgeText?: string;
}

/**
 * Draws the complete colored institutional header for ESRP / CFRP Valentin Haüy
 * and returns the updated `y` coordinate below the header where the table can begin.
 */
export function drawOfficialPdfHeader(opts: OfficialPdfHeaderOptions): number {
  const { page, pageWidth, pageHeight, margin, font, bold, docTitle, subtitleLines, badgeText } = opts;

  const navy = rgb(0.05, 0.18, 0.36); // #0D2E5C
  const azure = rgb(0.06, 0.46, 0.69); // #0F75B0
  const gold = rgb(0.93, 0.62, 0.04); // #ED9E0A
  const goldBg = rgb(1, 0.96, 0.84); // #FFF5D6
  const black = rgb(0.08, 0.08, 0.08);
  const grey = rgb(0.32, 0.35, 0.4);
  const lightBoxBg = rgb(0.95, 0.97, 1);

  const topY = pageHeight - margin;
  const logoSize = 48;
  const logoBottomY = topY - logoSize + 6;

  // 1. Draw Colored ESRP / CFRP Valentin Haüy Logo on the left
  drawAvhColoredLogo(page, margin, logoBottomY, logoSize, bold);

  const textLeftX = margin + logoSize + 12;

  // 2. Top Gold Pill: ASSOCIATION VALENTIN HAÜY
  const pillText = safePdfText("ASSOCIATION VALENTIN HAÜY — RECONNUE D'UTILITÉ PUBLIQUE DEPUIS 1889");
  const pillWidth = bold.widthOfTextAtSize(pillText, 7) + 12;
  page.drawRectangle({
    x: textLeftX,
    y: topY - 6,
    width: pillWidth,
    height: 12,
    color: goldBg,
    borderColor: gold,
    borderWidth: 0.8,
  });
  page.drawText(pillText, {
    x: textLeftX + 6,
    y: topY - 2.5,
    size: 7,
    font: bold,
    color: navy,
  });

  // 3. Institution Name + Colored Subtitle
  const instTitle = safePdfText("ESRP / CFRP VALENTIN HAÜY");
  page.drawText(instTitle, {
    x: textLeftX,
    y: topY - 20,
    size: 12.5,
    font: bold,
    color: navy,
  });

  const instTitleWidth = bold.widthOfTextAtSize(instTitle, 12.5);
  page.drawText(safePdfText("  •  Centre de Formation et de Réadaptation Professionnelle"), {
    x: textLeftX + instTitleWidth,
    y: topY - 20,
    size: 9.5,
    font: bold,
    color: azure,
  });

  // 4. Document Main Title
  page.drawText(safePdfText(docTitle), {
    x: textLeftX,
    y: topY - 36,
    size: 13,
    font: bold,
    color: black,
  });

  // 5. Right-side Colored Certification Stamp Box
  const stampWidth = 172;
  const stampHeight = 46;
  const stampX = pageWidth - margin - stampWidth;
  const stampY = logoBottomY + 1;

  page.drawRectangle({
    x: stampX,
    y: stampY,
    width: stampWidth,
    height: stampHeight,
    color: lightBoxBg,
    borderColor: azure,
    borderWidth: 0.9,
  });
  // Left gold stripe inside stamp box
  page.drawRectangle({
    x: stampX,
    y: stampY,
    width: 4,
    height: stampHeight,
    color: gold,
  });

  page.drawText(safePdfText(badgeText || "DOCUMENT OFFICIEL CERTIFIÉ"), {
    x: stampX + 10,
    y: stampY + 32,
    size: 7.5,
    font: bold,
    color: navy,
  });
  page.drawText(safePdfText("Qualiopi • DGEFP / ASP • RGAA AAA"), {
    x: stampX + 10,
    y: stampY + 20,
    size: 8,
    font: bold,
    color: azure,
  });
  page.drawText(safePdfText(`Édité le ${formatShortDate(todayIso())} (Europe/Paris)`), {
    x: stampX + 10,
    y: stampY + 8,
    size: 7.5,
    font,
    color: grey,
  });

  // 6. Subtitle lines below the logo/title block
  let y = logoBottomY - 11;
  for (let i = 0; i < subtitleLines.length; i++) {
    const line = safePdfText(subtitleLines[i]);
    page.drawText(line, {
      x: margin,
      y,
      size: i === 0 ? 9.5 : 8.5,
      font: i === 0 ? bold : font,
      color: i === 0 ? navy : grey,
    });
    y -= 13;
  }

  // 7. Tri-color Institutional Divider Bar (Navy + Gold + Azure)
  const totalBarWidth = pageWidth - 2 * margin;
  const barY = y - 1;
  const navyWidth = totalBarWidth * 0.72;
  const goldWidth = totalBarWidth * 0.16;
  const azureWidth = totalBarWidth - navyWidth - goldWidth;

  page.drawRectangle({ x: margin, y: barY, width: navyWidth, height: 2.5, color: navy });
  page.drawRectangle({ x: margin + navyWidth, y: barY, width: goldWidth, height: 2.5, color: gold });
  page.drawRectangle({ x: margin + navyWidth + goldWidth, y: barY, width: azureWidth, height: 2.5, color: azure });

  return barY - 10;
}

// ============================================================================
// COLORED PNG LOGO GENERATOR FOR EXCEL (.XLSX) WORKBOOKS (ZERO DEPENDENCIES)
// ============================================================================

let cachedLogoPng: Buffer | null = null;

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBuf, Buffer.from(data)]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, Buffer.from(data), crcBuf]);
}

/**
 * Generates a crisp 96x96 RGBA PNG buffer of the colored ESRP / CFRP Valentin Haüy
 * Eye of Autonomy emblem so it can be embedded directly into Excel (.xlsx) files.
 */
export function getAvhLogoPngBuffer(): Buffer {
  if (cachedLogoPng) return cachedLogoPng;

  const width = 96;
  const height = 96;
  // Each scanline has 1 filter byte (0) + width * 4 RGBA bytes
  const raw = Buffer.alloc(height * (1 + width * 4));

  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 4;

      // Default: Navy background (#0D2E5C -> 13, 46, 92)
      let r = 13;
      let g = 46;
      let b = 92;
      const a = 255;

      // Outer Gold frame (4px border: #F5AD0F -> 245, 173, 15)
      if (x < 4 || x >= width - 4 || y < 4 || y >= height - 4) {
        r = 245;
        g = 173;
        b = 15;
      } else if (y >= 4 && y < 12) {
        // Top Azure accent stripe (#1CA0E0 -> 28, 160, 224)
        r = 28;
        g = 160;
        b = 224;
      } else {
        // Normalized coordinates relative to center for the Eye emblem
        const dx = (x - cx) / 34;
        const dy = (y - cy) / 20;
        const ellipseDist = dx * dx + dy * dy;
        const circleDist = Math.hypot(x - cx, y - cy);

        // Golden outer eye contour ring
        if (ellipseDist <= 1.08 && ellipseDist >= 0.86) {
          r = 252;
          g = 209;
          b = 38;
        } else if (ellipseDist < 0.86) {
          // White sclera
          r = 255;
          g = 255;
          b = 255;

          // Outer Iris (Azure Blue #1CA0E0)
          if (circleDist <= 16.5) {
            r = 28;
            g = 160;
            b = 224;
          }
          // Inner Iris (Valentin Haüy Gold #FCD126)
          if (circleDist <= 12) {
            r = 252;
            g = 209;
            b = 38;
          }
          // Pupil (Deep Navy #0D2E5C)
          if (circleDist <= 7) {
            r = 13;
            g = 46;
            b = 92;
          }
          // Corneal light reflection dot (White)
          const hlDist = Math.hypot(x - (cx + 4.5), y - (cy - 4.5));
          if (hlDist <= 2.8) {
            r = 255;
            g = 255;
            b = 255;
          }
        }
      }

      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = a;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw);
  const png = Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", new Uint8Array(0)),
  ]);

  cachedLogoPng = png;
  return png;
}
