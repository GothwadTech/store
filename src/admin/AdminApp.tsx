import { useState } from 'react';
import {
  Ban, Check, ChevronRight, Flag, Inbox, LayoutDashboard, ListChecks, LogOut, Menu, Package,
  ShieldCheck, Star, X,
} from 'lucide-react';
import { useApp } from '../lib/AppContext';
import { usePath } from '../lib/router';
import {
  AccountMenu, AppIcon, AuthCallbackView, Button, Card, EmptyState, Logo, PageHeader, Pill, Sheet,
  SignInPrompt, StatCard, StatusBadge, Tabs, cx, useToast,
} from '../shared/ui';
import { BackendNotice } from '../shared/BackendNotice';
import { apkProviderLabel, formatBytes, formatCount } from '../lib/storage';
import { APP_NAME, ECOSYSTEM_NAME, SITE_HOSTS } from '../lib/config';

type Tab = 'queue' | 'apps' | 'reports';

function Gate({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, authReady, backendLive, demoModeAvailable, isDemoUser, signOut } = useApp();
  if (!authReady) return <div className="grid min-h-dvh place-items-center bg-[#212121] text-neutral-400">Checking your Gothwad Account…</div>;
  if (!user) return <div className="min-h-dvh bg-[#212121]"><SignInPrompt what="Store Admin" /></div>;
  if (!isAdmin)
    return (
      <div className="grid min-h-dvh place-items-center bg-[#212121] px-4 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-500/12 text-red-300"><ShieldCheck size={30} /></span>
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-white">Admin access required</h1>
          <p className="mx-auto mt-2 text-sm leading-relaxed text-neutral-400">
            @{user.username} is not listed in ADMIN_USERNAMES. This panel is restricted to {APP_NAME} administrators.
          </p>
          <Button variant="secondary" size="sm" className="mt-6" onClick={signOut}><LogOut size={15} /> Sign out</Button>
        </div>
      </div>
    );
  if (!backendLive && !(demoModeAvailable && isDemoUser))
    return (
      <div className="min-h-dvh bg-[#212121] px-4 py-12 text-neutral-300">
        <div className="mx-auto max-w-3xl"><BackendNotice /></div>
        <p className="mx-auto mt-5 max-w-xl text-center text-sm text-neutral-400">Admin tools are unavailable until the Store service is connected.</p>
      </div>
    );
  return <>{children}</>;
}

function NavList({ tab, setTab, counts, onNavigate }: { tab: Tab; setTab: (t: Tab) => void; counts: Record<Tab, number>; onNavigate?: () => void }) {
  const items: [Tab, string, typeof ListChecks][] = [
    ['queue', 'Review queue', ListChecks],
    ['apps', 'All apps', LayoutDashboard],
    ['reports', 'User reports', Flag],
  ];
  return (
    <nav className="space-y-1 px-3 py-3 lg:py-4" aria-label="Admin sections">
      {items.map(([t, label, Icon]) => (
        <button key={t} onClick={() => { setTab(t); onNavigate?.(); }} aria-current={tab === t ? 'page' : undefined}
          className={cx('flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition',
            tab === t ? 'bg-red-500/12 font-semibold text-red-200' : 'text-neutral-300 hover:bg-white/[0.05] hover:text-white')}>
          <Icon size={17} className={tab === t ? 'text-red-300' : 'text-neutral-500'} />
          <span className="flex-1 text-left">{label}</span>
          {counts[t] > 0 && (
            <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold', tab === t ? 'bg-red-500/20 text-red-200' : 'bg-white/[0.07] text-neutral-400')}>{counts[t]}</span>
          )}
        </button>
      ))}
    </nav>
  );
}

export default function AdminApp() {
  const { apps: rawApps, submissions, reports, decideSubmission, setAppStatus, resolveReport, user, signOut } = useApp();
  const apps = rawApps.filter((a) => !a.id.startsWith('fdroid:'));
  const [path, navigate] = usePath();
  const [tab, setTab] = useState<Tab>('queue');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [drawer, setDrawer] = useState(false);
  const { show, node: toastNode } = useToast();
  const pending = submissions.filter((s) => s.status === 'pending');
  const decided = submissions.filter((s) => s.status !== 'pending').slice(0, 8);
  const openReports = reports.filter((r) => r.status === 'open');
  const publishedCount = apps.filter((a) => a.status === 'published').length;
  const suspendedCount = apps.filter((a) => a.status === 'suspended').length;
  const counts: Record<Tab, number> = { queue: pending.length, apps: apps.length, reports: openReports.length };

  const fail = (err: Error) => show(err.message || 'That action could not be completed.', 'error');

  if (path === '/auth/callback') {
    return <div className="min-h-dvh bg-[#212121]"><AuthCallbackView onDone={() => navigate('/')} /></div>;
  }

  return (
    <Gate>
      <div className="min-h-dvh bg-[#212121] text-neutral-200 lg:flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-[268px] shrink-0 flex-col border-r border-white/[0.07] bg-[#1b1b1b] lg:flex">
          <div className="flex h-16 items-center border-b border-white/[0.06] px-5"><Logo subtitle="Store Admin" /></div>
          <div className="mx-3 mt-3 flex items-center gap-3 rounded-xl border border-red-400/20 bg-red-500/[0.07] px-3.5 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-500/15 text-red-200"><ShieldCheck size={17} /></span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-red-100">Administrator</span>
              <span className="block truncate text-xs text-red-200/60">@{user?.username}</span>
            </span>
          </div>
          <div className="flex-1 overflow-y-auto"><NavList tab={tab} setTab={setTab} counts={counts} /></div>
          <div className="border-t border-white/[0.06] p-4">
            <p className="rounded-xl bg-[#242424] p-3.5 text-xs leading-relaxed text-neutral-500">
              {SITE_HOSTS.admin}<br />Follow the review checklist for every submission. A note is required to reject.
            </p>
            <button onClick={signOut} className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-neutral-400 transition hover:text-white">
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </aside>

        {/* Mobile top bar + drawer */}
        <div className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.07] bg-[#1b1b1b]/95 px-4 backdrop-blur-xl lg:hidden">
          <button onClick={() => setDrawer(true)} className="rounded-lg p-2 text-neutral-300 transition hover:bg-white/5 hover:text-white" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <Logo subtitle="Store Admin" />
          <span className="ml-auto"><AccountMenu size={34} /></span>
        </div>
        <Sheet open={drawer} onClose={() => setDrawer(false)} title="Admin menu">
          <div className="px-3 pt-3">
            <p className="rounded-xl border border-red-400/20 bg-red-500/[0.07] px-3.5 py-3 text-xs text-red-200">
              Signed in as <b>@{user?.username}</b> · administrator
            </p>
          </div>
          <NavList tab={tab} setTab={setTab} counts={counts} onNavigate={() => setDrawer(false)} />
          <div className="border-t border-white/[0.06] p-4">
            <p className="text-xs text-neutral-500">{SITE_HOSTS.admin}</p>
            <button onClick={signOut} className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-neutral-400 hover:text-white">
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </Sheet>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <BackendNotice />

          <div className="mb-6 grid grid-cols-2 gap-3.5 xl:grid-cols-4">
            <StatCard label="In queue" value={String(pending.length)} sub="Waiting for review" icon={Inbox} tone={pending.length ? 'amber' : 'neutral'} />
            <StatCard label="Live apps" value={String(publishedCount)} sub="Published on the store" icon={Package} />
            <StatCard label="Suspended" value={String(suspendedCount)} sub="Removed from the store" icon={Ban} tone={suspendedCount ? 'red' : 'neutral'} />
            <StatCard label="Open reports" value={String(openReports.length)} sub="Flagged by users" icon={Flag} tone={openReports.length ? 'red' : 'neutral'} />
          </div>

          <Tabs
            className="mb-6"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'queue', label: 'Review queue', count: pending.length },
              { id: 'apps', label: 'All apps', count: apps.length },
              { id: 'reports', label: 'Reports', count: openReports.length },
            ]}
          />

          {tab === 'queue' && (
            <section className="fade-up">
              <PageHeader title="Review queue" desc="Confirm the name and icon are original, the description is accurate, dangerous permissions are justified, and the app actually launches. A reason is required to reject." />
              <div className="space-y-4">
                {pending.map((s) => {
                  const app = apps.find((a) => a.id === s.appId);
                  return (
                    <article key={s.id} className="rounded-2xl border border-amber-400/20 bg-[#262626]/85 p-5 shadow-xl shadow-black/20">
                      <div className="flex flex-wrap items-center gap-3.5">
                        {app && <AppIcon app={app} size={52} rounded="rounded-xl" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <b className="text-white">{s.appName}</b>
                            <Pill tone="amber">v{s.versionName} ({s.versionCode})</Pill>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-neutral-500">{s.packageName} · by {s.developerName}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-neutral-400">
                            <span>{apkProviderLabel(s.apkSizeBytes)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{formatBytes(s.apkSizeBytes)}</span>
                            <span aria-hidden="true">·</span>
                            <span>Submitted {new Date(s.submittedAt).toLocaleString('en-US')}</span>
                          </p>
                        </div>
                      </div>
                      <label className="mt-4 block">
                        <span className="mb-1.5 block text-[13px] font-medium text-neutral-300">Reviewer note</span>
                        <textarea value={notes[s.id] ?? ''} onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })} rows={2}
                          placeholder="Required to reject, optional to approve. The developer sees this text."
                          className="w-full rounded-lg border border-white/10 bg-[#1e1e1e] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-red-400/50 focus:ring-2 focus:ring-red-400/10" />
                      </label>
                      <div className="mt-3.5 flex flex-wrap gap-2.5">
                        <Button variant="primary" size="sm"
                          onClick={() => { void decideSubmission(s.id, true, notes[s.id] ?? '').then(() => show(`${s.appName} approved and published.`, 'success')).catch(fail); }}>
                          <Check size={16} /> Approve and publish
                        </Button>
                        <Button variant="danger" size="sm"
                          onClick={() => {
                            if (!(notes[s.id] ?? '').trim()) { show('Add a reviewer note before rejecting — the developer will see exactly that reason.', 'error'); return; }
                            void decideSubmission(s.id, false, notes[s.id]).then(() => show(`${s.appName} rejected with your note.`, 'success')).catch(fail);
                          }}>
                          <X size={16} /> Reject
                        </Button>
                      </div>
                    </article>
                  );
                })}
                {!pending.length && (
                  <Card><EmptyState icon={Inbox} title="The queue is empty" desc="Every submission has been decided. New submissions from developers appear here instantly." /></Card>
                )}
              </div>

              {decided.length > 0 && (
                <Card className="mt-8" title="Recent decisions" desc="The last 8 approve/reject actions on this panel.">
                  <div className="space-y-2.5">
                    {decided.map((s) => (
                      <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3 text-sm">
                        <Pill tone={s.status === 'approved' ? 'emerald' : 'red'}>{s.status}</Pill>
                        <b className="text-neutral-100">{s.appName}</b>
                        <span className="min-w-0 flex-1 truncate text-xs text-neutral-500">v{s.versionName} · {s.developerName}{s.note ? ` · “${s.note}”` : ''}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </section>
          )}

          {tab === 'apps' && (
            <section className="fade-up">
              <PageHeader title="All apps" desc={`${publishedCount} live · ${suspendedCount} suspended. Suspending removes an app from the store immediately.`} />
              <Card flush>
                {apps.length ? (
                  <div className="divide-y divide-white/[0.06]">
                    {apps.map((a) => (
                      <div key={a.id} className="flex flex-wrap items-center gap-3.5 px-4 py-4 transition hover:bg-white/[0.02] sm:px-5">
                        <AppIcon app={a} size={46} rounded="rounded-xl" />
                        <div className="min-w-0 flex-1">
                          <b className="line-clamp-1 text-sm text-white">{a.name}</b>
                          <span className="mt-0.5 block truncate text-xs text-neutral-500">{a.packageName}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                            <span>{a.developerName}</span>
                            <span aria-hidden="true">·</span>
                            <span>{formatCount(a.downloadsCount)} downloads</span>
                            <span aria-hidden="true">·</span>
                            <span className="flex items-center gap-1"><Star size={11} /> {a.ratingAvg.toFixed(1)}</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={a.status} />
                          {a.status === 'published' && (
                            <Button variant="danger" size="sm"
                              onClick={() => { void setAppStatus(a.id, 'suspended').then(() => show(`${a.name} suspended.`, 'success')).catch(fail); }}>
                              <Ban size={13} /> Suspend
                            </Button>
                          )}
                          {a.status === 'suspended' && (
                            <Button variant="primary" size="sm"
                              onClick={() => { void setAppStatus(a.id, 'published').then(() => show(`${a.name} is live again.`, 'success')).catch(fail); }}>
                              <Check size={13} /> Restore
                            </Button>
                          )}
                          <Pill>{a.featured ?? 'Not featured'}</Pill>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Package} title="No apps yet" desc="Apps appear here as soon as developers create their first listing." />
                )}
              </Card>
            </section>
          )}

          {tab === 'reports' && (
            <section className="fade-up">
              <PageHeader title="User reports" desc="Reports submitted from app pages. Resolve once action has been taken." />
              <div className="space-y-3">
                {reports.map((r) => (
                  <article key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#262626]/85 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-sm text-white">{r.appName}</b>
                        <span className="text-xs text-neutral-500">@{r.reporter} · {r.reason}</span>
                      </div>
                      {r.details && <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">“{r.details}”</p>}
                    </div>
                    <Pill tone={r.status === 'open' ? 'amber' : 'neutral'}>{r.status}</Pill>
                    {r.status === 'open' && (
                      <div className="flex gap-2">
                        <Button variant="primary" size="sm" onClick={() => { void resolveReport(r.id, 'resolved').then(() => show('Report marked as resolved.', 'success')).catch(fail); }}>
                          <Check size={14} /> Resolve
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => { void resolveReport(r.id, 'dismissed').then(() => show('Report dismissed.', 'info')).catch(fail); }}>
                          Dismiss <ChevronRight size={14} />
                        </Button>
                      </div>
                    )}
                  </article>
                ))}
                {!reports.length && <Card><EmptyState icon={Flag} title="No reports" desc="Users can report an app from its store page. Nothing has been reported yet." /></Card>}
              </div>
            </section>
          )}

          <footer className="mt-10 border-t border-white/[0.06] pt-5 text-xs leading-relaxed text-neutral-600">
            {APP_NAME} Admin · {SITE_HOSTS.admin} · identity by {ECOSYSTEM_NAME} Accounts
          </footer>
        </main>
      </div>
      {toastNode}
    </Gate>
  );
}
