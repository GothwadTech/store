import { bundleApps, ensureSchema, findApp, hasD1 } from '../db';
import { err, json } from '../http';
import { mapCategory, str } from '../mappers';
import type { Env, Row } from '../types';

export async function handleStoreCategories(env: Env): Promise<Response> {
  if (!hasD1(env)) return json({ categories: [], source: 'unconfigured' });
  await ensureSchema(env.DB, env);
  const { results } = await env.DB.prepare('SELECT * FROM categories ORDER BY name ASC').all<Row>();
  return json({ categories: results.map(mapCategory), source: 'live' });
}

export async function handleStoreCatalog(url: URL, env: Env): Promise<Response> {
  if (!hasD1(env)) {
    return json({
      apps: [],
      releases: [],
      reviews: [],
      source: 'unconfigured',
      message: 'The Store database is not configured yet.',
    });
  }
  await ensureSchema(env.DB, env);

  const kind = url.searchParams.get('kind');
  const category = url.searchParams.get('category');
  const q = (url.searchParams.get('q') ?? '').replace(/[%*]/g, '').trim().toLowerCase();
  const featured = url.searchParams.get('featured');

  const where: string[] = [`status = 'published'`];
  const params: unknown[] = [];

  if (kind === 'app' || kind === 'game') {
    where.push('kind = ?');
    params.push(kind);
  }
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  if (featured) {
    if (featured === '1' || featured === 'true') {
      where.push('featured IS NOT NULL');
    } else {
      where.push('featured = ?');
      params.push(featured);
    }
  }
  if (q) {
    const like = `%${q}%`;
    where.push(
      '(LOWER(name) LIKE ? OR LOWER(short_desc) LIKE ? OR LOWER(package_name) LIKE ? OR LOWER(tags) LIKE ?)',
    );
    params.push(like, like, like, like);
  }

  const sql = `SELECT * FROM apps WHERE ${where.join(' AND ')} ORDER BY downloads_count DESC, rating_avg DESC LIMIT 100`;
  const { results } = await env.DB.prepare(sql).bind(...params).all<Row>();
  const bundle = await bundleApps(env.DB, results);
  return json({ ...bundle, source: 'live' });
}

export async function handleStoreAppDetail(idOrPkg: string, env: Env): Promise<Response> {
  if (!hasD1(env)) return err('unconfigured', 'The Store database is not configured', 503);
  await ensureSchema(env.DB, env);

  const app = await findApp(env.DB, idOrPkg);
  if (!app || str(app.status) !== 'published') return err('not_found', 'App not found', 404);

  const bundle = await bundleApps(env.DB, [app]);
  const live = bundle.releases[0] ?? null;
  return json({
    app: bundle.apps[0],
    screenshots: bundle.apps[0]?.screenshots ?? [],
    liveRelease: live,
    releases: bundle.releases,
    reviews: bundle.reviews,
  });
}
