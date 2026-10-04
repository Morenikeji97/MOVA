/**
 * ShipMova — shrink a listing photo in the browser before it's uploaded.
 *
 * Phones take 5–10 MB photos. Each one becomes two small files instead: a
 * full-size WebP (long edge ≈ 1600px, typically 200–400 KB) for the listing
 * gallery and a thumbnail (≈ 480px, 30–60 KB) for cards. Sellers on mobile
 * data upload far less, buyers download far less, and Supabase Storage
 * egress drops with it. Supabase's own resizing needs the Pro plan
 * (docs/architecture-review.md §1.1).
 */

export const FULL_LONG_EDGE = 1600;
export const THUMB_LONG_EDGE = 480;
const FULL_QUALITY = 0.8;
const THUMB_QUALITY = 0.75;

/** Scales (width, height) so the long edge is at most `maxEdge`. Never enlarges. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { width, height };
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export type ResizedImage = { blob: Blob; type: "image/webp" | "image/jpeg"; ext: "webp" | "jpg" };

export type ResizedPhoto = { full: ResizedImage; thumb: ResizedImage };

/**
 * Decodes `file` once (applying its EXIF rotation) and encodes the full-size
 * and thumbnail versions. Throws if the browser can't decode the file.
 */
export async function resizePhoto(file: File): Promise<ResizedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    return {
      full: await encode(bitmap, FULL_LONG_EDGE, FULL_QUALITY),
      thumb: await encode(bitmap, THUMB_LONG_EDGE, THUMB_QUALITY),
    };
  } finally {
    bitmap.close();
  }
}

async function encode(bitmap: ImageBitmap, maxEdge: number, quality: number): Promise<ResizedImage> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't available");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Browsers that can't encode WebP (older Safari) silently return a PNG,
  // which would be larger than the original photo — use JPEG there instead.
  const webp = await toBlob(canvas, "image/webp", quality);
  if (webp.type === "image/webp") return { blob: webp, type: "image/webp", ext: "webp" };
  const jpeg = await toBlob(canvas, "image/jpeg", quality);
  return { blob: jpeg, type: "image/jpeg", ext: "jpg" };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode the photo"))),
      type,
      quality,
    );
  });
}
