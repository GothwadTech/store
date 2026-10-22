// ── Client-side WebP/PNG Canvas Image Optimizer for Cloudflare D1 `store_images` ──
export const MAX_IMAGE_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_OUTPUT_BYTES = 380_000; // Strictly under Worker's 400 KB D1 BLOB cap
export const MAX_IMAGE_PIXELS = 40_000_000;

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type ImageTarget = 'icon' | 'screenshot' | 'banner';

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  wasOptimized: boolean;
}

function formatImageSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function isSupportedImage(file: File): boolean {
  if (SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase())) return true;
  return !file.type && /\.(?:jpe?g|png|webp)$/i.test(file.name);
}

export function assertImageFile(file: File): void {
  if (!isSupportedImage(file)) throw new Error('Choose a PNG, JPG, or WebP image.');
  if (!file.size) {
    throw new Error('This image is empty. Choose the original image file and try again.');
  }
  if (file.size > MAX_IMAGE_SOURCE_BYTES) {
    throw new Error(
      `This image is ${formatImageSize(file.size)}. Choose an image under ${formatImageSize(MAX_IMAGE_SOURCE_BYTES)} before uploading.`,
    );
  }
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else {
          reject(
            new Error(
              'Your browser could not optimize this image. Try a PNG, JPG, or WebP file.',
            ),
          );
        }
      },
      'image/webp',
      quality,
    );
  });
}

/**
 * Optimizes icons (512x512 WebP, alpha preserved) and screenshots/banners
 * (max 1280px WebP) on the client before uploading to Cloudflare D1 `store_images`.
 */
export async function prepareImage(file: File, target: ImageTarget): Promise<PreparedImage> {
  assertImageFile(file);
  if (typeof createImageBitmap !== 'function') {
    throw new Error(
      'This browser cannot prepare images for upload. Please use a current browser and try again.',
    );
  }

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    if (!sourceWidth || !sourceHeight) throw new Error('This image has invalid dimensions.');
    if (sourceWidth * sourceHeight > MAX_IMAGE_PIXELS) {
      throw new Error(
        'This image has too many pixels. Resize it to a smaller image and try again.',
      );
    }

    const icon = target === 'icon';
    const maxLongEdge = icon ? 512 : 1280;
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
    if (!context) {
      throw new Error('Your browser could not prepare this image. Try again in a current browser.');
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      bitmap,
      icon ? Math.round((512 - drawWidth) / 2) : 0,
      icon ? Math.round((512 - drawHeight) / 2) : 0,
      drawWidth,
      drawHeight,
    );

    let quality = icon ? 0.86 : 0.82;
    let blob = await canvasBlob(canvas, quality);
    while (blob.size > MAX_IMAGE_OUTPUT_BYTES && quality > 0.38) {
      quality -= 0.1;
      blob = await canvasBlob(canvas, quality);
    }
    if (blob.size > MAX_IMAGE_OUTPUT_BYTES) {
      throw new Error(
        `This image is still ${formatImageSize(blob.size)} after WebP optimization (max ${formatImageSize(MAX_IMAGE_OUTPUT_BYTES)}). Choose a simpler or smaller image.`,
      );
    }
    return { blob, width, height, sourceWidth, sourceHeight, wasOptimized: true };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('We could not read this image. Choose a PNG, JPG, or WebP image and try again.');
  } finally {
    bitmap?.close();
  }
}
