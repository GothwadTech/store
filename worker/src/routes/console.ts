import { isAdmin, verifyUser } from '../auth';
import { bundleApps, ensureSchema, findApp, getDeveloperForUser, hasD1 } from '../db';
import { err, githubOwnerRepo, json, readJson } from '../http';
import { mapDeveloper, mapRelease, mapReview, mapSubmission, num, str, toJsonArray } from '../mappers';
import { MAX_APK_SIZE } from './media';
import type { AuthUser, D1Database, Env, Row } from '../types';

async function ownsApp(
  db: D1Database,
  user: AuthUser,
  env: Env,
  appId: string,
): Promise<{ app: Row; developer: Row } | { error: Response }> {
  const developer = await getDeveloperForUser(db, user);
  if (!developer && !isAdmin(user, env)) {
    return { error: err('developer_required', 'Create a developer profile first', 403) };
  }
  const app = await findApp(db, appId);
  if (!app) return { error: err('not_found', 'App not found', 404) };
  if (developer && str(app.developer_id) !== str(developer.id) && !isAdmin(user, env)) {
    return { error: err('forbidden', 'This app does not belong to your developer profile', 403) };
  }
  const effectiveDev =
    developer ??
    (await db.prepare('SELECT * FROM developers WHERE id = ? LIMIT 1').bind(str(app.developer_id)).first<Row>()) ??
    { id: str(app.developer_id), display_name: user.name, org_name: '' };
  return { app, developer: effectiveDev };
}

export async function handleDevRegister(req: Request, env: Env): Promise<Response> {
  const user = await verifyUser(req, env);
  if (!user) return err('unauthorized', 'Please sign in with Gothwad', 401);
  if (!hasD1(env)) return err('d1_not_configured', 'The Store database is not configured yet', 503);
  await ensureSchema(env.DB, env);

  const body = (await readJson<Row>(req)) ?? {};
  const displayName = str(body.displayName).trim();
  const supportEmail = str(body.supportEmail).trim();
  if (!displayName || !supportEmail) return err('bad_request', 'Display name and support email are required', 400);
  const orgName = str(body.orgName).trim();
  const website = str(body.website).trim() || null;
  const logoUrl = str(body.logoUrl).trim() || null;

  const existing = await getDeveloperForUser(env.DB, user);
  let devId: string;
  if (existing?.id) {
    devId = str(existing.id);
    await env.DB.prepare(
      'UPDATE developers SET display_name = ?, org_name = ?, support_email = ?, website = ?, logo_url = ? WHERE id = ?',
    ).bind(displayName, orgName, supportEmail, website, logoUrl, devId).run();
  } else {
    const slug = user.username.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'developer';
    devId = `dev-${slug}`;
    const collision = await env.DB.prepare('SELECT id FROM developers WHERE id = ? LIMIT 1').bind(devId).first<Row>();
    if (collision) devId = `dev-${crypto.randomUUID()}`;
    await env.DB.prepare(
      `INSERT INTO developers (id, user_id, username, display_name, org_name, support_email, website, logo_url, is_verified, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      devId, user.id, user.username.toLowerCase(), displayName, orgName,
      supportEmail, website, logoUrl, isAdmin(user, env) ? 1 : 0, new Date().toISOString(),
    ).run();
  }

  const saved = await env.DB.prepare('SELECT * FROM developers WHERE id = ? LIMIT 1').bind(devId).first<Row>();
  return json({ developer: saved ? mapDeveloper(saved) : null });
}

export async function handleDevGetApps(req: Request, env: Env): Promise<Response> {
  const user = await verifyUser(req, env);
  if (!user) return err('unauthorized', 'Please sign in with Gothwad', 401);
  if (!hasD1(env)) return err('d1_not_configured', 'The Store database is not configured yet', 503);
  await ensureSchema(env.DB, env);

  const developer = await getDeveloperForUser(env.DB, user);
  if (!developer) return err('developer_required', 'Create a developer profile first', 403);

  const { results: appRows } = await env.DB.prepare('SELECT * FROM apps WHERE developer_id = ? ORDER BY updated_at DESC')
    .bind(str(developer.id)).all<Row>();

  const bundle = await bundleApps(env.DB, appRows);
  const appIds = appRows.map((a) => str(a.id));
  let releases: Row[] = [];
  let submissions: Row[] = [];
  if (appIds.length > 0) {
    const placeholders = appIds.map(() => '?').join(', ');
    const [relsRes, subsRes] = await Promise.all([
      env.DB.prepare(`SELECT * FROM app_releases WHERE app_id IN (${placeholders}) ORDER BY version_code DESC`).bind(...appIds).all<Row>(),
      env.DB.prepare(`SELECT * FROM review_submissions WHERE app_id IN (${placeholders}) ORDER BY created_at DESC`).bind(...appIds).all<Row>(),
    ]);
    releases = relsRes.results;
    submissions = subsRes.results;
  }

  const appById = new Map(appRows.map((a) => [str(a.id), a]));
  const relById = new Map(releases.map((r) => [str(r.id), r]));

  return json({
    developer: mapDeveloper(developer),
    apps: bundle.apps,
    releases: releases.map(mapRelease),
    reviews: bundle.reviews,
    submissions: submissions.map((s) => mapSubmission(s, appById.get(str(s.app_id)), relById.get(str(s.release_id)), developer)),
  });
}

export async function handleDevCreateApp(req: Request, env: Env): Promise<Response> {
  const user = await verifyUser(req, env);
  if (!user) return err('unauthorized', 'Please sign in with Gothwad', 401);
  if (!hasD1(env)) return err('d1_not_configured', 'The Store database is not configured yet', 503);
  await ensureSchema(env.DB, env);

  const developer = await getDeveloperForUser(env.DB, user);
  if (!developer) return err('developer_required', 'Create a developer profile first', 403);

  const body = (await readJson<Row>(req)) ?? {};
  const name = str(body.name).trim();
  const packageName = str(body.packageName).trim().toLowerCase();
  if (!name || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName)) {
    return err('bad_request', 'A name and a valid package name (e.g. com.company.app) are required', 400);
  }

  const taken = await env.DB.prepare('SELECT id FROM apps WHERE package_name = ? LIMIT 1').bind(packageName).first<Row>();
  if (taken) return err('package_taken', 'This package name is already taken', 409);

  const appId = `app-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const kind = str(body.kind, 'app') === 'game' ? 'game' : 'app';
  const category = str(body.category, 'tools');

  await env.DB.prepare(
    `INSERT INTO apps (
      id, developer_id, package_name, name, category, kind, status,
      short_desc, full_desc, icon_url, tags, support_email, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    appId, str(developer.id), packageName, name, category, kind,
    str(body.shortDesc), str(body.fullDesc), str(body.iconUrl), toJsonArray(body.tags),
    str(body.supportEmail || developer.support_email), now, now,
  ).run();

  const row = await env.DB.prepare('SELECT * FROM apps WHERE id = ? LIMIT 1').bind(appId).first<Row>();
  const bundle = await bundleApps(env.DB, row ? [row] : []);
  return json({ app: bundle.apps[0] }, 201);
}

export async function handleDevAppDetail(req: Request, env: Env, appIdOrPkg: string): Promise<Response> {
  const user = await verifyUser(req, env);
  if (!user) return err('unauthorized', 'Please sign in with Gothwad', 401);
  if (!hasD1(env)) return err('d1_not_configured', 'The Store database is not configured yet', 503);
  await ensureSchema(env.DB, env);

  const owned = await ownsApp(env.DB, user, env, appIdOrPkg);
  if ('error' in owned) return owned.error;
  const appId = str(owned.app.id);
  const method = req.method.toUpperCase();

  if (method === 'GET') {
    const bundle = await bundleApps(env.DB, [owned.app]);
    const { results: relRows } = await env.DB.prepare('SELECT * FROM app_releases WHERE app_id = ? ORDER BY version_code DESC')
      .bind(appId).all<Row>();
    return json({ app: bundle.apps[0], releases: relRows.map(mapRelease), reviews: bundle.reviews });
  }

  if (method === 'PATCH') {
    const body = (await readJson<Row>(req)) ?? {};
    const now = new Date().toISOString();
    const sets: string[] = ['updated_at = ?'];
    const params: unknown[] = [now];

    const fields: Record<string, string> = {
      name: 'name',
      category: 'category',
      shortDesc: 'short_desc',
      fullDesc: 'full_desc',
      iconUrl: 'icon_url',
      featureGraphicUrl: 'feature_graphic_url',
      supportEmail: 'support_email',
      website: 'website',
      privacyPolicyUrl: 'privacy_policy_url',
    };
    const nullableFields = new Set(['featureGraphicUrl', 'website', 'privacyPolicyUrl']);
    for (const [from, to] of Object.entries(fields)) {
      if (!(from in body)) continue;
      const value = str(body[from]);
      sets.push(`${to} = ?`);
      params.push(nullableFields.has(from) ? value || null : value);
    }
    if ('kind' in body) {
      sets.push('kind = ?');
      params.push(str(body.kind) === 'game' ? 'game' : 'app');
    }
    if ('tags' in body) {
      sets.push('tags = ?');
      params.push(toJsonArray(body.tags));
    }

    if ('status' in body && str(body.status) !== str(owned.app.status)) {
      if (str(owned.app.status) === 'suspended') {
        return err('app_suspended', 'Only a Store admin can restore a suspended app', 403);
      }
      const wanted = str(body.status);
      if (wanted === 'unlisted') {
        sets.push('status = ?');
        params.push('unlisted');
      } else if (wanted === 'published') {
        const live = await env.DB.prepare('SELECT id FROM app_releases WHERE app_id = ? AND is_live = 1 LIMIT 1').bind(appId).first<Row>();
        if (!live) return err('no_live_release', 'An approved release is required before this app can go live', 400);
        sets.push('status = ?');
        params.push('published');
      } else {
        return err('bad_request', 'Only unlisted or published (with a live release) can be set here', 400);
      }
    }

    params.push(appId);
    const batchStmts = [env.DB.prepare(`UPDATE apps SET ${sets.join(', ')} WHERE id = ?`).bind(...params)];

    if (Array.isArray(body.screenshots)) {
      batchStmts.push(env.DB.prepare('DELETE FROM app_screenshots WHERE app_id = ?').bind(appId));
      const shots = body.screenshots.map(String).filter(Boolean).slice(0, 8);
      shots.forEach((shotUrl, idx) => {
        batchStmts.push(
          env.DB.prepare(
            `INSERT INTO app_screenshots (id, app_id, url, provider, sort_order, type) VALUES (?, ?, ?, 'd1', ?, 'phone')`,
          ).bind(`shot-${crypto.randomUUID()}`, appId, shotUrl, idx),
        );
      });
    }

    await env.DB.batch(batchStmts);
    const updated = await env.DB.prepare('SELECT * FROM apps WHERE id = ? LIMIT 1').bind(appId).first<Row>();
    const bundle = await bundleApps(env.DB, [updated ?? owned.app]);
    return json({ app: bundle.apps[0] });
  }

  if (method === 'DELETE') {
    if (str(owned.app.status) === 'published' && !isAdmin(user, env)) {
      return err('cannot_delete_published', 'Delist this app before deleting it', 409);
    }
    await env.DB.prepare('DELETE FROM apps WHERE id = ?').bind(appId).run();
    return json({ ok: true });
  }

  return err('method_not_allowed', 'Method not allowed', 405);
}

export async function handleDevStatusAction(
  req: Request,
  env: Env,
  appIdOrPkg: string,
  action: 'delist' | 'relist',
): Promise<Response> {
  const user = await verifyUser(req, env);
  if (!user) return err('unauthorized', 'Please sign in with Gothwad', 401);
  if (!hasD1(env)) return err('d1_not_configured', 'The Store database is not configured yet', 503);
  await ensureSchema(env.DB, env);

  const owned = await ownsApp(env.DB, user, env, appIdOrPkg);
  if ('error' in owned) return owned.error;
  if (str(owned.app.status) === 'suspended') {
    return err('app_suspended', 'Only a Store admin can restore a suspended app', 403);
  }
  const appId = str(owned.app.id);
  if (action === 'relist') {
    const live = await env.DB.prepare('SELECT id FROM app_releases WHERE app_id = ? AND is_live = 1 LIMIT 1').bind(appId).first<Row>();
    if (!live) return err('no_live_release', 'An approved release is required before this app can go live', 400);
  }
  const nextStatus = action === 'delist' ? 'unlisted' : 'published';
  await env.DB.prepare('UPDATE apps SET status = ?, updated_at = ? WHERE id = ?')
    .bind(nextStatus, new Date().toISOString(), appId).run();
  const updated = await env.DB.prepare('SELECT * FROM apps WHERE id = ? LIMIT 1').bind(appId).first<Row>();
  const bundle = await bundleApps(env.DB, [updated ?? owned.app]);
  return json({ app: bundle.apps[0] });
}

export { handleDevSubroute as handleDevAppSection };
export async function handleDevSubroute(
  req: Request,
  env: Env,
  appIdOrPkg: string,
  section: string,
  url: URL = new URL(req.url),
): Promise<Response> {
  const user = await verifyUser(req, env);
  if (!user) return err('unauthorized', 'Please sign in with Gothwad', 401);
  if (!hasD1(env)) return err('d1_not_configured', 'The Store database is not configured yet', 503);
  await ensureSchema(env.DB, env);

  const owned = await ownsApp(env.DB, user, env, appIdOrPkg);
  if ('error' in owned) return owned.error;
  const appId = str(owned.app.id);
  const method = req.method.toUpperCase();

  if (section === 'releases' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM app_releases WHERE app_id = ? ORDER BY version_code DESC')
      .bind(appId).all<Row>();
    return json({ releases: results.map(mapRelease) });
  }

  if (section === 'releases' && method === 'POST') {
    const body = (await readJson<Row>(req)) ?? {};
    const versionName = str(body.versionName).trim();
    const versionCode = Number(body.versionCode);
    const apk = (body.apk && typeof body.apk === 'object' ? body.apk : {}) as Row;
    const manifest = (body.manifest && typeof body.manifest === 'object' ? body.manifest : {}) as Row;
    const apkUrl = str(apk.url ?? body.apkUrl);
    if (!versionName || !Number.isInteger(versionCode) || versionCode < 1) {
      return err('bad_request', 'versionName and a positive integer versionCode are required', 400);
    }
    if (!apkUrl) return err('bad_request', 'Upload the APK first, then create the release with the returned URL', 400);
    const manifestPackage = manifest.packageName ? str(manifest.packageName) : null;
    if (manifestPackage && manifestPackage !== str(owned.app.package_name)) {
      return err('package_mismatch', `The APK package (${manifestPackage}) does not match this listing (${str(owned.app.package_name)})`, 400);
    }

    const latest = await env.DB.prepare('SELECT version_code FROM app_releases WHERE app_id = ? ORDER BY version_code DESC LIMIT 1')
      .bind(appId).first<Row>();
    const maxCode = latest ? num(latest.version_code) : 0;
    if (versionCode <= maxCode) {
      return err('version_code_not_increasing', `Version code must be higher than the current highest version code (${maxCode})`, 400);
    }

    const sizeBytes = num(apk.sizeBytes ?? body.sizeBytes ?? body.apkSizeBytes);
    const provider = str(apk.provider ?? body.apkProvider, 'github');
    const { owner, repo } = githubOwnerRepo(env);
    const githubPrefix = `https://github.com/${owner}/${repo}/releases/download/`;
    if (provider !== 'github') return err('bad_request', 'APKs must be uploaded through GitHub storefiles.', 400);
    if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_APK_SIZE) {
      return err('apk_too_large', 'The reliable APK upload limit is 50 MB.', 413);
    }
    if (!apkUrl.startsWith(githubPrefix)) {
      return err('invalid_apk_url', 'Create the release from an APK uploaded through this console.', 400);
    }

    const relId = `rel-${crypto.randomUUID()}`;
    const permissions = Array.isArray(manifest.permissions) ? toJsonArray(manifest.permissions) : toJsonArray(body.permissions);

    await env.DB.prepare(
      `INSERT INTO app_releases (
        id, app_id, version_code, version_name, apk_provider, apk_key, apk_url, apk_size_bytes,
        apk_sha256, min_sdk, target_sdk, permissions, changelog, review_status, is_live, downloads, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, ?)`,
    ).bind(
      relId, appId, versionCode, versionName, provider, str(apk.key ?? body.apkKey), apkUrl, sizeBytes,
      str(apk.sha256 ?? body.apkSha256) || null,
      manifest.minSdk == null ? (body.minSdk == null ? null : num(body.minSdk)) : num(manifest.minSdk),
      manifest.targetSdk == null ? (body.targetSdk == null ? null : num(body.targetSdk)) : num(manifest.targetSdk),
      permissions, str(body.changelog), new Date().toISOString(),
    ).run();

    const saved = await env.DB.prepare('SELECT * FROM app_releases WHERE id = ? LIMIT 1').bind(relId).first<Row>();
    return json({ release: saved ? mapRelease(saved) : null }, 201);
  }

  if (section === 'reviews' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM reviews WHERE app_id = ? ORDER BY created_at DESC').bind(appId).all<Row>();
    return json({ reviews: results.map(mapReview) });
  }

  if (section === 'stats' && method === 'GET') {
    const days = Math.min(90, Math.max(1, num(url.searchParams.get('days'), 7)));
    const since = new Date(Date.now() - (days - 1) * 86400000);
    since.setUTCHours(0, 0, 0, 0);
    const { results: rows } = await env.DB.prepare('SELECT created_at FROM downloads WHERE app_id = ? AND created_at >= ?')
      .bind(appId, since.toISOString()).all<Row>();

    const perDay = new Map<string, number>();
    for (let i = 0; i < days; i++) perDay.set(new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10), 0);
    for (const r of rows) {
      const d = str(r.created_at).slice(0, 10);
      if (perDay.has(d)) perDay.set(d, (perDay.get(d) ?? 0) + 1);
    }
    return json({
      days: [...perDay.entries()].map(([date, count]) => ({ date, count })),
      totalDownloads: num(owned.app.downloads_count),
      ratingAvg: num(owned.app.rating_avg),
      ratingCount: num(owned.app.rating_count),
    });
  }

  return err('method_not_allowed', 'Method not allowed', 405);
}

export async function handleDevSubmitRelease(
  req: Request,
  env: Env,
  appIdOrPkg: string,
  releaseId: string,
): Promise<Response> {
  const user = await verifyUser(req, env);
  if (!user) return err('unauthorized', 'Please sign in with Gothwad', 401);
  if (!hasD1(env)) return err('d1_not_configured', 'The Store database is not configured yet', 503);
  await ensureSchema(env.DB, env);

  const owned = await ownsApp(env.DB, user, env, appIdOrPkg);
  if ('error' in owned) return owned.error;
  const appId = str(owned.app.id);

  const rel = await env.DB.prepare('SELECT * FROM app_releases WHERE id = ? AND app_id = ? LIMIT 1')
    .bind(releaseId, appId).first<Row>();
  if (!rel) return err('not_found', 'Release not found', 404);
  if (!str(rel.apk_url)) return err('bad_request', 'Upload the APK file before submitting for review', 400);

  const { results: screenshots } = await env.DB.prepare('SELECT id FROM app_screenshots WHERE app_id = ?').bind(appId).all<Row>();
  const missing: string[] = [];
  if (!str(owned.app.name).trim()) missing.push('app name');
  if (!str(owned.app.short_desc).trim()) missing.push('short description');
  if (!str(owned.app.full_desc).trim()) missing.push('full description');
  if (!str(owned.app.icon_url).trim()) missing.push('app icon');
  if (!str(owned.app.support_email).trim()) missing.push('support email');
  if (screenshots.length < 2) missing.push('at least 2 screenshots');
  if (missing.length > 0) {
    return err('listing_incomplete', `Complete your store listing before review: ${missing.join(', ')}.`, 400);
  }

  let submission = await env.DB.prepare(`SELECT * FROM review_submissions WHERE release_id = ? AND status = 'pending' LIMIT 1`)
    .bind(releaseId).first<Row>();

  const now = new Date().toISOString();
  if (!submission) {
    if (str(rel.review_status) === 'rejected') {
      await env.DB.prepare(`UPDATE app_releases SET review_status = 'pending', review_note = NULL WHERE id = ?`).bind(releaseId).run();
    }
    const subId = `sub-${crypto.randomUUID()}`;
    await env.DB.prepare(
      `INSERT INTO review_submissions (id, app_id, release_id, submitted_by, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`,
    ).bind(subId, appId, releaseId, user.username.toLowerCase(), now).run();
    submission = await env.DB.prepare('SELECT * FROM review_submissions WHERE id = ? LIMIT 1').bind(subId).first<Row>();
  }

  if (str(owned.app.status) !== 'published') {
    await env.DB.prepare(`UPDATE apps SET status = 'in_review', updated_at = ? WHERE id = ?`).bind(now, appId).run();
  }

  return json({ submission: submission ? mapSubmission(submission, owned.app, rel, owned.developer) : null });
}

export async function handleDevReplyReview(
  req: Request,
  env: Env,
  appIdOrPkg: string | null,
  reviewId: string,
): Promise<Response> {
  const user = await verifyUser(req, env);
  if (!user) return err('unauthorized', 'Please sign in with Gothwad', 401);
  if (!hasD1(env)) return err('d1_not_configured', 'The Store database is not configured yet', 503);
  await ensureSchema(env.DB, env);

  const rev = await env.DB.prepare('SELECT * FROM reviews WHERE id = ? LIMIT 1').bind(reviewId).first<Row>();
  if (!rev) return err('not_found', 'Review not found', 404);

  const targetAppId = appIdOrPkg ?? str(rev.app_id);
  const owned = await ownsApp(env.DB, user, env, targetAppId);
  if ('error' in owned) return owned.error;
  if (str(rev.app_id) !== str(owned.app.id)) return err('not_found', 'Review not found', 404);

  const body = (await readJson<Row>(req)) ?? {};
  const reply = str(body.reply).trim();
  if (!reply) return err('bad_request', 'Reply text is required', 400);

  await env.DB.prepare('UPDATE reviews SET developer_reply = ?, developer_reply_at = ? WHERE id = ?')
    .bind(reply, new Date().toISOString(), reviewId).run();
  const updated = await env.DB.prepare('SELECT * FROM reviews WHERE id = ? LIMIT 1').bind(reviewId).first<Row>();
  return json({ review: updated ? mapReview(updated) : null });
}

export async function handleDevAllReviews(req: Request, env: Env): Promise<Response> {
  const user = await verifyUser(req, env);
  if (!user) return err('unauthorized', 'Please sign in with Gothwad', 401);
  if (!hasD1(env)) return err('d1_not_configured', 'The Store database is not configured yet', 503);
  await ensureSchema(env.DB, env);

  const developer = await getDeveloperForUser(env.DB, user);
  if (!developer) return err('developer_required', 'Create a developer profile first', 403);

  const { results: appRows } = await env.DB.prepare('SELECT id FROM apps WHERE developer_id = ?').bind(str(developer.id)).all<Row>();
  if (appRows.length === 0) return json({ reviews: [] });

  const ids = appRows.map((a) => str(a.id));
  const placeholders = ids.map(() => '?').join(', ');
  const { results: rows } = await env.DB.prepare(`SELECT * FROM reviews WHERE app_id IN (${placeholders}) ORDER BY created_at DESC`)
    .bind(...ids).all<Row>();
  return json({ reviews: rows.map(mapReview) });
}
