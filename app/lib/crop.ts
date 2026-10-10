/**
 * Framework-free square-crop canvas math shared by the admin avatar editor
 * (`ImageUploadCrop`) and the student passport upload (`AvatarCropDialog`).
 *
 * Keeping the geometry in one place means the preview a user sees and the
 * bytes that get exported are computed identically — the previous version
 * duplicated this math inline and the two drifted, which is what produced the
 * "nothing visible until I drag" and "black edges" bugs.
 */

export type CropTransform = { zoom: number; pan: { x: number; y: number } };

/** Scale that makes the image COVER a square of `size` (no letterboxing). */
export function coverScale(
  img: { naturalWidth: number; naturalHeight: number },
  size: number,
): number {
  return Math.max(size / img.naturalWidth, size / img.naturalHeight);
}

/** Top-left draw position + scaled dimensions for the current transform. */
export function drawGeometry(
  img: { naturalWidth: number; naturalHeight: number },
  size: number,
  t: CropTransform,
): { drawX: number; drawY: number; w: number; h: number } {
  const scale = coverScale(img, size) * t.zoom;
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  return { drawX: (size - w) / 2 + t.pan.x, drawY: (size - h) / 2 + t.pan.y, w, h };
}

/**
 * Clamp the pan offset so the image always fully covers the square viewport —
 * you can never drag an empty edge into the crop window.
 */
export function clampPan(
  img: { naturalWidth: number; naturalHeight: number },
  size: number,
  zoom: number,
  pan: { x: number; y: number },
): { x: number; y: number } {
  const scale = coverScale(img, size) * zoom;
  const maxX = Math.max(0, (img.naturalWidth * scale - size) / 2);
  const maxY = Math.max(0, (img.naturalHeight * scale - size) / 2);
  return {
    x: Math.min(Math.max(pan.x, -maxX), maxX),
    y: Math.min(Math.max(pan.y, -maxY), maxY),
  };
}

/**
 * Draw the preview onto a canvas context. Paints an opaque white base first so
 * transparent PNGs and edge cases can never bleed through as the old dark
 * viewport colour, then cover-crops the image for the current transform.
 */
export function drawCropPreview(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  size: number,
  t: CropTransform,
): void {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  const { drawX, drawY, w, h } = drawGeometry(img, size, t);
  ctx.drawImage(img, drawX, drawY, w, h);
}

/**
 * Export the current crop as a square JPEG data-URL at `outSize` (default
 * 320 — matches the existing avatar storage convention).
 */
export function exportSquareCrop(
  img: HTMLImageElement,
  viewSize: number,
  t: CropTransform,
  outSize = 320,
  quality = 0.88,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const factor = outSize / viewSize;
  const { drawX, drawY, w, h } = drawGeometry(img, viewSize, t);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, drawX * factor, drawY * factor, w * factor, h * factor);
  return canvas.toDataURL("image/jpeg", quality);
}
