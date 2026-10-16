// ── File storage routing ─────────────────────────────────────────────
// Images → ImgBB. APKs → GitHub storefiles Releases.
// Backblaze B2 is intentionally not part of the upload path: a single,
// well-observed provider is more reliable for developers than a flaky split.
export const MAX_APK_SIZE_BYTES = 50 * 1024 * 1024; // Conservative Worker-safe limit; GitHub stores every APK.
export const APK_GITHUB_LIMIT_BYTES = MAX_APK_SIZE_BYTES; // Legacy name retained for callers.
export const MAX_IMAGE_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_OUTPUT_BYTES = 6 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type ImageTarget = 'icon' | 'screenshot';

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  wasOptimized: boolean;
}

export function apkProviderForSize(_sizeBytes: number): 'github' {
  return 'github';
}

export function apkProviderLabel(_sizeBytes: number): string {
  return `GitHub · storefiles repository (up to ${formatBytes(MAX_APK_SIZE_BYTES)})`;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

export function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B+`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K+`;
  return `${n}`;
}

function isSupportedImage(file: File): boolean {
  if (SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase())) return true;
  // A few Android file managers omit the MIME type. Keep this narrow so an
  // arbitrary file is never passed to the canvas / ImgBB pipeline.
  return !file.type && /\.(?:jpe?g|png|webp)$/i.test(file.name);
}

export function assertImageFile(file: File): void {
  if (!isSupportedImage(file)) throw new Error('Choose a PNG, JPG, or WebP image.');
  if (!file.size) throw new Error('This image is empty. Choose the original image file and try again.');
  if (file.size > MAX_IMAGE_SOURCE_BYTES) {
    throw new Error(`This image is ${formatBytes(file.size)}. Choose an image under ${formatBytes(MAX_IMAGE_SOURCE_BYTES)} before uploading.`);
  }
}

export function assertApkFile(file: File): void {
  if (!file.size) throw new Error('This APK is empty. Export a signed release APK and try again.');
  if (!/\.apk$/i.test(file.name)) throw new Error('Choose an Android APK file (.apk). App bundles (.aab) are not supported yet.');
  if (file.size > MAX_APK_SIZE_BYTES) {
    throw new Error(`This APK is ${formatBytes(file.size)}. The reliable upload limit is ${formatBytes(MAX_APK_SIZE_BYTES)}.`);
  }
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Your browser could not optimize this image. Try a PNG, JPG, or WebP file.'));
    }, 'image/webp', quality);
  });
}

/**
 * Normalise artwork before it reaches ImgBB. The output is always WebP:
 * - icons are fitted into a transparent 512×512 square (no unexpected crop),
 * - screenshots retain their aspect ratio and have a sensible long edge,
 * - dimensions, source bytes, output bytes and canvas pixels are all bounded.
 */
export async function prepareImage(file: File, target: ImageTarget): Promise<PreparedImage> {
  assertImageFile(file);
  if (typeof createImageBitmap !== 'function') {
    throw new Error('This browser cannot prepare images for upload. Please use a current browser and try again.');
  }

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    if (!sourceWidth || !sourceHeight) throw new Error('This image has invalid dimensions.');
    if (sourceWidth * sourceHeight > MAX_IMAGE_PIXELS) {
      throw new Error('This image has too many pixels. Resize it to a smaller image and try again.');
    }

    const icon = target === 'icon';
    const maxLongEdge = icon ? 512 : 1600;
    const scale = icon
      ? Math.min(512 / sourceWidth, 512 / sourceHeight)
      : Math.min(1, maxLongEdge / Math.max(sourceWidth, sourceHeight));
    const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
    const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
    const width = icon ? 512 : drawWidth;
    const height = icon ? 512 : drawHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Your browser could not prepare this image. Try again in a current browser.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, icon ? Math.round((512 - drawWidth) / 2) : 0, icon ? Math.round((512 - drawHeight) / 2) : 0, drawWidth, drawHeight);

    let quality = 0.86;
    let blob = await canvasBlob(canvas, quality);
    while (blob.size > MAX_IMAGE_OUTPUT_BYTES && quality > 0.5) {
      quality -= 0.12;
      blob = await canvasBlob(canvas, quality);
    }
    if (blob.size > MAX_IMAGE_OUTPUT_BYTES) {
      throw new Error(`This image is still ${formatBytes(blob.size)} after optimization. Choose a smaller image and try again.`);
    }
    return { blob, width, height, sourceWidth, sourceHeight, wasOptimized: true };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('We could not read this image. Choose a PNG, JPG, or WebP image and try again.');
  } finally {
    bitmap?.close();
  }
}

/** Backward-compatible lightweight helper used by older callers. */
export async function compressImage(file: File, maxWidth: number, quality = 0.82): Promise<Blob> {
  const prepared = await prepareImage(file, maxWidth <= 512 ? 'icon' : 'screenshot');
  void quality;
  return prepared.blob;
}

/** Ikshana ke liye placeholder icon (asli icon ImgBB URL hoga) */
export function iconPlaceholder(name: string, color: string): string {
  const letter = encodeURIComponent(name.trim().charAt(0).toUpperCase() || 'G');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='192' height='192'><rect width='192' height='192' rx='42' fill='${color}'/><text x='96' y='128' font-size='92' font-family='Arial' font-weight='700' fill='white' text-anchor='middle'>${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}`;
}
