import { hasD1 } from './db';
import {
  FDROID_CURATED_APPS,
  FDROID_MIRRORS,
  FDROID_REPO_URL,
  IZZY_REPO_URL,
  type FdroidSeedEntry,
} from './fdroid-data';
import { canonicalStoreOrigin, err, json } from './http';
import { mapReview, num, str } from './mappers';
import type { Env, Row } from './types';

interface EdgeCache {
  match(req: Request | string): Promise<Response | undefined>;
  put(req: Request | string, res: Response): Promise<void>;
}

function getEdgeCache(): EdgeCache | null {
  const g = globalThis as unknown as { caches?: { default?: EdgeCache } };
  return g.caches?.default ?? null;
}

const CATEGORY_EQUIVALENTS: Record<string, Set<string>> = {
  games: new Set(['games', 'game', 'action', 'puzzle', 'arcade', 'strategy']),
  game: new Set(['games', 'game', 'action', 'puzzle', 'arcade', 'strategy']),
  tools: new Set(['tools', 'security', 'development', 'weather', 'file-sharing', 'terminal']),
  communication: new Set(['communication', 'email', 'mail', 'chat', 'messaging', 'xmpp']),
  social: new Set(['social', 'mastodon', 'fediverse']),
  media: new Set(['media', 'video', 'music', 'podcast', 'audio', 'streaming']),
  productivity: new Set(['productivity', 'notes', 'markdown', 'todo', 'tasks', 'calendar', 'writing']),
  education: new Set(['education', 'study', 'flashcards', 'books', 'maps', 'navigation']),
  finance: new Set(['finance', 'money', 'budget', 'accounting']),
  action: new Set(['action', 'rpg', 'roguelike']),
  puzzle: new Set(['puzzle', 'word']),
  arcade: new Set(['arcade', 'action']),
  strategy: new Set(['strategy', '4x', 'sandbox']),
};

const PALETTE = ['#0d9488', '#2563eb', '#f97316', '#7c3aed', '#16a34a', '#dc2626', '#0284c7', '#d97706'];

function colorForPackage(pkg: string): string {
  let h = 0;
  for (let i = 0; i < pkg.length; i++) h = (h * 31 + pkg.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function guessCategoryFromText(text: string): { category: string; kind: 'app' | 'game'; tags: string[] } {
  const s = text.toLowerCase();
  if (/\b(game|rpg|dungeon|puzzle|chess|arcade|strategy|platformer)\b/.test(s)) {
    const cat = s.includes('puzzle') ? 'puzzle' : s.includes('strategy') ? 'strategy' : 'action';
    return { category: cat, kind: 'game', tags: [cat, 'game', 'fdroid', 'open-source'] };
  }
  if (/\b(video|music|audio|podcast|player|stream|gallery|radio)\b/.test(s)) {
    return { category: 'media', kind: 'app', tags: ['media', 'audio', 'video', 'fdroid'] };
  }
  if (/\b(mail|email|chat|messag|xmpp|matrix|irc|sms)\b/.test(s)) {
    return { category: 'communication', kind: 'app', tags: ['communication', 'chat', 'fdroid'] };
  }
  if (/\b(mastodon|fediverse|lemmy|reddit|social|forum)\b/.test(s)) {
    return { category: 'social', kind: 'app', tags: ['social', 'fediverse', 'fdroid'] };
  }
  if (/\b(note|todo|task|calendar|markdown|office|document)\b/.test(s)) {
    return { category: 'productivity', kind: 'app', tags: ['productivity', 'notes', 'fdroid'] };
  }
  if (/\b(budget|expense|finance|money|wallet|invoice)\b/.test(s)) {
    return { category: 'finance', kind: 'app', tags: ['finance', 'money', 'fdroid'] };
  }
  if (/\b(study|flashcard|dictionary|wiki|map|learn|education)\b/.test(s)) {
    return { category: 'education', kind: 'app', tags: ['education', 'study', 'fdroid'] };
  }
  return { category: 'tools', kind: 'app', tags: ['tools', 'fdroid', 'open-source'] };
}

export function buildFdroidEntry(entry: FdroidSeedEntry, origin: string) {
  const id = `fdroid:${entry.packageName}`;
  const iconUrl = `${origin}/api/store/fdroid/icon/${encodeURIComponent(entry.packageName)}`;
  const apkUrl = `${FDROID_REPO_URL}/${entry.packageName}_${entry.versionCode}.apk`;

  const app = {
    id,
    packageName: entry.packageName,
    name: entry.name,
    developerId: 'dev-fdroid',
    developerName: entry.developerName,
    developerVerified: true,
    category: entry.category,
    kind: entry.kind,
    status: 'published' as const,
    shortDesc: entry.shortDesc,
    fullDesc: entry.fullDesc,
    iconUrl,
    iconColor: entry.iconColor,
    featureGraphicUrl: null,
    screenshots: [] as string[],
    tags: entry.tags,
    ageRating: 'Everyone',
    contentNotes: `Open-source (${entry.license}) • Mirrored from F-Droid`,
    supportEmail: '',
    website: entry.website,
    privacyPolicyUrl: entry.sourceCode,
    license: entry.license,
    sourceCodeUrl: entry.sourceCode,
    ratingAvg: 4.8,
    ratingCount: 0,
    downloadsCount: 0,
    featured: null,
    isFeatured: false,
    createdAt: entry.updatedAt,
    updatedAt: entry.updatedAt,
    source: 'F-Droid',
  };

  const release = {
    id,
    appId: id,
    versionCode: entry.versionCode,
    versionName: entry.versionName,
    apkProvider: 'fdroid' as const,
    apkKey: `${entry.packageName}_${entry.versionCode}.apk`,
    apkUrl,
    apkSizeBytes: entry.sizeBytes,
    sizeBytes: entry.sizeBytes,
    apkSha256: null,
    sha256: '',
    minSdk: entry.minSdk,
    targetSdk: entry.targetSdk,
    abiList: ['arm64-v8a', 'armeabi-v7a', 'x86_64'],
    permissions: entry.permissions,
    changelog: `Built and signed by F-Droid from open-source repository (${entry.license}).`,
    reviewStatus: 'approved' as const,
    reviewNote: 'Verified F-Droid open-source build',
    isLive: true,
    downloads: 0,
    createdAt: entry.updatedAt,
  };

  return { app, release };
}

function searchScore(
  app: { name: string; packageName: string; shortDesc: string; fullDesc: string; developerName: string; tags: string[] },
  needle: string,
): number {
  const nameLower = app.name.toLowerCase();
  const pkgLower = app.packageName.toLowerCase();
  const shortLower = app.shortDesc.toLowerCase();
  const devLower = app.developerName.toLowerCase();

  if (nameLower === needle || pkgLower === needle) return 100;
  if (nameLower.startsWith(needle)) return 85;
  const words = nameLower.split(/[\s\-_.:]+/);
  if (words.some((w) => w === needle)) return 75;
  if (words.some((w) => w.startsWith(needle))) return 65;
  if (nameLower.includes(needle)) return 55;
  if (pkgLower.includes(needle)) return 45;
  if (app.tags.some((t) => t.toLowerCase().includes(needle))) return 35;
  if (devLower.includes(needle)) return 30;
  if (shortLower.includes(needle)) return 20;
  if (app.fullDesc.toLowerCase().includes(needle)) return 10;
  return 0;
}

function categoryMatches(app: { category: string; tags: string[] }, category?: string | null): boolean {
  const wanted = (category ?? '').trim().toLowerCase();
  if (!wanted || wanted === 'all') return true;
  const eq = CATEGORY_EQUIVALENTS[wanted] ?? new Set([wanted]);
  if (eq.has(app.category.toLowerCase())) return true;
  return app.tags.some((t) => eq.has(t.toLowerCase()));
}

async function fetchJsonCached<T>(url: string, ttlSeconds = 3600, timeoutMs = 3000): Promise<T | null> {
  const cache = getEdgeCache();
  const cacheKey = new Request(url, { method: 'GET' });
  if (cache) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) return (await hit.json()) as T;
    } catch {
      /* ignore cache read error */
    }
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'KiwiStore-Worker/1.0' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    if (cache) {
      const toCache = new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${ttlSeconds}`,
        },
      });
      await cache.put(cacheKey, toCache).catch(() => {});
    }
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface FdroidSearchHit {
  name?: string;
  summary?: string;
  icon?: string;
  url?: string;
}

interface FdroidPackageApiResponse {
  packageName?: string;
  suggestedVersionCode?: number;
  packages?: Array<{ versionName?: string; versionCode?: number }>;
}

async function queryLiveFdroidSearch(query: string, origin: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { apps: [], releases: [] };
  const data = await fetchJsonCached<{ apps?: FdroidSearchHit[] }>(
    `https://search.f-droid.org/api/search_apps?q=${encodeURIComponent(trimmed)}`,
    3600,
    2500,
  );
  if (!data?.apps || !Array.isArray(data.apps)) return { apps: [], releases: [] };

  const apps = [];
  const releases = [];
  for (const hit of data.apps.slice(0, 24)) {
    const pkgMatch = hit.url?.match(/\/packages\/([A-Za-z0-9_.-]+)\/?$/);
    const pkg = pkgMatch?.[1]?.trim();
    if (!pkg) continue;
    const name = (hit.name || pkg.split('.').pop() || pkg).trim();
    const summary = (hit.summary || 'Open-source Android application from F-Droid.').trim();
    const guessed = guessCategoryFromText(`${name} ${summary}`);
    const id = `fdroid:${pkg}`;
    const nowIso = new Date().toISOString();

    apps.push({
      id,
      packageName: pkg,
      name,
      developerId: 'dev-fdroid',
      developerName: 'F-Droid Open Source',
      developerVerified: true,
      category: guessed.category,
      kind: guessed.kind,
      status: 'published' as const,
      shortDesc: summary,
      fullDesc: `${summary}\n\nBuilt and verified from source by the F-Droid open-source repository (${hit.url || `https://f-droid.org/packages/${pkg}`}).`,
      iconUrl: hit.icon || `${origin}/api/store/fdroid/icon/${encodeURIComponent(pkg)}`,
      iconColor: colorForPackage(pkg),
      featureGraphicUrl: null,
      screenshots: [] as string[],
      tags: guessed.tags,
      ageRating: 'Everyone',
      contentNotes: 'Open-source • Mirrored from F-Droid',
      supportEmail: '',
      website: hit.url || `https://f-droid.org/packages/${pkg}`,
      privacyPolicyUrl: hit.url || `https://f-droid.org/packages/${pkg}`,
      license: 'FOSS',
      sourceCodeUrl: hit.url || `https://f-droid.org/packages/${pkg}`,
      ratingAvg: 4.7,
      ratingCount: 0,
      downloadsCount: 0,
      featured: null,
      isFeatured: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      source: 'F-Droid',
    });

    releases.push({
      id,
      appId: id,
      versionCode: 1,
      versionName: 'latest',
      apkProvider: 'fdroid' as const,
      apkKey: `${pkg}.apk`,
      apkUrl: `${origin}/api/download/${id}`,
      apkSizeBytes: 15_728_640,
      sizeBytes: 15_728_640,
      apkSha256: null,
      sha256: '',
      minSdk: 21,
      targetSdk: 34,
      abiList: ['arm64-v8a', 'armeabi-v7a'],
      permissions: ['android.permission.INTERNET'],
      changelog: 'Latest F-Droid build.',
      reviewStatus: 'approved' as const,
      reviewNote: 'Verified F-Droid open-source build',
      isLive: true,
      downloads: 0,
      createdAt: nowIso,
    });
  }
  return { apps, releases };
}

export async function getFdroidCatalog(
  req: Request,
  env: Env,
  opts: { kind?: string | null; category?: string | null; query?: string | null; limit?: number; allowLiveSearch?: boolean } = {},
) {
  const origin = canonicalStoreOrigin(req, env);
  const kind = (opts.kind ?? '').trim().toLowerCase();
  const category = (opts.category ?? '').trim();
  const query = (opts.query ?? '').trim().toLowerCase();
  const limit = opts.limit ?? 100;

  const built = FDROID_CURATED_APPS.map((e) => buildFdroidEntry(e, origin));
  let filtered = built.filter(({ app }) => {
    const kindOk = !kind || kind === 'both' || app.kind === kind;
    return kindOk && categoryMatches(app, category);
  });

  if (query) {
    filtered = filtered
      .map((item) => ({ item, score: searchScore(item.app, query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item);
  }

  const apps = filtered.slice(0, limit).map((x) => x.app);
  const releases = filtered.slice(0, limit).map((x) => x.release);
  const seenPkgs = new Set(apps.map((a) => a.packageName.toLowerCase()));

  if (query.length >= 2 && opts.allowLiveSearch !== false) {
    const live = await queryLiveFdroidSearch(query, origin);
    for (let i = 0; i < live.apps.length; i++) {
      const a = live.apps[i];
      const r = live.releases[i];
      if (seenPkgs.has(a.packageName.toLowerCase())) continue;
      if (kind && kind !== 'both' && a.kind !== kind) continue;
      if (!categoryMatches(a, category)) continue;
      seenPkgs.add(a.packageName.toLowerCase());
      apps.push(a);
      releases.push(r);
    }
  }

  return {
    apps,
    releases,
    reviews: [],
    source: 'F-Droid',
    status: {
      fdroidRepoUrl: FDROID_REPO_URL,
      izzyRepoUrl: IZZY_REPO_URL,
      mirrors: FDROID_MIRRORS,
      curatedApps: FDROID_CURATED_APPS.length,
    },
  };
}

export async function getFdroidAppDetail(req: Request, env: Env, rawIdOrPkg: string) {
  const pkg = rawIdOrPkg.replace(/^fdroid:/i, '').trim();
  if (!pkg || !/^[A-Za-z0-9_.-]+$/.test(pkg)) return null;
  const origin = canonicalStoreOrigin(req, env);
  const id = `fdroid:${pkg}`;

  const seed = FDROID_CURATED_APPS.find((e) => e.packageName.toLowerCase() === pkg.toLowerCase());
  let baseApp: ReturnType<typeof buildFdroidEntry>['app'];
  let baseRelease: ReturnType<typeof buildFdroidEntry>['release'];

  if (seed) {
    const built = buildFdroidEntry(seed, origin);
    baseApp = built.app;
    baseRelease = built.release;
  } else {
    const searchRes = await queryLiveFdroidSearch(pkg, origin);
    const idx = searchRes.apps.findIndex((a) => a.packageName.toLowerCase() === pkg.toLowerCase());
    if (idx === -1) return null;
    baseApp = searchRes.apps[idx];
    baseRelease = searchRes.releases[idx];
  }

  // Enrich with live F-Droid Package API v1 if reachable
  const pkgInfo = await fetchJsonCached<FdroidPackageApiResponse>(
    `https://f-droid.org/api/v1/packages/${encodeURIComponent(baseApp.packageName)}`,
    3600,
    2500,
  );
  const releases: Array<ReturnType<typeof buildFdroidEntry>['release']> = [];
  if (pkgInfo?.packages && Array.isArray(pkgInfo.packages) && pkgInfo.packages.length > 0) {
    const suggested = pkgInfo.suggestedVersionCode || pkgInfo.packages[0]?.versionCode;
    for (const p of pkgInfo.packages.slice(0, 5)) {
      const vCode = num(p.versionCode, baseRelease.versionCode);
      const vName = str(p.versionName, String(vCode));
      const isLive: boolean = vCode === suggested || releases.length === 0;
      releases.push({
        ...baseRelease,
        id: isLive ? id : `${id}@${vCode}`,
        versionCode: vCode,
        versionName: vName,
        apkKey: `${baseApp.packageName}_${vCode}.apk`,
        apkUrl: `${FDROID_REPO_URL}/${baseApp.packageName}_${vCode}.apk`,
        isLive,
      });
    }
  } else {
    releases.push(baseRelease);
  }

  const liveRelease = releases.find((r) => r.isLive) ?? releases[0] ?? baseRelease;
  let reviews: ReturnType<typeof mapReview>[] = [];
  if (hasD1(env)) {
    try {
      const { results } = await env.DB.prepare(
        'SELECT * FROM reviews WHERE app_id = ? ORDER BY created_at DESC',
      )
        .bind(id)
        .all<Row>();
      reviews = results.map(mapReview);
    } catch {
      /* ignore if table not initialized yet */
    }
  }

  return {
    app: baseApp,
    screenshots: baseApp.screenshots,
    liveRelease,
    releases,
    reviews,
  };
}

export async function handleFdroidCatalogRoute(req: Request, env: Env, url: URL): Promise<Response> {
  const data = await getFdroidCatalog(req, env, {
    kind: url.searchParams.get('kind'),
    category: url.searchParams.get('category'),
    query: url.searchParams.get('q'),
    limit: Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || '100'))),
    allowLiveSearch: url.searchParams.get('live') !== '0',
  });
  return json(data);
}

export async function handleFdroidDownload(req: Request, _env: Env, rawId: string): Promise<Response> {
  const pkg = rawId.replace(/^fdroid:/i, '').split('@')[0].trim();
  if (!pkg || !/^[A-Za-z0-9_.-]+$/.test(pkg)) {
    return err('not_found', 'F-Droid package not found', 404);
  }
  const seed = FDROID_CURATED_APPS.find((e) => e.packageName.toLowerCase() === pkg.toLowerCase());
  const pkgInfo = await fetchJsonCached<FdroidPackageApiResponse>(
    `https://f-droid.org/api/v1/packages/${encodeURIComponent(pkg)}`,
    3600,
    2500,
  );
  const vCode =
    pkgInfo?.suggestedVersionCode ||
    pkgInfo?.packages?.[0]?.versionCode ||
    seed?.versionCode;
  if (!vCode) {
    return err('not_found', 'F-Droid release not found', 404);
  }
  return Response.redirect(`${FDROID_REPO_URL}/${pkg}_${vCode}.apk`, 302);
}

export async function handleFdroidIcon(_req: Request, _env: Env, pkg: string): Promise<Response> {
  const cleanPkg = pkg.replace(/^fdroid:/i, '').trim();
  const seed = FDROID_CURATED_APPS.find((e) => e.packageName.toLowerCase() === cleanPkg.toLowerCase());
  const data = await fetchJsonCached<{ apps?: FdroidSearchHit[] }>(
    `https://search.f-droid.org/api/search_apps?q=${encodeURIComponent(cleanPkg)}`,
    86400,
    2000,
  );
  const exact = data?.apps?.find((a) => a.url?.endsWith(`/packages/${cleanPkg}`));
  if (exact?.icon && exact.icon.startsWith('https://')) {
    return Response.redirect(exact.icon, 302);
  }

  const label = (seed?.name || cleanPkg.split('.').pop() || 'F').charAt(0).toUpperCase();
  const bg = seed?.iconColor || colorForPackage(cleanPkg);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><rect width="192" height="192" rx="42" fill="${bg}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="system-ui,-apple-system,sans-serif" font-weight="700" font-size="88">${label}</text></svg>`;
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
