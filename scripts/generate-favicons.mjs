import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

function createIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + count * dirEntrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon (.ico)
  header.writeUInt16LE(count, 4); // number of images

  const entries = [];
  for (const img of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // color palette count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // size of image in bytes
    entry.writeUInt32LE(offset, 12); // offset of image data
    entries.push(entry);
    offset += img.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map((img) => img.buffer)]);
}

async function main() {
  const svgPath = path.resolve('public/favicon.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf8');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  
  const sizes = [16, 32, 48, 64, 180, 192, 512];
  const pngResults = {};

  for (const size of sizes) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
            svg { width: 100%; height: 100%; display: block; }
          </style>
        </head>
        <body>
          ${svgContent}
        </body>
      </html>
    `;
    await page.setContent(html, { waitUntil: 'load' });
    const buffer = await page.screenshot({ type: 'png', omitBackground: true });
    pngResults[size] = buffer;
  }

  await browser.close();

  // Save standalone PNGs
  fs.writeFileSync('public/favicon-16x16.png', pngResults[16]);
  fs.writeFileSync('public/favicon-32x32.png', pngResults[32]);
  fs.writeFileSync('public/apple-touch-icon.png', pngResults[180]);
  fs.writeFileSync('public/icon-192.png', pngResults[192]);
  fs.writeFileSync('public/icon-512.png', pngResults[512]);

  // Create multi-resolution ICO (16, 32, 48)
  const icoBuffer = createIco([
    { width: 16, height: 16, buffer: pngResults[16] },
    { width: 32, height: 32, buffer: pngResults[32] },
    { width: 48, height: 48, buffer: pngResults[48] },
  ]);

  fs.writeFileSync('public/favicon.ico', icoBuffer);
  fs.writeFileSync('app/favicon.ico', icoBuffer);

  console.log('Successfully generated:');
  console.log('- public/favicon.ico (multi-resolution 16, 32, 48)');
  console.log('- app/favicon.ico');
  console.log('- public/favicon-16x16.png');
  console.log('- public/favicon-32x32.png');
  console.log('- public/apple-touch-icon.png');
  console.log('- public/icon-192.png');
  console.log('- public/icon-512.png');
  console.log(`ICO Buffer size: ${icoBuffer.length} bytes`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
