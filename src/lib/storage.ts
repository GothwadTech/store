// ── File storage routing (PLAN SS6 - pakka faisla) ───────────────────
// Sirf 3 providers: ImgBB (images) · GitHub storefiles (APK <=25MB) · Backblaze B2 (>25MB)
// Supabase Storage BILKUL NAHI - Supabase sirf database (500MB metadata) ke liye hai.
export const APK_GITHUB_LIMIT_BYTES = 25 * 1024 * 1024; // 25 MB

export function apkProviderForSize(sizeBytes: number): 'github' | 'b2' {
  return sizeBytes <= APK_GITHUB_LIMIT_BYTES ? 'github' : 'b2';
}

export function apkProviderLabel(sizeBytes: number): string {
  return apkProviderForSize(sizeBytes) === 'github'
    ? 'GitHub · storefiles repository (≤25 MB rule)'
    : 'Backblaze B2 (>25 MB rule)';
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

/** Upload se pehle browser me image halki karo (ImgBB transform nahi karta - PLAN SS6.4) */
export async function compressImage(file: File, maxWidth: number, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width);
    if (scale >= 1 && file.size < 300_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? file), 'image/webp', quality),
    );
  } catch {
    return file;
  }
}

/** Ikshana ke liye placeholder icon (asli icon ImgBB URL hoga) */
export function iconPlaceholder(name: string, color: string): string {
  const letter = encodeURIComponent(name.trim().charAt(0).toUpperCase() || 'G');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='192' height='192'><rect width='192' height='192' rx='42' fill='${color}'/><text x='96' y='128' font-size='92' font-family='Arial' font-weight='700' fill='white' text-anchor='middle'>${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}`;
}
