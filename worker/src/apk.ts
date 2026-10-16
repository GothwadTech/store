// ═══════════════════════════════════════════════════════════════════
// APK manifest auto-read (best-effort) — PLAN §8.5 / HANDOVER §6.2.4
//
// An APK is a ZIP archive. Its AndroidManifest.xml is Android binary
// XML (AXML), not plain text. This module:
//   1. opens the ZIP (End Of Central Directory → central directory),
//   2. extracts AndroidManifest.xml (stored, or raw-deflate via the
//      Workers-native DecompressionStream),
//   3. walks the AXML string pool + start-element chunks and reads
//      package / versionCode / versionName / minSdk / targetSdk /
//      uses-permission names off the <manifest> and <uses-sdk> tags.
//
// Best-effort by design: ANY failure returns whatever was found (or an
// all-null manifest) so the caller can fall back to the manual form
// fields. It never throws.
// ═══════════════════════════════════════════════════════════════════

export interface ApkManifest {
  packageName: string | null;
  versionCode: number | null;
  versionName: string | null;
  minSdk: number | null;
  targetSdk: number | null;
  permissions: string[];
}

export const emptyManifest = (): ApkManifest => ({
  packageName: null,
  versionCode: null,
  versionName: null,
  minSdk: null,
  targetSdk: null,
  permissions: [],
});

// ── ZIP reading ─────────────────────────────────────────────────────
function findEndOfCentralDirectory(view: DataView): number {
  // EOCD record is at least 22 bytes, comment up to 64 KiB. Signature 0x06054b50.
  const min = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  return -1;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream('deflate-raw');
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const out = await new Response(new Blob([copy.buffer as ArrayBuffer]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(out);
}

async function readZipEntry(bytes: Uint8Array, wanted: string): Promise<Uint8Array | null> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd < 0) return null;
  const count = view.getUint16(eocd + 10, true);
  let off = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(off, true) !== 0x02014b50) break; // central directory entry
    const method = view.getUint16(off + 10, true);
    const compressedSize = view.getUint32(off + 20, true);
    const nameLen = view.getUint16(off + 28, true);
    const extraLen = view.getUint16(off + 30, true);
    const commentLen = view.getUint16(off + 32, true);
    const localOffset = view.getUint32(off + 42, true);
    const name = decoder.decode(bytes.subarray(off + 46, off + 46 + nameLen));
    if (name === wanted) {
      // Local file header: skip its (possibly different) name/extra lengths.
      if (view.getUint32(localOffset, true) !== 0x04034b50) return null;
      const lNameLen = view.getUint16(localOffset + 26, true);
      const lExtraLen = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const raw = bytes.subarray(start, start + compressedSize);
      if (method === 0) return raw;
      if (method === 8) return inflateRaw(raw);
      return null; // unknown compression
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

// ── Binary XML (AXML) reading ───────────────────────────────────────
// Chunk types we care about.
const CHUNK_STRING_POOL = 0x0001;
const CHUNK_START_ELEMENT = 0x0102;

// Typed attribute value kinds (android.util.TypedValue).
const TYPE_STRING = 0x03;
const TYPE_INT_DEC = 0x10;
const TYPE_INT_HEX = 0x11;
const TYPE_INT_BOOLEAN = 0x12;
const TYPE_REFERENCE = 0x01;

function readStringPool(view: DataView, base: number, strings: string[]): void {
  // String pool header after the 8-byte chunk header.
  const stringCount = view.getUint32(base + 8, true);
  const flags = view.getUint32(base + 16, true);
  const stringsStart = view.getUint32(base + 20, true);
  const utf8 = (flags & 0x100) !== 0;
  const utf8Decoder = new TextDecoder('utf-8');
  for (let i = 0; i < stringCount; i++) {
    const rel = view.getUint32(base + 28 + i * 4, true);
    const at = base + stringsStart + rel;
    if (at >= view.byteLength) { strings.push(''); continue; }
    if (utf8) {
      // Two variable-length lengths (chars, bytes), then bytes, then NUL.
      let p = at;
      const skipLen = () => { // u8len: 1-2 bytes
        const b = view.getUint8(p);
        p += (b & 0x80) ? 2 : 1;
      };
      skipLen();
      const byteLenFirst = view.getUint8(p);
      const byteLen = (byteLenFirst & 0x80) ? ((byteLenFirst & 0x7f) << 8) | view.getUint8(p + 1) : byteLenFirst;
      p += (byteLenFirst & 0x80) ? 2 : 1;
      strings.push(utf8Decoder.decode(new Uint8Array(view.buffer, view.byteOffset + p, Math.min(byteLen, view.byteLength - p))));
    } else {
      // UTF-16: length in chars (with high-bit continuation), then chars, then NUL.
      let len = view.getUint16(at, true);
      let p = at + 2;
      if (len & 0x8000) { len = ((len & 0x7fff) << 16) | view.getUint16(p, true); p += 2; }
      let s = '';
      for (let c = 0; c < len; c++) s += String.fromCharCode(view.getUint16(p + c * 2, true));
      strings.push(s);
    }
  }
}

interface XmlAttr { name: string; value: string | null; intValue: number | null }

function attrValue(view: DataView, strings: string[], attrBase: number): Pick<XmlAttr, 'value' | 'intValue'> {
  // ResXMLTree_attribute: ns(4) name(4) rawValue(4) typedValue{size(2) res0(1) dataType(1) data(4)}
  const rawValue = view.getInt32(attrBase + 8, true);
  const size = view.getUint16(attrBase + 12, true);
  if (size < 8) return { value: rawValue >= 0 ? strings[rawValue] ?? null : null, intValue: null };
  const dataType = view.getUint8(attrBase + 12 + 3);
  const data = view.getUint32(attrBase + 12 + 4, true);
  switch (dataType) {
    case TYPE_STRING: return { value: strings[data] ?? null, intValue: null };
    case TYPE_INT_DEC:
    case TYPE_INT_HEX: return { value: null, intValue: data | 0 };
    case TYPE_INT_BOOLEAN: return { value: null, intValue: data !== 0 ? 1 : 0 };
    case TYPE_REFERENCE: return { value: null, intValue: data | 0 };
    default:
      return { value: rawValue >= 0 ? strings[rawValue] ?? null : null, intValue: null };
  }
}

function parseBinaryXml(bytes: Uint8Array): ApkManifest {
  const manifest = emptyManifest();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 8 || view.getUint16(0, true) !== 0x0003) return manifest; // RES_XML_TYPE
  const strings: string[] = [];
  let off = view.getUint16(2, true); // file header size
  while (off + 8 <= bytes.byteLength) {
    const type = view.getUint16(off, true);
    const size = view.getUint32(off + 4, true);
    if (size < 8) break;
    if (type === CHUNK_STRING_POOL) {
      readStringPool(view, off, strings);
    } else if (type === CHUNK_START_ELEMENT) {
      // Layout: chunk header (8) + lineNumber/comment (8), then attrExt:
      // ns(4) name(4) attributeStart(2) attributeSize(2) attributeCount(2)...
      // attributeStart is measured from the start of attrExt (off + 16).
      const nameIdx = view.getUint32(off + 20, true);
      const tag = strings[nameIdx] ?? '';
      const attrStart = view.getUint16(off + 24, true);
      const attrSize = view.getUint16(off + 26, true) || 20;
      const attrCount = view.getUint16(off + 28, true);
      const attrs = new Map<string, XmlAttr>();
      for (let i = 0; i < attrCount; i++) {
        const aBase = off + 16 + attrStart + i * attrSize;
        if (aBase + 20 > bytes.byteLength) break;
        const aName = strings[view.getUint32(aBase + 4, true)] ?? '';
        const { value, intValue } = attrValue(view, strings, aBase);
        if (aName) attrs.set(aName, { name: aName, value, intValue });
      }
      const asInt = (a?: XmlAttr) => (a?.intValue != null ? a.intValue : a?.value != null && /^-?\d+$/.test(a.value) ? parseInt(a.value, 10) : null);
      if (tag === 'manifest') {
        manifest.packageName = attrs.get('package')?.value ?? manifest.packageName;
        manifest.versionCode = asInt(attrs.get('versionCode')) ?? manifest.versionCode;
        manifest.versionName = attrs.get('versionName')?.value ?? manifest.versionName;
      } else if (tag === 'uses-sdk') {
        manifest.minSdk = asInt(attrs.get('minSdkVersion')) ?? manifest.minSdk;
        manifest.targetSdk = asInt(attrs.get('targetSdkVersion')) ?? manifest.targetSdk;
      } else if (tag === 'uses-permission' || tag === 'uses-permission-sdk-23') {
        const name = attrs.get('name')?.value;
        if (name && !manifest.permissions.includes(name)) manifest.permissions.push(name);
      }
    }
    off += size;
  }
  return manifest;
}

/**
 * Best-effort manifest read from raw APK bytes. Never throws — any
 * problem returns the empty/partial manifest so upload flows can fall
 * back to the manual version fields in the console form.
 */
export async function parseApkManifest(apkBytes: ArrayBuffer | Uint8Array): Promise<ApkManifest> {
  try {
    const bytes = apkBytes instanceof Uint8Array ? apkBytes : new Uint8Array(apkBytes);
    const manifestXml = await readZipEntry(bytes, 'AndroidManifest.xml');
    if (!manifestXml) return emptyManifest();
    return parseBinaryXml(manifestXml);
  } catch {
    return emptyManifest();
  }
}

/** SHA-256 hex digest of the APK (stored per release, shown on the app page). */
export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const data = bytes instanceof Uint8Array ? (bytes as Uint8Array) : new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
