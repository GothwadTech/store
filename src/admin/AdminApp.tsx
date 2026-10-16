import { useState } from 'react';
import { Ban, Check, Flag, LayoutDashboard, ListChecks, LogOut, ShieldCheck, Star, X } from 'lucide-react';
import { useApp } from '../lib/AppContext';
import { AppIcon, Logo, SignInPrompt, StatusBadge } from '../shared/ui';
import { apkProviderLabel, formatBytes, formatCount } from '../lib/storage';

const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500';
const btnDanger = 'inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500';
const btnGhost = 'inline-flex items-center justify-center gap-2 rounded-lg border border-white/12 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:bg-white/5';

function Gate({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, signInDemo, signOut } = useApp();
  if (!user) return <div className="min-h-dvh bg-[#212121]"><SignInPrompt onDemo={signInDemo} what="Store Admin" /></div>;
  if (!isAdmin)
    return (
      <div className="grid min-h-dvh place-items-center bg-[#212121] px-4 text-center">
        <div>
          <ShieldCheck size={44} className="mx-auto text-red-300" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-white">Admin access required</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-400">@{user.username} is not listed in ADMIN_USERNAMES. This panel is restricted to Gothwad Store administrators.</p>
          <button onClick={signOut} className={`${btnGhost} mt-6`}><LogOut size={15} /> Sign out</button>
        </div>
      </div>
    );
  return <>{children}</>;
}

export default function AdminApp() {
  const { apps, submissions, reports, decideSubmission, setAppStatus, resolveReport, user, signOut } = useApp();
  const [tab, setTab] = useState<'queue' | 'apps' | 'reports'>('queue');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const pending = submissions.filter((s) => s.status === 'pending');
  const decided = submissions.filter((s) => s.status !== 'pending').slice(0, 8);
  const openReports = reports.filter((r) => r.status === 'open');
  const publishedCount = apps.filter((a) => a.status === 'published').length;

  const nav: ['queue' | 'apps' | 'reports', string, typeof ListChecks][] = [
    ['queue', `Review queue (${pending.length})`, ListChecks],
    ['apps', 'All apps', LayoutDashboard],
    ['reports', `Reports (${openReports.length})`, Flag],
  ];

  return (
    <Gate>
      <div className="min-h-dvh bg-[#212121] text-neutral-200 lg:flex">
        <aside className="border-b border-white/[0.07] bg-[#1d1d1d] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[264px] lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
          <div className="flex h-16 items-center border-b border-white/[0.06] px-5"><Logo subtitle="Store Admin" /></div>
          <div className="mx-3 mt-3 hidden rounded-xl border border-red-400/20 bg-red-500/[0.07] px-3.5 py-3 lg:block">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-red-200"><ShieldCheck size={15} /> Administrator</p>
            <p className="mt-0.5 text-xs text-red-200/60">Signed in as @{user?.username}</p>
          </div>
          <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 py-3 lg:block lg:flex-1 lg:space-y-1 lg:py-4">
            {nav.map(([t, label, Icon]) => (
              <button key={t} onClick={() => setTab(t)} className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition lg:w-full ${tab === t ? 'bg-red-500/12 font-medium text-red-200' : 'text-neutral-300 hover:bg-white/[0.05] hover:text-white'}`}>
                <Icon size={17} className={tab === t ? 'text-red-300' : 'text-neutral-500'} />{label}
              </button>
            ))}
          </nav>
          <div className="hidden border-t border-white/[0.06] p-4 lg:block">
            <p className="rounded-xl bg-[#262626] p-3.5 text-xs leading-relaxed text-neutral-500">admin.console.gothwadtech.com<br />Follow the review checklist for every submission. A note is required to reject.</p>
            <button onClick={signOut} className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-neutral-400 transition hover:text-white"><LogOut size={15} /> Sign out</button>
          </div>
        </aside>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {tab === 'queue' && (
            <>
              <h1 className="text-[22px] font-semibold tracking-tight text-white sm:text-2xl">Review queue</h1>
              <p className="mt-1 max-w-3xl text-sm text-neutral-400">Manual review: confirm the name and icon are original, the description is accurate, dangerous permissions are justified, and the app actually launches. A reason is <b className="text-neutral-200">required</b> to reject.</p>
              <div className="mt-6 space-y-4">
                {pending.map((s) => {
                  const app = apps.find((a) => a.id === s.appId);
                  return (
                    <article key={s.id} className="rounded-xl border border-amber-400/20 bg-[#2a2a2a] p-5">
                      <div className="flex flex-wrap items-center gap-3.5">
                        {app && <AppIcon app={app} size={52} rounded="rounded-[10px]" />}
                        <div className="min-w-0 flex-1">
                          <b className="text-white">{s.appName}</b> <span className="text-xs text-neutral-500">v{s.versionName} ({s.versionCode})</span>
                          <p className="truncate text-xs text-neutral-500">{s.packageName} · by {s.developerName}</p>
                          <p className="mt-0.5 text-xs text-neutral-400">{apkProviderLabel(s.apkSizeBytes)} · {formatBytes(s.apkSizeBytes)} · Submitted {new Date(s.submittedAt).toLocaleString('en-US')}</p>
                        </div>
                      </div>
                      <textarea value={notes[s.id] ?? ''} onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })} rows={2} placeholder="Reviewer note (required to reject, optional to approve)…" className="mt-4 w-full rounded-lg border border-white/10 bg-[#1e1e1e] px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-red-400/50 focus:ring-2 focus:ring-red-400/10" />
                      <div className="mt-3 flex flex-wrap gap-2.5">
                        <button onClick={() => decideSubmission(s.id, true, notes[s.id] ?? '')} className={btnPrimary}><Check size={16} /> Approve and publish</button>
                        <button onClick={() => { if (!(notes[s.id] ?? '').trim()) { alert('Add a reviewer note before rejecting — the developer will see exactly that reason.'); return; } decideSubmission(s.id, false, notes[s.id]); }} className={btnDanger}><X size={16} /> Reject</button>
                      </div>
                    </article>
                  );
                })}
                {!pending.length && <div className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] px-4 py-16 text-center text-sm text-neutral-500">The queue is empty. Every submission has been decided.</div>}
              </div>
              {decided.length > 0 && (
                <>
                  <h2 className="mt-10 text-lg font-semibold text-white">Recent decisions</h2>
                  <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.08]">
                    {decided.map((s) => (
                      <div key={s.id} className="flex flex-wrap items-center gap-3 border-b border-white/[0.05] bg-[#2a2a2a] px-4 py-3 text-sm last:border-0">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${s.status === 'approved' ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/25' : 'bg-red-500/15 text-red-300 ring-red-400/25'}`}>{s.status}</span>
                        <b className="text-neutral-100">{s.appName}</b>
                        <span className="text-xs text-neutral-500">v{s.versionName} · {s.developerName}{s.note ? ` · “${s.note}”` : ''}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {tab === 'apps' && (
            <>
              <h1 className="text-[22px] font-semibold tracking-tight text-white sm:text-2xl">All apps</h1>
              <p className="mt-1 text-sm text-neutral-400">{publishedCount} live · {apps.filter((a) => a.status === 'suspended').length} suspended. Suspending removes an app from the store immediately.</p>
              <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.08]">
                {apps.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-3.5 border-b border-white/[0.05] bg-[#2a2a2a] px-4 py-3.5 last:border-0">
                    <AppIcon app={a} size={46} rounded="rounded-[10px]" />
                    <span className="min-w-0 flex-1">
                      <b className="line-clamp-1 text-sm text-white">{a.name}</b>
                      <span className="block truncate text-xs text-neutral-500">{a.packageName} · {a.developerName} · {formatCount(a.downloadsCount)} downloads · ★ {a.ratingAvg.toFixed(1)}</span>
                    </span>
                    <StatusBadge status={a.status} />
                    {a.status === 'published' && <button onClick={() => setAppStatus(a.id, 'suspended')} className="flex items-center gap-1.5 rounded-lg bg-red-500/12 px-3.5 py-2 text-xs font-semibold text-red-200 ring-1 ring-red-400/25 transition hover:bg-red-500/20"><Ban size={13} /> Suspend</button>}
                    {a.status === 'suspended' && <button onClick={() => setAppStatus(a.id, 'published')} className="flex items-center gap-1.5 rounded-lg bg-emerald-500/12 px-3.5 py-2 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/25 transition hover:bg-emerald-500/20"><Check size={13} /> Restore</button>}
                    <span className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-neutral-400"><Star size={13} /> {a.featured ?? 'Not featured'}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'reports' && (
            <>
              <h1 className="text-[22px] font-semibold tracking-tight text-white sm:text-2xl">User reports</h1>
              <p className="mt-1 text-sm text-neutral-400">Reports submitted from app pages. Resolve once action has been taken.</p>
              <div className="mt-6 space-y-3">
                {reports.map((r) => (
                  <article key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-[#2a2a2a] px-5 py-4">
                    <span className="min-w-0 flex-1">
                      <b className="text-sm text-white">{r.appName}</b> <span className="text-xs text-neutral-500">· @{r.reporter} · {r.reason}</span>
                      {r.details && <span className="block text-[13px] text-neutral-400">“{r.details}”</span>}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${r.status === 'open' ? 'bg-amber-500/15 text-amber-300 ring-amber-400/25' : 'bg-neutral-500/15 text-neutral-300 ring-neutral-400/20'}`}>{r.status}</span>
                    {r.status === 'open' && (
                      <>
                        <button onClick={() => resolveReport(r.id, 'resolved')} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500">Resolve</button>
                        <button onClick={() => resolveReport(r.id, 'dismissed')} className={btnGhost + ' !px-4 !py-2 text-xs'}>Dismiss</button>
                      </>
                    )}
                  </article>
                ))}
                {!reports.length && <p className="py-14 text-center text-sm text-neutral-500">No reports have been submitted.</p>}
              </div>
            </>
          )}
        </main>
      </div>
    </Gate>
  );
}
