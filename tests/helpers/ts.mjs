import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

/**
 * Repo ki TypeScript file ko Node me import karne layak data: URL banata hai.
 * relativePath repo root se hota hai (jaise 'worker/src/apk.ts').
 */
export async function moduleUrl(relativePath, base = new URL('../../', import.meta.url)) {
  const source = await readFile(new URL(relativePath, base), 'utf8');
  return `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`;
}

export async function importTs(relativePath, base = import.meta.url) {
  return import(await moduleUrl(relativePath, base));
}
