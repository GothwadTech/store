import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cache = new Map();

function resolveTsRelative(fromRelPath, spec) {
  const fromDir = posix.dirname(fromRelPath.replace(/\\/g, '/'));
  const joined = posix.normalize(posix.join(fromDir, spec));
  const candidates = [joined, `${joined}.ts`, `${joined}.tsx`, `${joined}/index.ts`];
  for (const c of candidates) {
    if (existsSync(resolve(repoRoot, c))) return c;
  }
  return joined;
}

/**
 * Convert a TypeScript file in the repository (and its relative .ts imports)
 * into a Node-importable data: URL for unit testing.
 */
export async function moduleUrl(relativePath, base = new URL('../../', import.meta.url)) {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (cache.has(normalized)) return cache.get(normalized);

  const rawSource = await readFile(new URL(normalized, base), 'utf8');
  let jsSource = stripTypeScriptTypes(rawSource);

  const importRe = /(from\s+|import\s*\(\s*)(['"])([^'"]+)\2/g;
  const matches = [...jsSource.matchAll(importRe)];
  for (const m of matches) {
    const spec = m[3];
    if (spec.startsWith('./') || spec.startsWith('../')) {
      const targetRel = resolveTsRelative(normalized, spec);
      const targetDataUrl = await moduleUrl(targetRel, base);
      jsSource = jsSource.replaceAll(`${m[1]}${m[2]}${spec}${m[2]}`, `${m[1]}${JSON.stringify(targetDataUrl)}`);
    } else if (!spec.startsWith('node:') && !spec.startsWith('data:') && !spec.startsWith('file:')) {
      try {
        const resolved = import.meta.resolve(spec);
        jsSource = jsSource.replaceAll(`${m[1]}${m[2]}${spec}${m[2]}`, `${m[1]}${JSON.stringify(resolved)}`);
      } catch {
        /* keep original specifier */
      }
    }
  }

  const dataUrl = `data:text/javascript;base64,${Buffer.from(jsSource).toString('base64')}`;
  cache.set(normalized, dataUrl);
  return dataUrl;
}

export async function importTs(relativePath, base = new URL('../../', import.meta.url)) {
  return import(await moduleUrl(relativePath, base));
}
