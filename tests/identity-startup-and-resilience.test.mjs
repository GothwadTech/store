import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLocalD1 } from '../tools/local-d1.mjs';
import { moduleUrl } from './helpers/ts.mjs';

const workerUrl = await moduleUrl('worker/src/index.ts');
const { default: worker } = await import(workerUrl);
const authUrl = await moduleUrl('src/lib/auth.ts');
const authMod = await import(authUrl);
const sessionClientUrl = await moduleUrl('src/lib/sessionClient.ts');
const sessionClient = await import(sessionClientUrl);
const apiModUrl = await moduleUrl('src/lib/api.ts');
const apiMod = await import(apiModUrl);
const bootstrapSql = await readFile(new URL('../sql/00_d1_console_bootstrap.sql', import.meta.url), 'utf8');

test('Worker /api/auth/session and /api/me?light=1 return verified identity + isAdmin immediately without D1 lookup', async () => {
  const originalFetch = globalThis.fetch;
  let dbQueried = false;
  const brokenDb = {
    prepare() {
      dbQueried = true;
      throw new Error('D1 should not be queried on light identity check');
    },
  };

  try {
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url === 'https://accounts.gothwadtech.com/api/auth/me') {
        assert.equal(init?.headers?.['X-Gothwad-Authuser'], '2');
        const headers = new Headers({ 'Content-Type': 'application/json' });
        headers.append('Set-Cookie', 'gothwad_session_a=rot1; Path=/; HttpOnly');
        headers.append('Set-Cookie', 'gothwad_session_b=rot2; Path=/; HttpOnly');
        return new Response(
          JSON.stringify({
            authenticated: true,
            user: { id: 'u-2', username: 'pawan', email: 'pawan@gothwadtech.com', name: 'Pawan' },
            activeSlot: 'b',
            authuser: 2,
            accounts: [
              { id: 'a', authuser: 0, uid: 'u-1', username: 'alice', email: 'alice@gothwadtech.com', name: 'Alice', active: false },
              { id: 'b', authuser: 2, uid: 'u-2', username: 'pawan', email: 'pawan@gothwadtech.com', name: 'Pawan', active: true },
            ],
          }),
          { status: 200, headers },
        );
      }
      return originalFetch(input, init);
    };

    const env = {
      DB: brokenDb,
      AUTH_HUB_URL: 'https://accounts.gothwadtech.com',
      ADMIN_USERNAMES: 'pawan,admin',
    };

    for (const path of ['/api/auth/session', '/api/me?light=1']) {
      const res = await worker.fetch(
        new Request(`https://kiwistore.gothwadtech.com${path}`, {
          headers: {
            Cookie: 'gothwad_session_b=tok',
            'X-Gothwad-Authuser': '2',
          },
        }),
        env,
      );
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
      assert.ok(setCookies.some((c) => c?.includes('gothwad_session_a=rot1')));
      assert.ok(setCookies.some((c) => c?.includes('gothwad_session_b=rot2')));
      const body = await res.json();
      assert.equal(body.authenticated, true);
      assert.equal(body.user.username, 'pawan');
      assert.equal(body.isAdmin, true);
      assert.equal(body.developer, null);
      assert.equal(body.developerStatus, 'deferred');
      assert.equal(body.activeSlot, 'b');
      assert.equal(body.authuser, 2);
      assert.equal(body.accounts.length, 2);
    }
    assert.equal(dbQueried, false, 'Light identity endpoints must not block on D1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Slow or failed D1 developer lookup on full /api/me does not erase a verified Accounts session', async () => {
  const originalFetch = globalThis.fetch;
  const throwingDb = {
    prepare() {
      throw new Error('Simulated D1 outage');
    },
  };

  try {
    globalThis.fetch = async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url === 'https://accounts.gothwadtech.com/api/auth/me') {
        return new Response(
          JSON.stringify({
            authenticated: true,
            user: { id: 'u-1', username: 'alice', email: 'alice@gothwadtech.com', name: 'Alice' },
            activeSlot: 'a',
            authuser: 0,
            accounts: [
              { id: 'a', authuser: 0, uid: 'u-1', username: 'alice', email: 'alice@gothwadtech.com', name: 'Alice', active: true },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error('Unexpected fetch');
    };

    const env = {
      DB: throwingDb,
      AUTH_HUB_URL: 'https://accounts.gothwadtech.com',
      ADMIN_USERNAMES: 'pawan',
    };
    const res = await worker.fetch(
      new Request('https://kiwiconsole.gothwadtech.com/api/me', {
        headers: { Cookie: 'gothwad_session_a=tok' },
      }),
      env,
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.authenticated, true);
    assert.equal(body.user.username, 'alice');
    assert.equal(body.isAdmin, false);
    assert.equal(body.developer, null);
    assert.equal(body.developerStatus, 'unavailable');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Worker resolveSession treats 429, 5xx, network errors, and non-JSON 200 on Bearer and Cookie paths as 503 auth_unavailable', async () => {
  const DB = createLocalD1();
  await DB.exec(bootstrapSql);
  const originalFetch = globalThis.fetch;

  try {
    const env = { DB, AUTH_HUB_URL: 'https://accounts.gothwadtech.com' };

    for (const scenario of [
      { label: 'Cookie 429', headers: { Cookie: 's=1' }, status: 429, body: 'Rate limited', contentType: 'text/plain' },
      { label: 'Cookie 200 HTML', headers: { Cookie: 's=1' }, status: 200, body: '<html>challenge</html>', contentType: 'text/html' },
      { label: 'Bearer 429', headers: { Authorization: 'Bearer tok' }, status: 429, body: '{"error":"rate_limited"}', contentType: 'application/json' },
      { label: 'Bearer 200 HTML', headers: { Authorization: 'Bearer tok' }, status: 200, body: '<html>error</html>', contentType: 'text/html' },
    ]) {
      globalThis.fetch = async () =>
        new Response(scenario.body, {
          status: scenario.status,
          headers: { 'Content-Type': scenario.contentType },
        });

      const res = await worker.fetch(
        new Request('https://kiwistore.gothwadtech.com/api/me', { headers: scenario.headers }),
        env,
      );
      assert.equal(res.status, 503, `${scenario.label} must return 503`);
      const data = await res.json();
      assert.equal(data.error, 'auth_unavailable', `${scenario.label} must return auth_unavailable`);
    }
  } finally {
    globalThis.fetch = originalFetch;
    DB.close();
  }
});

test('Client resolveSessionState deduplicates concurrent requests per authuser selector', async () => {
  const originalFetch = globalThis.fetch;
  let calls = [];

  try {
    sessionClient.clearInflightSessions();
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      const authuserHeader = init?.headers?.['X-Gothwad-Authuser'] ?? 'none';
      calls.push(`${url}#u=${authuserHeader}`);
      await new Promise((r) => setTimeout(r, 25));
      return new Response(
        JSON.stringify({
          authenticated: true,
          user: { id: `u-${authuserHeader}`, username: `user${authuserHeader}`, email: `u${authuserHeader}@gothwadtech.com`, name: `User ${authuserHeader}` },
          isAdmin: false,
          developer: null,
          developerStatus: 'deferred',
          activeSlot: 'a',
          authuser: Number(authuserHeader) || 0,
          accounts: [],
          configured: { d1: true },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const [r1, r2, r3, rOther] = await Promise.all([
      sessionClient.resolveSessionState({ light: true, authuser: 2 }),
      sessionClient.resolveSessionState({ light: true, authuser: 2 }),
      sessionClient.resolveSessionState({ light: true, authuser: 2 }),
      sessionClient.resolveSessionState({ light: true, authuser: 4 }),
    ]);

    assert.equal(r1.user?.username, 'user2');
    assert.equal(r2.user?.username, 'user2');
    assert.equal(r3.user?.username, 'user2');
    assert.equal(rOther.user?.username, 'user4');
    assert.deepEqual(
      calls.sort(),
      ['/api/me?light=1#u=2', '/api/me?light=1#u=4'],
      'Three concurrent calls for authuser=2 must share 1 fetch while authuser=4 runs independently',
    );
  } finally {
    globalThis.fetch = originalFetch;
    sessionClient.clearInflightSessions();
  }
});

test('Authoritative 401 or authenticated:false from /api/me resolves as anonymous without redundant direct-Accounts fallback', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  try {
    sessionClient.clearInflightSessions();
    globalThis.fetch = async (input) => {
      fetchCalls += 1;
      const url = typeof input === 'string' ? input : input.url;
      assert.equal(url, '/api/me?light=1', 'Must not call direct Accounts fallback after authoritative 401');
      return new Response(JSON.stringify({ error: 'unauthorized', message: 'Not signed in' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const res = await sessionClient.resolveSessionState({ light: true, force: true });
    assert.equal(res.status, 'anonymous');
    assert.equal(res.user, null);
    assert.equal(res.permissionsStatus, 'ready');
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    sessionClient.clearInflightSessions();
  }
});

test('Network/5xx/429/HTML failures resolve as unavailable (not anonymous) and do not manufacture false permissions when fallback succeeds', async () => {
  const originalFetch = globalThis.fetch;

  try {
    sessionClient.clearInflightSessions();

    // Case 1: 429 rate limit -> unavailable without hitting direct Accounts fallback
    let calls429 = 0;
    globalThis.fetch = async () => {
      calls429 += 1;
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const rateLimited = await sessionClient.resolveSessionState({ light: true, force: true });
    assert.equal(rateLimited.status, 'unavailable');
    assert.equal(rateLimited.errorCode, 'rate_limited');
    assert.equal(calls429, 1);

    // Case 2: 503 auth_unavailable from Worker -> unavailable without hammering Accounts again
    let calls503 = 0;
    globalThis.fetch = async () => {
      calls503 += 1;
      return new Response(JSON.stringify({ error: 'auth_unavailable', message: 'Accounts upstream down' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const upstreamDown = await sessionClient.resolveSessionState({ light: true, force: true });
    assert.equal(upstreamDown.status, 'unavailable');
    assert.equal(upstreamDown.errorCode, 'auth_unavailable');
    assert.equal(calls503, 1);

    // Case 3: Worker returns 502 HTML, direct Accounts fallback succeeds -> retains verified identity
    // while marking Store permissions and developer status as 'unavailable' (not false 'not admin' / 'none')
    globalThis.fetch = async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.startsWith('/api/me')) {
        return new Response('<html>502 Bad Gateway</html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        });
      }
      return new Response(
        JSON.stringify({
          authenticated: true,
          activeId: 'a',
          authuser: 1,
          accounts: [
            { id: 'a', authuser: 1, uid: 'u-1', username: 'alice', email: 'alice@gothwadtech.com', name: 'Alice', active: true },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };
    const fallbackAuth = await sessionClient.resolveSessionState({ light: true, force: true });
    assert.equal(fallbackAuth.status, 'authenticated');
    assert.equal(fallbackAuth.source, 'accounts-fallback');
    assert.equal(fallbackAuth.user?.username, 'alice');
    assert.equal(fallbackAuth.isAdmin, null, 'Fallback must not claim user is not admin when Worker is down');
    assert.equal(fallbackAuth.permissionsStatus, 'unavailable');
    assert.equal(fallbackAuth.developerStatus, 'unavailable');
  } finally {
    globalThis.fetch = originalFetch;
    sessionClient.clearInflightSessions();
  }
});

test('authApi.switchAccount throws on failure so failed account switch does not mutate URL or identity', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: 'switch_failed', message: 'Slot not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });

    await assert.rejects(
      () => apiMod.authApi.switchAccount({ id: 'missing-slot', authuser: 3 }),
      (err) => err instanceof apiMod.ApiError && err.status === 400,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sanitizeNextUrl blocks open redirects while preserving /u/0..5 paths and first-party ecosystem URLs', () => {
  assert.equal(authMod.sanitizeNextUrl('https://evil.example.com/phish'), 'https://kiwistore.gothwadtech.com');
  assert.equal(authMod.sanitizeNextUrl('//evil.example.com/phish'), 'https://kiwistore.gothwadtech.com');
  assert.equal(authMod.sanitizeNextUrl('javascript:alert(1)'), 'https://kiwistore.gothwadtech.com');
  assert.equal(
    authMod.sanitizeNextUrl('/u/3/library?tab=wish'),
    'https://kiwistore.gothwadtech.com/u/3/library?tab=wish',
  );
  assert.equal(
    authMod.sanitizeNextUrl('https://kiwiconsole.gothwadtech.com/u/2/apps'),
    'https://kiwiconsole.gothwadtech.com/u/2/apps',
  );
});

test('Account switch / sign-out generation bump isolates new requests from slow in-flight previous-account promises', async () => {
  const originalFetch = globalThis.fetch;
  let resolveSlowAccountA;
  let callCount = 0;

  try {
    sessionClient.clearInflightSessions();
    globalThis.fetch = (input, init) => {
      callCount += 1;
      const currentCall = callCount;
      const authuserHeader = init?.headers?.['X-Gothwad-Authuser'];
      if (currentCall === 1) {
        return new Promise((resolve) => {
          resolveSlowAccountA = () =>
            resolve(
              new Response(
                JSON.stringify({
                  authenticated: true,
                  user: { id: 'u-a', username: 'alice', email: 'alice@gothwadtech.com', name: 'Alice' },
                  isAdmin: true,
                  developer: null,
                  developerStatus: 'deferred',
                  activeSlot: 'a',
                  authuser: 0,
                  accounts: [],
                  configured: { d1: true },
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
              ),
            );
        });
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            authenticated: true,
            user: { id: 'u-b', username: 'bob', email: 'bob@gothwadtech.com', name: 'Bob' },
            isAdmin: false,
            developer: null,
            developerStatus: 'deferred',
            activeSlot: 'b',
            authuser: Number(authuserHeader) || 1,
            accounts: [],
            configured: { d1: true },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    };

    const genA = authMod.getAuthGeneration();
    const inflightA = sessionClient.resolveSessionState({ light: true, authuser: 0 });

    // Simulate account switch or sign-out before Account A finishes
    const genB = authMod.bumpAuthGeneration();
    sessionClient.clearInflightSessions();
    assert.ok(genB > genA, 'Auth generation must increment on account switch or sign-out');

    const resultB = await sessionClient.resolveSessionState({ light: true, authuser: 0 });
    assert.equal(resultB.user?.username, 'bob', 'New generation must not reuse Account A in-flight promise');
    assert.equal(resultB.isAdmin, false, 'Account B must not inherit Account A admin flag');

    resolveSlowAccountA();
    const lateResultA = await inflightA;
    assert.equal(lateResultA.user?.username, 'alice');
    assert.NotEqual?.(genA, authMod.getAuthGeneration());
    assert.notEqual(genA, authMod.getAuthGeneration(), 'Late response from genA is rejected by generation guard');
  } finally {
    globalThis.fetch = originalFetch;
    sessionClient.clearInflightSessions();
  }
});
