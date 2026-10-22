import { isAdmin, verifyUser } from '../auth';
import { bundleApps, ensureSchema, findApp, hasD1 } from '../db';
import { err, json, readJson } from '../http';
import { mapDeveloper, mapRelease, mapReport, mapReview, mapSubmission, num, str } from '../mappers';
import type { AuthUser, D1Database, Env, Row } from '../types';

async function recordAudit(
  db: D1Database,
  actorUsername: string,
  action: string,
  targetType: string,
  targetId: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO store_audit_log (id, actor_username, action, target_type, target_id, detail_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      `aud-${crypto.randomUUID().slice(0, 12)}`,
      actorUsername.toLowerCase(),
      action,
      targetType,
      targetId,
      JSON.stringify(detail),
      new Date().toISOString(),
    )
    .run();
}

async function requireAdmin(
  req: Request,
  env: Env,
): Promise<{ user: AuthUser } | { error: Response }> {
  const user = await verifyUser(req, env);
  if (!user) return { error: err('unauthorized', 'Please sign in with Gothwad', 401) };
  if (!hasD1(env)) {
    return { error: err('d1_not_configured', 'The Store database is not configured yet', 503) };
  }
  if (!isAdmin(user, env)) {
    return { error: err('forbidden', 'Admin access required', 403) };
  }
  await ensureSchema(env.DB, env);
  return { user };
}

export async function handleAdminQueue(req: Request, env: Env): Promise<Response> {
  const guard = await requireAdmin(req, env);
  if ('error' in guard) return guard.error;
  const db = env.DB!;

  const { results: subs } = await db
    .prepare(`SELECT * FROM review_submissions WHERE status = 'pending' ORDER BY created_at ASC`)
    .all<Row>();
  const appIds = [...new Set(subs.map((s) => str(s.app_id)))];
  const relIds = [...new Set(subs.map((s) => str(s.release_id)))];

  const [appRows, relRows] = await Promise.all([
    appIds.length > 0
      ? db
          .prepare(`SELECT * FROM apps WHERE id IN (${appIds.map(() => '?').join(', ')})`)
          .bind(...appIds)
          .all<Row>()
          .then((r) => r.results)
      : Promise.resolve([] as Row[]),
    relIds.length > 0
      ? db
          .prepare(`SELECT * FROM app_releases WHERE id IN (${relIds.map(() => '?').join(', ')})`)
          .bind(...relIds)
          .all<Row>()
          .then((r) => r.results)
      : Promise.resolve([] as Row[]),
  ]);

  const bundle = await bundleApps(db, appRows);
  const relById = new Map(relRows.map((r) => [str(r.id), r]));
  const appRawById = new Map(appRows.map((a) => [str(a.id), a]));
  const devIds = [...new Set(appRows.map((a) => str(a.developer_id)).filter(Boolean))];
  const devs =
    devIds.length > 0
      ? (
          await db
            .prepare(`SELECT * FROM developers WHERE id IN (${devIds.map(() => '?').join(', ')})`)
            .bind(...devIds)
            .all<Row>()
        ).results
      : [];
  const devById = new Map(devs.map((d) => [str(d.id), d]));

  return json({
    submissions: subs.map((s) =>
      mapSubmission(
        s,
        appRawById.get(str(s.app_id)),
        relById.get(str(s.release_id)),
        devById.get(str(appRawById.get(str(s.app_id))?.developer_id)),
      ),
    ),
    apps: bundle.apps,
    releases: relRows.map(mapRelease),
  });
}

export async function handleAdminApps(req: Request, env: Env): Promise<Response> {
  const guard = await requireAdmin(req, env);
  if ('error' in guard) return guard.error;
  const db = env.DB!;

  const { results: rows } = await db
    .prepare('SELECT * FROM apps ORDER BY updated_at DESC LIMIT 200')
    .all<Row>();
  const bundle = await bundleApps(db, rows);
  const { results: subs } = await db
    .prepare('SELECT * FROM review_submissions ORDER BY created_at DESC LIMIT 50')
    .all<Row>();
  const relIds = [...new Set(subs.map((s) => str(s.release_id)))];
  const relRows =
    relIds.length > 0
      ? (
          await db
            .prepare(`SELECT * FROM app_releases WHERE id IN (${relIds.map(() => '?').join(', ')})`)
            .bind(...relIds)
            .all<Row>()
        ).results
      : [];
  const relById = new Map(relRows.map((r) => [str(r.id), r]));
  const appById = new Map(rows.map((a) => [str(a.id), a]));
  const devIds = [...new Set(rows.map((a) => str(a.developer_id)).filter(Boolean))];
  const devs =
    devIds.length > 0
      ? (
          await db
            .prepare(`SELECT * FROM developers WHERE id IN (${devIds.map(() => '?').join(', ')})`)
            .bind(...devIds)
            .all<Row>()
        ).results
      : [];
  const devById = new Map(devs.map((d) => [str(d.id), d]));

  return json({
    apps: bundle.apps,
    releases: bundle.releases,
    submissions: subs.map((s) =>
      mapSubmission(
        s,
        appById.get(str(s.app_id)),
        relById.get(str(s.release_id)),
        devById.get(str(appById.get(str(s.app_id))?.developer_id)),
      ),
    ),
  });
}

export async function handleAdminReports(req: Request, env: Env): Promise<Response> {
  const guard = await requireAdmin(req, env);
  if ('error' in guard) return guard.error;
  const db = env.DB!;

  const { results: rows } = await db
    .prepare('SELECT * FROM reports ORDER BY created_at DESC LIMIT 100')
    .all<Row>();
  const appIds = [...new Set(rows.map((r) => str(r.app_id)).filter(Boolean))];
  const appRows =
    appIds.length > 0
      ? (
          await db
            .prepare(`SELECT * FROM apps WHERE id IN (${appIds.map(() => '?').join(', ')})`)
            .bind(...appIds)
            .all<Row>()
        ).results
      : [];
  const appById = new Map(appRows.map((a) => [str(a.id), a]));
  return json({ reports: rows.map((r) => mapReport(r, appById.get(str(r.app_id)))) });
}

export async function handleAdminOverview(req: Request, env: Env): Promise<Response> {
  const guard = await requireAdmin(req, env);
  if ('error' in guard) return guard.error;
  const db = env.DB!;

  const [appsRes, devsRes, revsRes, repsRes, subsRes] = await Promise.all([
    db.prepare('SELECT * FROM apps ORDER BY updated_at DESC').all<Row>(),
    db.prepare('SELECT * FROM developers ORDER BY created_at DESC').all<Row>(),
    db.prepare('SELECT * FROM reviews ORDER BY created_at DESC LIMIT 100').all<Row>(),
    db.prepare('SELECT * FROM reports ORDER BY created_at DESC LIMIT 100').all<Row>(),
    db.prepare('SELECT * FROM review_submissions ORDER BY created_at DESC LIMIT 100').all<Row>(),
  ]);

  const bundle = await bundleApps(db, appsRes.results);
  const appMap = new Map(appsRes.results.map((a) => [str(a.id), a]));
  return json({
    apps: bundle.apps,
    developers: devsRes.results.map(mapDeveloper),
    reviews: revsRes.results.map(mapReview),
    reports: repsRes.results.map((r) => mapReport(r, appMap.get(str(r.app_id)))),
    submissions: subsRes.results.map((s) => mapSubmission(s, appMap.get(str(s.app_id)))),
    stats: {
      appsCount: appsRes.results.length,
      publishedCount: appsRes.results.filter((a) => a.status === 'published').length,
      pendingCount: subsRes.results.filter((s) => s.status === 'pending').length,
      developersCount: devsRes.results.length,
      openReportsCount: repsRes.results.filter((r) => r.status === 'open').length,
      totalDownloads: appsRes.results.reduce((s, a) => s + num(a.downloads_count), 0),
    },
    configured: true,
  });
}

export async function handleAdminDecideSubmission(
  req: Request,
  env: Env,
  id: string,
  decision: 'approve' | 'reject',
): Promise<Response> {
  const guard = await requireAdmin(req, env);
  if ('error' in guard) return guard.error;
  const db = env.DB!;
  const body = (await readJson<Row>(req)) ?? {};
  const note = str(body.note ?? body.reason).trim();
  const approve = decision === 'approve';
  if (!approve && !note) {
    return err('note_required', 'A reviewer note is required to reject a submission', 400);
  }

  let sub = await db
    .prepare('SELECT * FROM review_submissions WHERE id = ? LIMIT 1')
    .bind(id)
    .first<Row>();

  // Also support passing releaseId directly (/api/admin/releases/:id/approve)
  let releaseId: string;
  let appId: string;
  if (sub) {
    if (str(sub.status) !== 'pending') {
      return err('already_decided', 'This submission has already been decided', 409);
    }
    appId = str(sub.app_id);
    releaseId = str(sub.release_id);
  } else {
    const rel = await db
      .prepare('SELECT * FROM app_releases WHERE id = ? LIMIT 1')
      .bind(id)
      .first<Row>();
    if (!rel) return err('not_found', 'Submission not found', 404);
    releaseId = str(rel.id);
    appId = str(rel.app_id);
    sub = await db
      .prepare('SELECT * FROM review_submissions WHERE release_id = ? LIMIT 1')
      .bind(releaseId)
      .first<Row>();
  }

  const nowIso = new Date().toISOString();
  if (approve) {
    await db.batch([
      db
        .prepare('UPDATE app_releases SET is_live = 0 WHERE app_id = ? AND id != ?')
        .bind(appId, releaseId),
      db
        .prepare(
          `UPDATE app_releases
           SET review_status = 'approved', review_note = ?, is_live = 1
           WHERE id = ?`,
        )
        .bind(note || null, releaseId),
      db
        .prepare(`UPDATE apps SET status = 'published', updated_at = ? WHERE id = ?`)
        .bind(nowIso, appId),
    ]);
  } else {
    await db
      .prepare(
        `UPDATE app_releases
         SET review_status = 'rejected', review_note = ?, is_live = 0
         WHERE id = ?`,
      )
      .bind(note, releaseId)
      .run();
    const live = await db
      .prepare('SELECT id FROM app_releases WHERE app_id = ? AND is_live = 1 LIMIT 1')
      .bind(appId)
      .first<Row>();
    await db
      .prepare('UPDATE apps SET status = ?, updated_at = ? WHERE id = ?')
      .bind(live ? 'published' : 'draft', nowIso, appId)
      .run();
  }

  if (sub?.id) {
    await db
      .prepare(
        `UPDATE review_submissions
         SET status = ?, note = ?, admin_username = ?, decided_at = ?
         WHERE id = ?`,
      )
      .bind(
        approve ? 'approved' : 'rejected',
        note || null,
        guard.user.username.toLowerCase(),
        nowIso,
        str(sub.id),
      )
      .run();
    await recordAudit(
      db,
      guard.user.username,
      approve ? 'submission.approve' : 'submission.reject',
      'submission',
      str(sub.id),
      { appId, releaseId, note: note || null },
    );
    const [updatedSub, appRow, relRow] = await Promise.all([
      db.prepare('SELECT * FROM review_submissions WHERE id = ? LIMIT 1').bind(str(sub.id)).first<Row>(),
      db.prepare('SELECT * FROM apps WHERE id = ? LIMIT 1').bind(appId).first<Row>(),
      db.prepare('SELECT * FROM app_releases WHERE id = ? LIMIT 1').bind(releaseId).first<Row>(),
    ]);
    return json({
      ok: true,
      submission: updatedSub ? mapSubmission(updatedSub, appRow, relRow) : null,
    });
  }

  await recordAudit(
    db,
    guard.user.username,
    approve ? 'submission.approve' : 'submission.reject',
    'release',
    releaseId,
    { appId, note: note || null },
  );
  return json({ ok: true });
}

export async function handleAdminAppAction(
  req: Request,
  env: Env,
  appIdOrPkg: string,
  action: 'suspend' | 'restore' | 'unsuspend' | 'feature' | 'patch',
): Promise<Response> {
  const guard = await requireAdmin(req, env);
  if ('error' in guard) return guard.error;
  const db = env.DB!;

  const app = await findApp(db, appIdOrPkg);
  if (!app) return err('not_found', 'App not found', 404);
  const appId = str(app.id);
  const now = new Date().toISOString();
  const body = (await readJson<Row>(req)) ?? {};

  if (action === 'suspend') {
    await db
      .prepare(`UPDATE apps SET status = 'suspended', updated_at = ? WHERE id = ?`)
      .bind(now, appId)
      .run();
  } else if (action === 'feature') {
    const featured = body.featured == null ? null : str(body.featured);
    if (featured !== null && !['hero', 'editors', 'top_new'].includes(featured)) {
      return err('bad_request', 'featured must be hero, editors, top_new, or null', 400);
    }
    await db
      .prepare('UPDATE apps SET featured = ?, updated_at = ? WHERE id = ?')
      .bind(featured, now, appId)
      .run();
  } else if (action === 'restore' || action === 'unsuspend') {
    const live = await db
      .prepare('SELECT id FROM app_releases WHERE app_id = ? AND is_live = 1 LIMIT 1')
      .bind(appId)
      .first<Row>();
    await db
      .prepare('UPDATE apps SET status = ?, updated_at = ? WHERE id = ?')
      .bind(live ? 'published' : 'draft', now, appId)
      .run();
  } else {
    const sets: string[] = ['updated_at = ?'];
    const params: unknown[] = [now];
    if ('status' in body && body.status !== undefined) {
      sets.push('status = ?');
      params.push(str(body.status));
    }
    if ('featured' in body) {
      const f =
        body.featured === true
          ? 'editors'
          : body.featured
            ? str(body.featured)
            : null;
      sets.push('featured = ?');
      params.push(f);
    }
    params.push(appId);
    await db.prepare(`UPDATE apps SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run();
  }

  await recordAudit(
    db,
    guard.user.username,
    `app.${action === 'unsuspend' ? 'restore' : action}`,
    'app',
    appId,
    body,
  );
  const updated = await db
    .prepare('SELECT * FROM apps WHERE id = ? LIMIT 1')
    .bind(appId)
    .first<Row>();
  const bundle = await bundleApps(db, [updated ?? app]);
  return json({ ok: true, app: bundle.apps[0] });
}

export async function handleAdminResolveReport(
  req: Request,
  env: Env,
  reportId: string,
): Promise<Response> {
  const guard = await requireAdmin(req, env);
  if ('error' in guard) return guard.error;
  const db = env.DB!;

  const body = (await readJson<Row>(req)) ?? {};
  const status = str(body.status, 'resolved');
  if (!['resolved', 'dismissed', 'open'].includes(status)) {
    return err('bad_request', 'Status must be resolved, dismissed, or open', 400);
  }
  const existing = await db
    .prepare('SELECT * FROM reports WHERE id = ? LIMIT 1')
    .bind(reportId)
    .first<Row>();
  if (!existing) return err('not_found', 'Report not found', 404);

  await db
    .prepare('UPDATE reports SET status = ? WHERE id = ?')
    .bind(status, reportId)
    .run();
  const updated = await db
    .prepare('SELECT * FROM reports WHERE id = ? LIMIT 1')
    .bind(reportId)
    .first<Row>();
  const appRow = await db
    .prepare('SELECT * FROM apps WHERE id = ? LIMIT 1')
    .bind(str(existing.app_id))
    .first<Row>();
  return json({ ok: true, report: updated ? mapReport(updated, appRow) : null });
}
