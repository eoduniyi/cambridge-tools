/**
 * Reads EXIF GPS data from photos in pics/ and:
 *  1. Copies them to static/evidence/ with kebab-case filenames
 *  2. Writes src/lib/data/evidence-photos.json with id, coords, taken date
 *
 * Usage: npx tsx scripts/extract-photo-exif.ts
 */

import {
  readdirSync,
  statSync,
  copyFileSync,
  mkdirSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import exifr from "exifr";

const PICS_DIR = join(process.cwd(), "pics");
const STATIC_DIR = join(process.cwd(), "static/evidence");
const DATA_OUT = join(process.cwd(), "src/lib/data/evidence-photos.json");

interface EvidencePhoto {
  id: string;
  filename: string;
  coords: [number, number];
  takenAt: string | null;
  device: string | null;
}

async function main() {
  const files = readdirSync(PICS_DIR).filter((f) =>
    /\.(jpg|jpeg|heic|png)$/i.test(f),
  );
  console.log(`Found ${files.length} image(s) in pics/\n`);

  mkdirSync(STATIC_DIR, { recursive: true });

  const out: EvidencePhoto[] = [];

  for (const f of files) {
    const fullPath = join(PICS_DIR, f);
    const stats = statSync(fullPath);

    try {
      const meta = await exifr.parse(fullPath, { gps: true, exif: true });

      if (!meta) {
        console.log(`${f}: no EXIF`);
        continue;
      }

      const lat = meta.latitude;
      const lng = meta.longitude;
      const taken = meta.DateTimeOriginal ?? meta.CreateDate;
      const device = [meta.Make, meta.Model].filter(Boolean).join(" ") || null;

      if (lat == null || lng == null) {
        console.log(`${f}: no GPS data — skipping`);
        continue;
      }

      // Build a slug from timestamp
      const date = taken instanceof Date ? taken : new Date(taken);
      const id = `flyer-${date.toISOString().replace(/[:.]/g, "-").replace(/\..*/, "")}`;
      const filename = `${id}.jpg`;

      // Copy to static/evidence
      copyFileSync(fullPath, join(STATIC_DIR, filename));

      out.push({
        id,
        filename,
        coords: [lat, lng],
        takenAt: date.toISOString(),
        device,
      });

      console.log(`${f}`);
      console.log(`  → ${filename}`);
      console.log(`  GPS:    ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      console.log(`  taken:  ${date.toISOString()}`);
      console.log(`  device: ${device}`);
      console.log(`  size:   ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log();
    } catch (err) {
      console.log(`${f}: error - ${(err as Error).message}\n`);
    }
  }

  writeFileSync(DATA_OUT, JSON.stringify(out, null, 2));
  console.log(`Wrote ${out.length} entries to ${DATA_OUT}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
