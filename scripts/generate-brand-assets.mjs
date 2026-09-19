/**
 * Generate GudDesk brand assets (favicons, app icons, OG images)
 *
 * Usage:
 *   node scripts/generate-brand-assets.mjs --from-image path/to/logo.png
 *   node scripts/generate-brand-assets.mjs   (uses public/_static/logo.svg)
 *
 * Requires: sharp (already in dependencies)
 */

import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FAVICONS_DIR = path.join(ROOT, "public", "_static", "favicons");
const STATIC_DIR = path.join(ROOT, "public", "_static");
const PUBLIC_DIR = path.join(ROOT, "public");
const LOGO_SVG = path.join(STATIC_DIR, "logo.svg");

// Parse args
const args = process.argv.slice(2);
const fromImageIdx = args.indexOf("--from-image");
const sourceImagePath = fromImageIdx !== -1 ? args[fromImageIdx + 1] : null;

// Ensure directories
fs.mkdirSync(FAVICONS_DIR, { recursive: true });
fs.mkdirSync(path.join(STATIC_DIR, "images"), { recursive: true });

/* ─── Generate favicons from any source ────────────── */

async function generateFavicons(source) {
  const sizes = [
    { name: "favicon-16x16.png", size: 16 },
    { name: "favicon-32x32.png", size: 32 },
    { name: "apple-touch-icon.png", size: 180 },
    { name: "android-chrome-192x192.png", size: 192 },
    { name: "android-chrome-512x512.png", size: 512 },
  ];

  for (const { name, size } of sizes) {
    await sharp(source)
      .resize(size, size, { fit: "cover" })
      .png()
      .toFile(path.join(FAVICONS_DIR, name));
    console.log(`  ✓ ${name} (${size}x${size})`);
  }

  // favicon.ico — 32x32 PNG (modern browsers handle this fine)
  await sharp(source)
    .resize(32, 32, { fit: "cover" })
    .png()
    .toFile(path.join(PUBLIC_DIR, "favicon.ico"));
  console.log("  ✓ favicon.ico (32x32)");
}

/* ─── OG Image ─────────────────────────────────────── */

async function generateOGImage(logoSource) {
  const width = 1200;
  const height = 630;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#1a1a1a"/>
    </linearGradient>
    <linearGradient id="green" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3ECF8E"/>
      <stop offset="100%" stop-color="#2DD4BF"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${width}" height="4" fill="url(#green)"/>
  <text x="190" y="280" font-family="system-ui, -apple-system, sans-serif" font-size="80" font-weight="800" fill="white">GudDesk</text>
  <text x="190" y="340" font-family="system-ui, -apple-system, sans-serif" font-size="28" fill="#9ca3af">The open-source Intercom alternative</text>
  <text x="190" y="420" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="#6b7280">Live Chat · Shared Inbox · Knowledge Base · AI Agents · Automations</text>
  <text x="80" y="560" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="#3ECF8E">guddesk.com</text>
  <text x="1120" y="560" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="#4b5563" text-anchor="end">Open Source · AGPL-3.0</text>
</svg>`;

  // Generate base OG image
  const ogBase = await sharp(Buffer.from(svg)).png().toBuffer();

  // Composite the logo icon onto the OG image
  const logoIcon = await sharp(logoSource)
    .resize(100, 100, { fit: "cover" })
    .png()
    .toBuffer();

  const ogFinal = await sharp(ogBase)
    .composite([{ input: logoIcon, left: 75, top: 200 }])
    .jpeg({ quality: 92 })
    .toBuffer();

  fs.writeFileSync(path.join(STATIC_DIR, "og.jpg"), ogFinal);
  console.log(`  ✓ og.jpg (${width}x${height})`);

  // Twitter/X preview
  fs.writeFileSync(path.join(STATIC_DIR, "images", "x-preview.jpg"), ogFinal);
  console.log("  ✓ x-preview.jpg");

  // Also write app/opengraph-image
  fs.writeFileSync(path.join(ROOT, "app", "opengraph-image.jpg"), ogFinal);
  console.log("  ✓ app/opengraph-image.jpg");
}

/* ─── Main ─────────────────────────────────────────── */

async function main() {
  console.log("🎨 Generating GudDesk brand assets...\n");

  // Determine source
  let source;
  if (sourceImagePath) {
    source = path.resolve(sourceImagePath);
    if (!fs.existsSync(source)) {
      console.error(`Error: Image not found at ${source}`);
      process.exit(1);
    }
    console.log(`Source: ${source}\n`);
  } else if (fs.existsSync(LOGO_SVG)) {
    source = LOGO_SVG;
    console.log(`Source: ${LOGO_SVG}\n`);
  } else {
    console.error("Error: No source image. Use --from-image or place logo.svg in public/_static/");
    process.exit(1);
  }

  console.log("Favicons:");
  await generateFavicons(source);

  console.log("\nOG Image:");
  await generateOGImage(source);

  console.log("\n✅ Done! All brand assets generated.");
}

main().catch(console.error);
