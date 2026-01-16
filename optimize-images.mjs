import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ASSETS_DIR = path.join(process.cwd(), "assets");

const WEBP_QUALITY = 78;
const AVIF_QUALITY = 45;

function formatBytes(bytes) {
  const b = Number(bytes) || 0;
  const units = ["B", "KB", "MB", "GB"];
  let n = b;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const entries = await fs.readdir(ASSETS_DIR, { withFileTypes: true });
  const jpgs = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => /\.(jpe?g)$/i.test(name))
    .sort((a, b) => a.localeCompare(b));

  if (!jpgs.length) {
    console.log(`No .jpg files found in ${ASSETS_DIR}`);
    return;
  }

  let totalIn = 0;
  let totalOut = 0;
  let converted = 0;
  let skipped = 0;

  for (const name of jpgs) {
    const input = path.join(ASSETS_DIR, name);
    const base = name.replace(/\.(jpe?g)$/i, "");
    const outWebp = path.join(ASSETS_DIR, `${base}.webp`);
    const outAvif = path.join(ASSETS_DIR, `${base}.avif`);

    const inStat = await fs.stat(input);
    totalIn += inStat.size;

    const webpOk = await exists(outWebp);
    const avifOk = await exists(outAvif);

    // Skip if both outputs exist and are newer/equal to input.
    if (webpOk && avifOk) {
      const [wStat, aStat] = await Promise.all([fs.stat(outWebp), fs.stat(outAvif)]);
      if (wStat.mtimeMs >= inStat.mtimeMs && aStat.mtimeMs >= inStat.mtimeMs) {
        totalOut += wStat.size + aStat.size;
        skipped += 1;
        continue;
      }
    }

    // Convert (rotate() respects EXIF orientation, common from phone photos).
    await sharp(input).rotate().webp({ quality: WEBP_QUALITY }).toFile(outWebp);
    await sharp(input).rotate().avif({ quality: AVIF_QUALITY }).toFile(outAvif);

    const [wStat, aStat] = await Promise.all([fs.stat(outWebp), fs.stat(outAvif)]);
    totalOut += wStat.size + aStat.size;
    converted += 1;

    const pct = ((1 - (wStat.size + aStat.size) / (inStat.size * 2)) * 100).toFixed(0);
    console.log(
      `${name} → ${path.basename(outAvif)} (${formatBytes(aStat.size)}), ${path.basename(outWebp)} (${formatBytes(
        wStat.size,
      )})`,
    );
    console.log(`  input: ${formatBytes(inStat.size)} | outputs: ${formatBytes(wStat.size + aStat.size)} | ~${pct}% vs 2x JPG`);
  }

  console.log("");
  console.log(`Processed: ${jpgs.length} JPGs`);
  console.log(`Converted: ${converted} | Skipped: ${skipped}`);
  console.log(`Total input:  ${formatBytes(totalIn)}`);
  console.log(`Total outputs: ${formatBytes(totalOut)} (AVIF+WebP)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

