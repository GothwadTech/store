import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3, CheckCircle2, Download, LoaderCircle, MessageSquareText, Smartphone, Star, X,
} from 'lucide-react';
import { useApp } from '../lib/AppContext';
import { usePath } from '../lib/router';
import {
  Card, EmptyState, PageHeader, SignInPrompt, StatCard, btnGhost, btnPrimary,
} from '../shared/ui';
import { BackendNotice } from '../shared/BackendNotice';
import { formatCount } from '../lib/storage';
import { devApi } from '../lib/api';
import { ACCOUNTS_HOST } from '../lib/config';
import { CreateApp, Dashboard, Onboarding, Shell, hintCls, inputCls, labelCls } from './ConsoleShell';
import { AppDetail } from './ConsoleAppDetail';

function StatsPage() {
  const { apps, developer, demoModeAvailable, isDemoUser } = useApp();
  const mine = useMemo(() => apps.filter((app) => app.developerId === developer?.id), [apps, developer?.id]);
  const [statsByApp, setStatsByApp] = useState<Record<string, Awaited<ReturnType<typeof devApi.stats>>>>({});
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!mine.length) {
      setStatsByApp({});
      setStatsLoading(false);
      setStatsError('');
      return () => {
        cancelled = true;
      };
    }
    if (demoModeAvailable && isDemoUser) {
      const previews = mine.map((app) => {
        const baseline = Math.max(0, Math.round(Math.log10(app.downloadsCount + 1)));
        const days = Array.from({ length: 7 }, (_, index) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - index));
          const sampleFactor = 0.5 + ((index * 17 + app.id.length) % 10) / 10;
          return { date: date.toISOString().slice(0, 10), count: Math.round(baseline * sampleFactor) };
        });
        return [
          app.id,
          { days, totalDownloads: app.downloadsCount, ratingAvg: app.ratingAvg, ratingCount: app.ratingCount },
        ] as const;
      });
      setStatsByApp(Object.fromEntries(previews));
      setStatsLoading(false);
      setStatsError('');
      return () => {
        cancelled = true;
      };
    }
    setStatsLoading(true);
    setStatsError('');
    void Promise.all(mine.map(async (app) => [app.id, await devApi.stats(app.id, 7)] as const))
      .then((entries) => {
        if (!cancelled) setStatsByApp(Object.fromEntries(entries));
      })
      .catch((error: Error) => {
        if (!cancelled) setStatsError(error.message || 'Statistics could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mine, demoModeAvailable, isDemoUser]);

  const weekTotal = Object.values(statsByApp).reduce(
    (total, stats) => total + stats.days.reduce((sum, day) => sum + day.count, 0),
    0,
  );
  return (
    <main>
      <PageHeader
        title="Statistics"
        desc={
          demoModeAvailable && isDemoUser
            ? 'Illustrative demo activity only; these preview values are not recorded download events.'
            : 'Daily downloads recorded by the Store for the last 7 days.'
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <StatCard
          label="Downloads (7 days)"
          value={statsLoading || statsError ? '—' : formatCount(weekTotal)}
          sub="Across your apps"
          icon={Download}
        />
        <StatCard
          label="Published apps"
          value={String(mine.filter((app) => app.status === 'published').length)}
          sub="Currently live on the store"
          icon={Smartphone}
        />
        <StatCard
          label="Total downloads"
          value={formatCount(mine.reduce((total, app) => total + app.downloadsCount, 0))}
          sub="All time"
          icon={BarChart3}
        />
        <StatCard
          label="Total ratings"
          value={formatCount(mine.reduce((total, app) => total + app.ratingCount, 0))}
          sub="Across your apps"
          icon={Star}
        />
      </div>
      <div className="space-y-5">
        {statsLoading && (
          <Card>
            <p className="py-8 text-center text-sm text-neutral-400">Loading live download statistics…</p>
          </Card>
        )}
        {!statsLoading && statsError && (
          <Card>
            <div className="py-6 text-center">
              <p className="text-sm text-red-200">{statsError}</p>
              <button onClick={() => window.location.reload()} className={`${btnGhost} mt-4`}>
                <X size={14} /> Reload
              </button>
            </div>
          </Card>
        )}
        {!statsLoading &&
          !statsError &&
          mine.map((app) => {
            const days = statsByApp[app.id]?.days ?? [];
            const maxCount = Math.max(1, ...days.map((day) => day.count));
            return (
              <Card
                key={app.id}
                title={app.name}
                desc={`${formatCount(app.downloadsCount)} total downloads · ${app.ratingAvg.toFixed(1)} average rating (${formatCount(app.ratingCount)} ratings)`}
              >
                {days.some((day) => day.count > 0) ? (
                  <div className="flex h-36 items-end gap-2.5">
                    {days.map((day) => (
                      <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                        <span
                          className="w-full rounded-t-md bg-emerald-600/80 transition hover:bg-emerald-500"
                          style={{
                            height: day.count === 0 ? '0%' : `${Math.max(5, (day.count / maxCount) * 100)}%`,
                          }}
                          title={`${day.date}: ${formatCount(day.count)} downloads`}
                        />
                        <span className="text-[11px] text-neutral-500">
                          {new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-neutral-500">
                    No downloads were recorded in the last 7 days.
                  </p>
                )}
              </Card>
            );
          })}
        {!statsLoading && !statsError && !mine.length && (
          <Card>
            <p className="py-8 text-center text-sm text-neutral-500">
              Create your first app to see download statistics.
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}

function ReviewsPage() {
  const { apps, developer, reviews, replyReview } = useApp();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const mine = reviews.filter((r) => apps.some((a) => a.id === r.appId && a.developerId === developer?.id));
  return (
    <main>
      <PageHeader title="Reviews" desc="Reviews across all of your apps. Public replies build trust with users." />
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-400/25 bg-red-500/[0.08] px-3.5 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
      <div className="space-y-4">
        {mine.map((r) => {
          const a = apps.find((x) => x.id === r.appId);
          return (
            <section key={r.id} className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] px-5 py-4">
              <p className="text-xs text-neutral-500">
                {a?.name} · <span className="font-medium text-neutral-300">@{r.username}</span>
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-200">{r.body}</p>
              {!r.developerReply ? (
                <form
                  className="mt-3 flex flex-col gap-2 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setError('');
                    void replyReview(r.id, draft[r.id] ?? '')
                      .then(() => setDraft((current) => ({ ...current, [r.id]: '' })))
                      .catch((reason: Error) => setError(reason.message));
                  }}
                >
                  <input
                    value={draft[r.id] ?? ''}
                    onChange={(e) => setDraft({ ...draft, [r.id]: e.target.value })}
                    className={inputCls}
                    placeholder="Write a public reply…"
                  />
                  <button className={`${btnPrimary} shrink-0`}>Reply</button>
                </form>
              ) : (
                <p className="mt-2.5 text-[13px] text-neutral-400">
                  <b className="text-emerald-300">You: </b>
                  {r.developerReply}
                </p>
              )}
            </section>
          );
        })}
        {!mine.length && (
          <Card>
            <EmptyState
              icon={MessageSquareText}
              title="No reviews yet"
              desc="Reviews from users across all of your apps will appear here, and you can reply publicly."
            />
          </Card>
        )}
      </div>
    </main>
  );
}

function SettingsPage() {
  const { developer, registerDeveloper, user } = useApp();
  const [form, setForm] = useState({
    displayName: developer?.displayName ?? '',
    orgName: developer?.orgName ?? '',
    supportEmail: developer?.supportEmail ?? '',
    website: developer?.website ?? '',
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (!developer) return null;
  return (
    <main className="max-w-3xl">
      <PageHeader title="Developer profile" desc="Public publisher information shown on your listings." />
      <div className="space-y-5">
        <Card title="Profile">
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (saving) return;
              setSaving(true);
              setSaved(false);
              setError('');
              void registerDeveloper(form)
                .then(() => setSaved(true))
                .catch((reason: Error) => setError(reason.message))
                .finally(() => setSaving(false));
            }}
          >
            {error && (
              <p role="alert" className="rounded-lg border border-red-400/25 bg-red-500/[0.08] px-3.5 py-3 text-sm text-red-200">
                {error}
              </p>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Name</label>
                <input
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Organization name</label>
                <input
                  value={form.orgName}
                  onChange={(e) => setForm({ ...form, orgName: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Support email</label>
                <input
                  type="email"
                  value={form.supportEmail}
                  onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Website</label>
                <input
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] pt-4">
              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-300">
                  <CheckCircle2 size={15} /> Saved
                </span>
              )}
              <button disabled={saving} className={btnPrimary}>
                {saving ? (
                  <>
                    <LoaderCircle size={16} className="animate-spin" /> Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </button>
            </div>
          </form>
        </Card>
        <Card title="Gothwad Account" desc="Identity is managed by Gothwad Accounts, not here.">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-neutral-500">Username</dt>
              <dd className="mt-0.5 font-medium text-white">@{user?.username}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Email</dt>
              <dd className="mt-0.5 font-medium text-white">{user?.email}</dd>
            </div>
          </dl>
          <p className={hintCls}>To change your name, password, or security settings, visit {ACCOUNTS_HOST}.</p>
        </Card>
      </div>
    </main>
  );
}

function Callback() {
  const { setUser } = useApp();
  const [msg, setMsg] = useState('Returning from Gothwad Accounts…');
  useEffect(() => {
    void import('../lib/auth').then((m) =>
      m.handleOAuthCallback().then((r) => {
        if ('user' in r) {
          setUser(r.user);
          setMsg('Signed in! Opening your dashboard…');
          setTimeout(() => window.location.replace('/'), 600);
        } else {
          setMsg(`We could not sign you in (${r.error}).`);
        }
      }),
    );
  }, [setUser]);
  return <main className="mx-auto max-w-md px-4 py-24 text-center text-neutral-300">{msg}</main>;
}

export default function ConsoleApp() {
  const [path, navigate] = usePath();
  const {
    user, developer, apps, authReady, authStatus, authError, permissionsStatus,
    developerStatus, developerError, backendLive, demoModeAvailable, isDemoUser,
    retryAuth, retryDeveloper,
  } = useApp();
  if (path === '/auth/callback') {
    return <div className="min-h-dvh bg-[#212121] text-neutral-200"><Callback /></div>;
  }
  if (!authReady || authStatus === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#212121] text-neutral-400">
        Checking your Gothwad Account…
      </div>
    );
  }
  if (!user && authStatus === 'unavailable') {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#212121] px-4 text-neutral-200">
        <div className="w-full max-w-md rounded-3xl border border-amber-500/30 bg-[#262626] p-7 text-center">
          <h1 className="font-display text-lg font-bold text-white">Could not verify your Gothwad Account</h1>
          <p className="mt-2 text-sm text-neutral-300">
            {authError || 'The authentication service is temporarily unreachable. Please try again.'}
          </p>
          <button type="button" onClick={() => void retryAuth()} className={`${btnPrimary} mt-5 inline-flex`}>
            Retry verification
          </button>
        </div>
      </div>
    );
  }
  if (!user) return <div className="min-h-dvh bg-[#212121]"><SignInPrompt what="Developer Console" /></div>;
  if (!(demoModeAvailable && isDemoUser) && (developerStatus === 'loading' || permissionsStatus === 'loading')) {
    return (
      <Shell navigate={navigate} path={path}>
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#262626]/70 px-5 py-6 text-sm text-neutral-300">
          <LoaderCircle size={16} className="animate-spin text-emerald-400" />
          Loading your developer workspace…
        </div>
      </Shell>
    );
  }
  if (!(demoModeAvailable && isDemoUser) && (developerStatus === 'unavailable' || permissionsStatus === 'unavailable' || !backendLive)) {
    return (
      <Shell navigate={navigate} path={path}>
        <BackendNotice />
        <div className="mx-auto mt-5 flex max-w-xl flex-col items-center gap-3 text-center text-sm text-neutral-400">
          <p>{developerError || 'Developer tools are unavailable until the Store service is connected.'}</p>
          <button type="button" onClick={() => void retryDeveloper()} className={`${btnPrimary} inline-flex`}>
            Retry workspace
          </button>
        </div>
      </Shell>
    );
  }
  if ((!developer || developerStatus === 'none') && path !== '/onboarding') {
    return <Shell navigate={navigate} path={path}><Onboarding /></Shell>;
  }
  let page: React.ReactNode = <Dashboard navigate={navigate} />;
  if (path === '/onboarding') page = <Onboarding />;
  else if (path === '/apps/new') page = <CreateApp navigate={navigate} />;
  else if (path.startsWith('/apps/')) {
    const rest = path.slice(6);
    const [id, sub] = rest.split('/');
    const app = apps.find((a) => a.id === id && a.developerId === developer?.id);
    const tab = sub === 'releases' ? 'releases' : sub === 'reviews' ? 'reviews' : 'listing';
    page = app ? (
      <AppDetail app={app} navigate={navigate} tab={tab} />
    ) : (
      <main className="py-16 text-center text-neutral-400">
        This app was not found, or it does not belong to your developer profile.
      </main>
    );
  } else if (path === '/stats') page = <StatsPage />;
  else if (path === '/reviews') page = <ReviewsPage />;
  else if (path === '/settings') page = <SettingsPage />;
  return (
    <Shell navigate={navigate} path={path}>
      {page}
    </Shell>
  );
}
