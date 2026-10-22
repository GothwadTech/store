import {
  authHubOrigin,
  handleAuthAccounts,
  handleAuthExchange,
  handleAuthSignOut,
  handleAuthSwitch,
  handleMe,
} from './auth';
import { ensureSchema, hasD1 } from './db';
import { handleFdroidCatalogRoute, handleFdroidIcon } from './fdroid';
import { err, githubToken, json, noContent, withCorsAndCookies } from './http';
import {
  handleAdminAppAction,
  handleAdminApps,
  handleAdminDecideSubmission,
  handleAdminOverview,
  handleAdminQueue,
  handleAdminReports,
  handleAdminResolveReport,
} from './routes/admin';
import {
  handleDevAllReviews,
  handleDevAppDetail,
  handleDevAppSection,
  handleDevCreateApp,
  handleDevGetApps,
  handleDevRegister,
  handleDevReplyReview,
  handleDevStatusAction,
  handleDevSubmitRelease,
} from './routes/console';
import {
  handleApkDownload,
  handleApkInspect,
  handleApkUpload,
  handleGetImage,
  handleImageUpload,
} from './routes/media';
import {
  handleStoreAppDetail,
  handleStoreCatalog,
  handleStoreCategories,
} from './routes/store-public';
import {
  handleGetLibrary,
  handleGetWishlist,
  handleStoreAppAction,
} from './routes/store-user';
import type { Env, ExecutionContext } from './types';

export type { Env } from './types';
export const MAX_APK_SIZE = 50 * 1024 * 1024;

async function route(req: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();

  if (path === '/api/health' && method === 'GET') {
    const d1Ready = hasD1(env);
    if (d1Ready) await ensureSchema(env.DB, env);
    const ghReady = Boolean(githubToken(env));
    return json({
      service: 'store',
      ok: true,
      engine: 'cloudflare-d1',
      configured: {
        d1: d1Ready,
        images: d1Ready,
        github: ghReady,
        githubFiles: ghReady,
        auth: true,
        accounts: authHubOrigin(env),
      },
    });
  }

  // ── Auth & Multi-Account Session ─────────────────────────────────
  if (path === '/api/me' && method === 'GET') return handleMe(req, env);
  if (path === '/api/auth/exchange' && method === 'POST') return handleAuthExchange(req, env);
  if (path === '/api/auth/signout' && method === 'POST') return handleAuthSignOut(req, env);
  if (path === '/api/auth/accounts' && method === 'GET') return handleAuthAccounts(req, env);
  if (path === '/api/auth/switch' && method === 'POST') return handleAuthSwitch(req, env);
  const slotSignOut = path.match(/^\/api\/auth\/accounts\/([^/]+)\/signout$/);
  if (slotSignOut && method === 'POST') {
    return handleAuthSignOut(req, env, decodeURIComponent(slotSignOut[1]));
  }

  // ── Media (D1 Images + Edge Cache + GitHub APK Releases) ─────────
  if (path === '/api/uploads/image' && method === 'POST') return handleImageUpload(req, env);
  const imgMatch = path.match(/^\/api\/images\/([^/]+)$/);
  if (imgMatch && (method === 'GET' || method === 'HEAD')) {
    return handleGetImage(req, env, decodeURIComponent(imgMatch[1]), ctx);
  }
  if (
    (path === '/api/uploads/apk-inspect' || path === '/api/uploads/apk/inspect') &&
    method === 'POST'
  ) {
    return handleApkInspect(req, env);
  }
  if (path === '/api/uploads/apk' && method === 'POST') return handleApkUpload(req, env);
  const dlMatch = path.match(/^\/api\/download\/(.+)$/);
  if (dlMatch && method === 'GET') {
    return handleApkDownload(req, env, decodeURIComponent(dlMatch[1]));
  }

  // ── Public Store Catalog (Kiwi Store D1 + F-Droid Open Source) ───
  if (path === '/api/store/categories' && method === 'GET') return handleStoreCategories(env);
  if (path === '/api/store/fdroid' && method === 'GET') {
    return handleFdroidCatalogRoute(req, env, url);
  }
  const fdroidIconMatch = path.match(/^\/api\/store\/fdroid\/icon\/([^/]+)$/);
  if (fdroidIconMatch && method === 'GET') {
    return handleFdroidIcon(req, env, decodeURIComponent(fdroidIconMatch[1]));
  }
  const fdroidDetailMatch = path.match(/^\/api\/store\/fdroid\/([^/]+)$/);
  if (fdroidDetailMatch && method === 'GET') {
    return handleStoreAppDetail(`fdroid:${decodeURIComponent(fdroidDetailMatch[1])}`, env, req);
  }
  if (
    (path === '/api/store/apps' ||
      path === '/api/store/home' ||
      path === '/api/store/search' ||
      path === '/api/store/charts') &&
    method === 'GET'
  ) {
    return handleStoreCatalog(url, env, req);
  }
  if (path === '/api/store/library' && method === 'GET') return handleGetLibrary(req, env);
  if (path === '/api/store/wishlist' && method === 'GET') return handleGetWishlist(req, env);

  const storeAction = path.match(
    /^\/api\/store\/apps\/([^/]+)\/(reviews|wishlist|report|library)$/,
  );
  if (storeAction && method !== 'GET') {
    return handleStoreAppAction(
      req,
      env,
      decodeURIComponent(storeAction[1]),
      storeAction[2] as 'reviews' | 'wishlist' | 'report' | 'library',
    );
  }

  const appDetail = path.match(/^\/api\/store\/apps\/(.+)$/);
  if (appDetail && method === 'GET') {
    return handleStoreAppDetail(decodeURIComponent(appDetail[1]), env, req);
  }

  // ── Developer Console (/api/dev/* and /api/console/* aliases) ────
  if ((path === '/api/dev/register' || path === '/api/console/developer') && method === 'POST') {
    return handleDevRegister(req, env);
  }
  if ((path === '/api/dev/apps' || path === '/api/console/apps') && method === 'GET') {
    return handleDevGetApps(req, env);
  }
  if ((path === '/api/dev/apps' || path === '/api/console/apps') && method === 'POST') {
    return handleDevCreateApp(req, env);
  }
  if (path === '/api/dev/reviews' && method === 'GET') {
    return handleDevAllReviews(req, env);
  }

  const devReply = path.match(/^\/api\/dev\/apps\/([^/]+)\/reviews\/([^/]+)\/reply$/);
  if (devReply && method === 'POST') {
    return handleDevReplyReview(
      req,
      env,
      decodeURIComponent(devReply[1]),
      decodeURIComponent(devReply[2]),
    );
  }
  const consoleReply = path.match(/^\/api\/console\/reviews\/([^/]+)\/reply$/);
  if (consoleReply && method === 'POST') {
    return handleDevReplyReview(req, env, null, decodeURIComponent(consoleReply[1]));
  }

  const devSubmit = path.match(/^\/api\/dev\/apps\/([^/]+)\/releases\/([^/]+)\/submit$/);
  if (devSubmit && method === 'POST') {
    return handleDevSubmitRelease(
      req,
      env,
      decodeURIComponent(devSubmit[1]),
      decodeURIComponent(devSubmit[2]),
    );
  }

  const devAppSection = path.match(
    /^\/api\/(?:dev|console)\/apps\/([^/]+)\/(releases|reviews|stats)$/,
  );
  if (devAppSection) {
    return handleDevAppSection(
      req,
      env,
      decodeURIComponent(devAppSection[1]),
      devAppSection[2] as 'releases' | 'reviews' | 'stats',
    );
  }

  const devStatus = path.match(/^\/api\/dev\/apps\/([^/]+)\/(delist|relist)$/);
  if (devStatus && method === 'POST') {
    return handleDevStatusAction(
      req,
      env,
      decodeURIComponent(devStatus[1]),
      devStatus[2] as 'delist' | 'relist',
    );
  }

  const devApp = path.match(/^\/api\/(?:dev|console)\/apps\/([^/]+)$/);
  if (devApp) {
    return handleDevAppDetail(req, env, decodeURIComponent(devApp[1]));
  }

  // ── Admin Panel ──────────────────────────────────────────────────
  if (path === '/api/admin/queue' && method === 'GET') return handleAdminQueue(req, env);
  if (path === '/api/admin/apps' && method === 'GET') return handleAdminApps(req, env);
  if (path === '/api/admin/reports' && method === 'GET') return handleAdminReports(req, env);
  if (path === '/api/admin/overview' && method === 'GET') return handleAdminOverview(req, env);

  const adminDecide = path.match(
    /^\/api\/admin\/(?:submissions|releases)\/([^/]+)\/(approve|reject)$/,
  );
  if (adminDecide && method === 'POST') {
    return handleAdminDecideSubmission(
      req,
      env,
      decodeURIComponent(adminDecide[1]),
      adminDecide[2] as 'approve' | 'reject',
    );
  }

  const adminAppAction = path.match(
    /^\/api\/admin\/apps\/([^/]+)\/(suspend|restore|unsuspend|feature)$/,
  );
  if (adminAppAction && method === 'POST') {
    return handleAdminAppAction(
      req,
      env,
      decodeURIComponent(adminAppAction[1]),
      adminAppAction[2] as 'suspend' | 'restore' | 'unsuspend' | 'feature',
    );
  }
  const adminAppPatch = path.match(/^\/api\/admin\/apps\/([^/]+)$/);
  if (adminAppPatch && method === 'PATCH') {
    return handleAdminAppAction(req, env, decodeURIComponent(adminAppPatch[1]), 'patch');
  }

  const adminReport = path.match(/^\/api\/admin\/reports\/([^/]+)(?:\/resolve)?$/);
  if (adminReport && (method === 'POST' || method === 'PATCH')) {
    return handleAdminResolveReport(req, env, decodeURIComponent(adminReport[1]));
  }

  return err('not_found', 'Route not found', 404);
}

export default {
  async fetch(req: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    if (req.method === 'OPTIONS') return noContent(req, env);
    try {
      const res = await route(req, env, ctx);
      return withCorsAndCookies(req, env, res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Internal server error';
      return withCorsAndCookies(req, env, err('server_error', msg, 500));
    }
  },
};
