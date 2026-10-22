// ── File storage routing ─────────────────────────────────────────────
// Images → Cloudflare D1 `store_images` BLOB + Edge Cache (`/api/images/:id`).
// APKs   → GitHub storefiles Releases.
import {
  MAX_IMAGE_OUTPUT_BYTES,
  MAX_IMAGE_PIXELS,
  MAX_IMAGE_SOURCE_BYTES,
  assertImageFile,
  prepareImage,
} from './imageUpload';
import type { ImageTarget, PreparedImage } from './imageUpload';

export {
  MAX_IMAGE_OUTPUT_BYTES,
  MAX_IMAGE_PIXELS,
  MAX_IMAGE_SOURCE_BYTES,
  assertImageFile,
  prepareImage,
};
export type { ImageTarget, PreparedImage };

export const MAX_APK_SIZE_BYTES = 50 * 1024 * 1024;
export const APK_GITHUB_LIMIT_BYTES = MAX_APK_SIZE_BYTES;

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

export function assertApkFile(file: File): void {
  if (!file.size) {
    throw new Error('This APK is empty. Export a signed release APK and try again.');
  }
  if (!/\.apk$/i.test(file.name)) {
    throw new Error(
      'Choose an Android APK file (.apk). App bundles (.aab) are not supported yet.',
    );
  }
  if (file.size > MAX_APK_SIZE_BYTES) {
    throw new Error(
      `This APK is ${formatBytes(file.size)}. The reliable upload limit is ${formatBytes(MAX_APK_SIZE_BYTES)}.`,
    );
  }
}

/** Backward-compatible lightweight helper used by older callers. */
export async function compressImage(file: File, maxWidth: number, quality = 0.82): Promise<Blob> {
  const prepared = await prepareImage(file, maxWidth <= 512 ? 'icon' : 'screenshot');
  void quality;
  return prepared.blob;
}

/** Fallback SVG placeholder icon */
export function iconPlaceholder(name: string, color: string): string {
  const letter = encodeURIComponent(name.trim().charAt(0).toUpperCase() || 'G');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='192' height='192'><rect width='192' height='192' rx='42' fill='${color}'/><text x='96' y='128' font-size='92' font-family='Arial' font-weight='700' fill='white' text-anchor='middle'>${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}`;
}
