/**
 * Evidence photos extracted from camera EXIF data.
 * Run `npm run extract:photos` to refresh after adding new pics/ files.
 */

import data from "./evidence-photos.json";

export interface EvidencePhoto {
  id: string;
  filename: string;
  coords: [number, number];
  takenAt: string | null;
  device: string | null;
}

export const EVIDENCE_PHOTOS = data as EvidencePhoto[];
