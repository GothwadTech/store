import { verifyUser } from '../auth';
import { ensureSchema, findApp, hasD1, recomputeAppRating } from '../db';
import { err, json, readJson } from '../http';
import { mapReport, mapReview, num, str } from '../mappers';
import type { Env, Row } from '../types';

export async function handleGetLibrary(req: Request, env: Env): Promise<Response> {
  const user = await verifyUser(req, env);
  if (!user) return err('unauthorized', 'Please sign in with Gothwad', 401);
  if (!hasD1(env)) return err('d1_not_configured', 'The Store database is not configured yet', 503);
  await ensureSchema(env.DB, env);

  const { results } = await env.DB.prepare(
    'SELECT app_id FROM library WHERE user_id = ? OR LOWER(user_id) = ? ORDER BY first_downloaded_at DESC',
  )
    .bind(user.id, user.username.toLowerCase())
    .all<Row>();
  return json({ appIds: [...new Set(results.map((r) => str(r.app_id)))] });
}

export async function handleGetWishlist(req: Request, env: Env): Promise<Response> {
  const user = await verifyUser(req, env);
  if (!user) return err('unauthorized', 'Please sign in with Gothwad', 401);
  if (!hasD1(env)) return err('d1_not_configured', 'The Store database is not configured yet', 503);
  await ensureSchema(env.DB, env);

  const { results } = await env.DB.prepare(
    'SELECT app_id FROM wishlists WHERE user_id = ? OR LOWER(user_id) = ? ORDER BY created_at DESC',
  )
    .bind(user.id, user.username.toLowerCase())
    .all<Row>();
  return json({ appIds: [...new Set(results.map((r) => str(r.app_id)))] });
}

export async function handleStoreAppAction(
  req: Request,
  env: Env,
  appIdOrPkg: string,
  action: 'reviews' | 'wishlist' | 'report' | 'library',
): Promise<Response> {
  const user = await verifyUser(req, env);
  if (!user) return err('unauthorized', 'Please sign in with Gothwad', 401);
  if (!hasD1(env)) return err('d1_not_configured', 'The Store database is not configured yet', 503);
  await ensureSchema(env.DB, env);

  const app = await findApp(env.DB, appIdOrPkg);
  if (!app) return err('not_found', 'App not found', 404);
  const appId = str(app.id);
  const method = req.method.toUpperCase();

  if (action === 'reviews' && method === 'POST') {
    const body = (await readJson<Row>(req)) ?? {};
    const rating = num(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return err('bad_request', 'Rating must be a whole number between 1 and 5', 400);
    }
    const existing = await env.DB.prepare(
      'SELECT id FROM reviews WHERE app_id = ? AND (user_id = ? OR LOWER(username) = ?) LIMIT 1',
    )
      .bind(appId, user.id, user.username.toLowerCase())
      .first<Row>();

    let reviewId: string;
    if (existing?.id) {
      reviewId = str(existing.id);
      await env.DB.prepare('UPDATE reviews SET rating = ?, body = ?, username = ? WHERE id = ?')
        .bind(rating, str(body.body), user.username.toLowerCase(), reviewId)
        .run();
    } else {
      reviewId = `rev-${crypto.randomUUID()}`;
      await env.DB.prepare(
        `INSERT INTO reviews (id, app_id, user_id, username, rating, body, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          reviewId,
          appId,
          user.id,
          user.username.toLowerCase(),
          rating,
          str(body.body),
          new Date().toISOString(),
        )
        .run();
    }
    await recomputeAppRating(env.DB, appId);
    const saved = await env.DB.prepare('SELECT * FROM reviews WHERE id = ? LIMIT 1')
      .bind(reviewId)
      .first<Row>();
    return json({ review: saved ? mapReview(saved) : null });
  }

  if (action === 'reviews' && method === 'DELETE') {
    await env.DB.prepare(
      'DELETE FROM reviews WHERE app_id = ? AND (user_id = ? OR LOWER(username) = ?)',
    )
      .bind(appId, user.id, user.username.toLowerCase())
      .run();
    await recomputeAppRating(env.DB, appId);
    return json({ ok: true });
  }

  if (action === 'wishlist' && method === 'POST') {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO wishlists (user_id, app_id, created_at) VALUES (?, ?, ?)',
    )
      .bind(user.id, appId, new Date().toISOString())
      .run();
    return json({ ok: true, wishlisted: true });
  }

  if (action === 'wishlist' && method === 'DELETE') {
    await env.DB.prepare(
      'DELETE FROM wishlists WHERE (user_id = ? OR LOWER(user_id) = ?) AND app_id = ?',
    )
      .bind(user.id, user.username.toLowerCase(), appId)
      .run();
    return json({ ok: true, wishlisted: false });
  }

  if (action === 'report' && method === 'POST') {
    const body = (await readJson<Row>(req)) ?? {};
    const id = `rep-${crypto.randomUUID()}`;
    const reason = str(body.reason, 'Other').trim() || 'Other';
    const details = str(body.details).trim() || null;
    await env.DB.prepare(
      `INSERT INTO reports (
        id, app_id, reporter_user_id, reporter_username, reason, details, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
    )
      .bind(
        id,
        appId,
        user.id,
        user.username.toLowerCase(),
        reason,
        details,
        new Date().toISOString(),
      )
      .run();
    const row = await env.DB.prepare('SELECT * FROM reports WHERE id = ? LIMIT 1')
      .bind(id)
      .first<Row>();
    return json({ report: row ? mapReport(row, app) : null }, 201);
  }

  if (action === 'library' && method === 'POST') {
    const body = (await readJson<Row>(req)) ?? {};
    const versionCode = body.versionCode == null ? null : num(body.versionCode);
    await env.DB.prepare(
      `INSERT INTO library (user_id, app_id, first_downloaded_at, last_version_code)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, app_id) DO UPDATE SET last_version_code = COALESCE(excluded.last_version_code, library.last_version_code)`,
    )
      .bind(user.id, appId, new Date().toISOString(), versionCode)
      .run();
    return json({ ok: true });
  }

  return err('method_not_allowed', 'Method not allowed', 405);
}
