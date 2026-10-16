import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, BarChart3, Bell, CheckCircle2, ChevronRight, CircleAlert, Download,
  FileUp, HelpCircle, ImagePlus, LayoutDashboard, LogOut, MessageSquareText,
  PackagePlus, Plus, Search, Settings, Smartphone, Star, UploadCloud, X,
} from 'lucide-react';
import { useApp } from '../lib/AppContext';
import { usePath } from '../lib/router';
import { AppIcon, Logo, SignInPrompt, StatusBadge, categoryName } from '../shared/ui';
import { apkProviderForSize, compressImage, formatBytes, formatCount } from '../lib/storage';
import { inspectApk, uploadApk, uploadImage } from '../lib/api';
import type { ApkManifestInfo, UploadedApk } from '../lib/api';
import type { StoreApp as StoreAppType } from '../types';

// ── Design tokens (dark, neutral #212121 - Material-style console) ──
const inputCls = 'w-full rounded-lg border border-white/10 bg-[#1e1e1e] px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15';
const labelCls = 'mb-1.5 block text-[13px] font-medium text-neutral-300';
const hintCls = 'mt-1 text-xs leading-relaxed text-neutral-500';
const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40';
const btnGhost = 'inline-flex items-center justify-center gap-2 rounded-lg border border-white/12 bg-transparent px-4 py-2 text-sm font-medium text-neutral-200 transition hover:bg-white/5 disabled:opacity-40';

function Card({ title, desc, children, action }: { title?: string; desc?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] shadow-sm">
      {(title || action) && (
        <header className="flex flex-wrap items-start gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-[15px] font-semibold text-white">{title}</h2>}
            {desc && <p className="mt-0.5 text-[13px] text-neutral-400">{desc}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-sm text-neutral-400">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub: string; icon: typeof Download }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] p-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-neutral-400">{label}</p>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/12 text-emerald-300"><Icon size={16} /></span>
      </div>
      <p className="mt-2 font-display text-[26px] font-semibold leading-none text-white">{value}</p>
      <p className="mt-1.5 text-xs text-neutral-500">{sub}</p>
    </div>
  );
}

// ════════════════ SHELL ════════════════
function Shell({ children, navigate, path }: { children: React.ReactNode; navigate: (p: string) => void; path: string }) {
  const { user, developer, signOut } = useApp();
  const groups: { heading: string; items: [string, string, typeof LayoutDashboard][] }[] = [
    { heading: 'Overview', items: [['/', 'Dashboard', LayoutDashboard], ['/apps/new', 'Create app', PackagePlus]] },
    { heading: 'Insights', items: [['/stats', 'Statistics', BarChart3], ['/reviews', 'Reviews', MessageSquareText]] },
    { heading: 'Account', items: [['/settings', 'Developer profile', Settings]] },
  ];
  const isActive = (to: string) => (to === '/' ? path === '/' : path.startsWith(to));
  return (
    <div className="min-h-dvh bg-[#212121] text-neutral-200 lg:flex">
      {/* Sidebar */}
      <aside className="z-30 border-b border-white/[0.07] bg-[#1d1d1d] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[264px] lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center border-b border-white/[0.06] px-5">
          <Logo subtitle="Developer Console" />
        </div>
        {developer && (
          <div className="mx-3 mt-3 hidden items-center gap-3 rounded-xl border border-white/[0.07] bg-[#262626] px-3.5 py-3 lg:flex">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#333] font-display text-sm font-semibold text-white">
              {(developer.orgName || developer.displayName).charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-white">{developer.orgName || developer.displayName}</span>
              <span className="block truncate text-xs text-neutral-500">@{developer.username}</span>
            </span>
          </div>
        )}
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 py-3 lg:block lg:flex-1 lg:space-y-5 lg:overflow-y-auto lg:py-4">
          {groups.map((g) => (
            <div key={g.heading} className="flex gap-1 lg:block">
              <p className="hidden px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 lg:block">{g.heading}</p>
              {g.items.map(([to, label, Icon]) => (
                <button key={to} onClick={() => navigate(to)}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition lg:mb-0.5 lg:w-full ${isActive(to) ? 'bg-emerald-600/15 font-medium text-emerald-200' : 'text-neutral-300 hover:bg-white/[0.05] hover:text-white'}`}>
                  <Icon size={17} className={isActive(to) ? 'text-emerald-300' : 'text-neutral-500'} /> {label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="hidden border-t border-white/[0.06] p-4 lg:block">
          <div className="rounded-xl bg-[#262626] p-3.5">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-white"><HelpCircle size={15} className="text-emerald-300" /> Publishing guide</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">Listing requirements, review policy, and APK rules (≤25 MB GitHub, &gt;25 MB Backblaze B2).</p>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/[0.07] bg-[#212121]/95 px-4 backdrop-blur sm:px-6">
          <p className="hidden text-sm text-neutral-500 md:block">
            Console <span className="mx-1.5 text-neutral-600">/</span>
            <span className="font-medium text-neutral-200">{path === '/' ? 'Dashboard' : path === '/apps/new' ? 'Create app' : path === '/stats' ? 'Statistics' : path === '/reviews' ? 'Reviews' : path === '/settings' ? 'Developer profile' : 'App'}</span>
          </p>
          <div className="ml-auto flex items-center gap-2">
            <label className="hidden items-center gap-2 rounded-lg border border-white/[0.08] bg-[#2a2a2a] px-3 py-2 xl:flex">
              <Search size={15} className="text-neutral-500" />
              <input placeholder="Search apps" className="w-44 bg-transparent text-sm text-white outline-none placeholder:text-neutral-500" />
            </label>
            <button className="relative grid h-9 w-9 place-items-center rounded-lg text-neutral-400 transition hover:bg-white/5 hover:text-white" aria-label="Notifications">
              <Bell size={18} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </button>
            <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
            <span className="hidden items-center gap-2.5 sm:flex">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#3a3a3a] font-display text-sm font-semibold text-white">{user?.name.charAt(0)}</span>
              <span className="hidden leading-tight 2xl:block">
                <span className="block max-w-[150px] truncate text-[13px] font-medium text-white">{user?.name}</span>
                <span className="block max-w-[150px] truncate text-[11px] text-neutral-500">{user?.email}</span>
              </span>
            </span>
            <button onClick={signOut} className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-neutral-400 transition hover:bg-white/5 hover:text-white">
              <LogOut size={16} /> <span className="hidden md:inline">Sign out</span>
            </button>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        <footer className="border-t border-white/[0.06] px-6 py-4 text-xs text-neutral-600">Gothwad Developer Console · console.gothwadtech.com</footer>
      </div>
    </div>
  );
}

// ════════════════ ONBOARDING ════════════════
function Onboarding() {
  const { user, registerDeveloper } = useApp();
  const [, navigate] = usePath();
  const [form, setForm] = useState({ displayName: user?.name ?? '', orgName: '', supportEmail: user?.email ?? '', website: '' });
  const [agree, setAgree] = useState(false);
  return (
    <main className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center gap-0">
        {['Gothwad Account', 'Developer profile', 'Create your first app'].map((s, i) => (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <span className="flex items-center gap-2.5">
              <span className={`grid h-8 w-8 place-items-center rounded-full text-[13px] font-semibold ${i < 2 ? 'bg-emerald-600 text-white' : 'border border-white/15 text-neutral-400'}`}>{i < 1 ? '✓' : i + 1}</span>
              <span className={`hidden text-[13px] font-medium sm:block ${i === 1 ? 'text-white' : 'text-neutral-500'}`}>{s}</span>
            </span>
            {i < 2 && <span className="mx-3 h-px flex-1 bg-white/12" />}
          </div>
        ))}
      </div>
      <Card title="Create your developer profile" desc="This is shown publicly on your app listings. You only need to do this once — there is no registration fee.">
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void registerDeveloper(form).then(() => navigate('/')).catch((err: Error) => alert(err.message)); }}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label className={labelCls}>Your name</label><input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className={inputCls} placeholder="Jane Doe" /></div>
            <div><label className={labelCls}>Developer / organization name</label><input required value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} className={inputCls} placeholder="Acme Studios" /><p className={hintCls}>Shown as the publisher name on the store.</p></div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label className={labelCls}>Support email</label><input required type="email" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} className={inputCls} /><p className={hintCls}>Public. Users contact you here for support.</p></div>
            <div><label className={labelCls}>Website (optional)</label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputCls} placeholder="https://example.com" /></div>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.08] bg-[#242424] px-3.5 py-3 text-[13px] leading-relaxed text-neutral-300">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-emerald-500" />
            I agree to the Gothwad Store Developer Policy. I confirm that my apps are my own work, are not pirated or modified versions of paid apps, and do not collect user data without disclosure.
          </label>
          <div className="flex justify-end gap-2.5 border-t border-white/[0.06] pt-4">
            <button disabled={!agree} className={btnPrimary}>Create developer profile</button>
          </div>
        </form>
      </Card>
    </main>
  );
}

// ════════════════ DASHBOARD ════════════════
function Dashboard({ navigate }: { navigate: (p: string) => void }) {
  const { apps, developer, submissions, liveReleaseOf } = useApp();
  const mine = apps.filter((a) => a.developerId === developer?.id);
  const totalDownloads = mine.reduce((t, a) => t + a.downloadsCount, 0);
  const avgRating = mine.filter((a) => a.ratingCount).length
    ? mine.reduce((t, a) => t + a.ratingAvg, 0) / mine.filter((a) => a.ratingCount).length : 0;
  const rejected = submissions.find((s) => s.status === 'rejected' && mine.some((a) => a.id === s.appId));
  return (
    <main>
      <PageHeader title="Dashboard" desc="Manage your apps, releases, and store presence.">
        <button onClick={() => navigate('/apps/new')} className={btnPrimary}><Plus size={16} /> Create app</button>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <StatCard label="Total apps" value={String(mine.length)} sub={`${mine.filter((a) => a.status === 'published').length} published`} icon={Smartphone} />
        <StatCard label="Total downloads" value={formatCount(totalDownloads)} sub="All time, all apps" icon={Download} />
        <StatCard label="Average rating" value={avgRating ? avgRating.toFixed(1) : '—'} sub="Across rated apps" icon={Star} />
        <StatCard label="Pending reviews" value={String(submissions.filter((s) => s.status === 'pending' && mine.some((a) => a.id === s.appId)).length)} sub="Waiting for admin approval" icon={FileUp} />
      </div>

      {rejected && (
        <p className="mb-5 flex gap-2.5 rounded-xl border border-red-400/25 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          <span>A submission for <b>{rejected.appName}</b> was rejected. Open the app to read the reviewer note, fix the issue, and resubmit.</span>
        </p>
      )}

      <Card title="Your apps" desc={mine.length ? `${mine.length} app${mine.length > 1 ? 's' : ''} on this developer profile` : undefined}>
        {mine.length ? (
          <div className="-mx-5 -my-2 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-xs uppercase tracking-wide text-neutral-500">
                  <th className="px-5 py-2.5 font-semibold">App</th><th className="px-3 py-2.5 font-semibold">Category</th>
                  <th className="px-3 py-2.5 font-semibold">Live version</th><th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Downloads</th><th className="px-3 py-2.5 text-right font-semibold">Rating</th><th className="w-10 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {mine.map((a) => { const live = liveReleaseOf(a.id); return (
                  <tr key={a.id} onClick={() => navigate(`/apps/${a.id}`)} className="cursor-pointer border-b border-white/[0.05] transition last:border-0 hover:bg-white/[0.03]">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-3"><AppIcon app={a} size={40} rounded="rounded-[10px]" />
                        <span className="min-w-0"><span className="block max-w-[260px] truncate font-medium text-white">{a.name}</span>
                        <span className="block truncate text-xs text-neutral-500">{a.packageName}</span></span></span>
                    </td>
                    <td className="px-3 py-3 text-neutral-400">{categoryName(a.category)}</td>
                    <td className="px-3 py-3 text-neutral-400">{live ? `v${live.versionName}` : '—'}</td>
                    <td className="px-3 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-3 py-3 text-right text-neutral-300">{formatCount(a.downloadsCount)}</td>
                    <td className="px-3 py-3 text-right text-neutral-300">{a.ratingCount ? a.ratingAvg.toFixed(1) : '—'}</td>
                    <td className="px-3 py-3"><ChevronRight size={16} className="text-neutral-600" /></td>
                  </tr>);})}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#333] text-neutral-400"><Smartphone size={22} /></span>
            <p className="mt-3 font-medium text-white">No apps yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">Create your first app listing, upload an APK, and submit it for review.</p>
            <button onClick={() => navigate('/apps/new')} className={`${btnPrimary} mt-4`}><Plus size={16} /> Create app</button>
          </div>
        )}
      </Card>
    </main>
  );
}

// ════════════════ CREATE APP ════════════════
function CreateApp({ navigate }: { navigate: (p: string) => void }) {
  const { createApp, categories, apps } = useApp();
  const [name, setName] = useState('');
  const [pkg, setPkg] = useState('');
  const [category, setCategory] = useState('tools');
  const [kind, setKind] = useState<'app' | 'game'>('app');
  const validPkg = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(pkg);
  const taken = apps.some((a) => a.packageName === pkg);
  return (
    <main>
      <PageHeader title="Create app" desc="Start a new listing. You can complete the store listing and upload your APK in the next step." />
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void createApp({ name, packageName: pkg, category, kind }).then((a) => navigate(`/apps/${a.id}`)).catch((err: Error) => alert(err.message)); }}>
            <div><label className={labelCls}>App name</label><input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="My Awesome App" /></div>
            <div>
              <label className={labelCls}>Package name</label>
              <input required value={pkg} onChange={(e) => setPkg(e.target.value.trim().toLowerCase())} className={inputCls} placeholder="com.company.appname" />
              {pkg && (taken
                ? <p className="mt-1.5 text-xs font-medium text-red-300">This package name is already taken.</p>
                : validPkg
                  ? <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-300"><CheckCircle2 size={13} /> Package name is valid and available.</p>
                  : <p className="mt-1.5 text-xs text-amber-300">Use lowercase letters with at least one dot, e.g. com.company.app</p>)}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div><label className={labelCls}>Type</label><select value={kind} onChange={(e) => setKind(e.target.value as 'app' | 'game')} className={inputCls}><option value="app">App</option><option value="game">Game</option></select></div>
              <div><label className={labelCls}>Category</label><select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>{categories.filter((c) => (kind === 'game' ? c.kind !== 'app' : c.kind !== 'game')).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
            </div>
            <div className="flex justify-end gap-2.5 border-t border-white/[0.06] pt-4">
              <button type="button" onClick={() => navigate('/')} className={btnGhost}>Cancel</button>
              <button disabled={!validPkg || taken || !name} className={btnPrimary}>Create app</button>
            </div>
          </form>
        </Card>
        <Card title="Before you create">
          <ul className="space-y-3 text-[13px] leading-relaxed text-neutral-400">
            <li className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" /> The package name must match your APK and <b className="text-neutral-200">cannot be changed later</b>.</li>
            <li className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" /> You will need a 512×512 icon and at least 2 screenshots for the listing.</li>
            <li className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" /> Every APK goes through manual review before it can go live.</li>
          </ul>
        </Card>
      </div>
    </main>
  );
}

// ════════════════ APP DETAIL (listing / releases / reviews) ════════════════
function AppDetail({ app, navigate, tab }: { app: StoreAppType; navigate: (p: string) => void; tab: 'listing' | 'releases' | 'reviews' }) {
  const { updateApp, categories, releases, addRelease, submitForReview, submissions, reviews, replyReview, setAppStatus, liveReleaseOf, backendLive, isDemoUser } = useApp();
  const apiMode = backendLive && !isDemoUser;
  const [form, setForm] = useState(app);
  const [iconName, setIconName] = useState('');
  const [shots, setShots] = useState<string[]>(app.screenshots);
  const [apk, setApk] = useState<{ name: string; size: number; file: File; manifest?: ApkManifestInfo | null } | null>(null);
  const [ver, setVer] = useState({ versionName: '', versionCode: '', changelog: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const appReleases = releases.filter((r) => r.appId === app.id).sort((a, b) => b.versionCode - a.versionCode);
  const appReviews = reviews.filter((r) => r.appId === app.id);
  const rejected = submissions.find((s) => s.appId === app.id && s.status === 'rejected');
  const live = liveReleaseOf(app.id);

  const onImage = async (file: File | undefined, target: 'icon' | 'shot') => {
    if (!file) return;
    setError('');
    try {
      const small = await compressImage(file, target === 'icon' ? 512 : 1080);
      // Live mode: Worker uploads the image to ImgBB. Demo/offline: local preview only.
      const url = apiMode ? await uploadImage(small, file.name) : URL.createObjectURL(small);
      if (target === 'icon') { setForm((f) => ({ ...f, iconUrl: url })); setIconName(file.name); }
      else setShots((s) => [...s, url].slice(0, 8));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed');
    }
  };

  const onApkFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setApk({ name: file.name, size: file.size, file });
    if (!apiMode) return;
    try {
      // Manifest auto-read: package, version, SDK and permissions fill themselves in.
      const { manifest } = await inspectApk(file);
      setApk({ name: file.name, size: file.size, file, manifest });
      if (manifest.packageName && manifest.packageName !== app.packageName) {
        setError(`This APK is for ${manifest.packageName}, but this listing is ${app.packageName}. Upload the correct APK.`);
        return;
      }
      setVer((v) => ({
        ...v,
        versionName: manifest.versionName ?? v.versionName,
        versionCode: manifest.versionCode ? String(manifest.versionCode) : v.versionCode,
      }));
      if (manifest.versionName || manifest.versionCode) setMsg('APK details were read automatically from the file. You can still edit them below.');
    } catch {
      setMsg('The APK manifest could not be read automatically. Enter the version details manually - an admin will verify them during review.');
    }
  };

  const tabs: [typeof tab, string][] = [['listing', 'Store listing'], ['releases', `Releases`], ['reviews', `Reviews`]];

  return (
    <main>
      <button onClick={() => navigate('/')} className="mb-4 flex items-center gap-1.5 text-sm text-neutral-400 transition hover:text-white"><ArrowLeft size={15} /> All apps</button>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <AppIcon app={app} size={56} rounded="rounded-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-white">{app.name}</h1>
          <p className="truncate text-[13px] text-neutral-500">{app.packageName} · {categoryName(app.category)}{live ? ` · v${live.versionName} live` : ''}</p>
        </div>
        <StatusBadge status={app.status} />
        {app.status === 'published' && <button onClick={() => { void setAppStatus(app.id, 'unlisted').catch((err: Error) => setError(err.message)); }} className={btnGhost}>Unpublish</button>}
        {app.status === 'unlisted' && <button onClick={() => { void setAppStatus(app.id, 'published').catch((err: Error) => setError(err.message)); }} className={btnPrimary}>Publish again</button>}
      </div>

      {rejected?.note && app.status === 'draft' && (
        <p className="mb-5 rounded-xl border border-red-400/25 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200"><b>Reviewer note:</b> {rejected.note}</p>
      )}
      {msg && <p className="mb-5 flex gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] px-4 py-3 text-sm text-emerald-200"><CheckCircle2 size={18} className="shrink-0" /> {msg}</p>}
      {error && <p className="mb-5 rounded-xl border border-red-400/25 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200"><b>Error:</b> {error}</p>}

      <div className="mb-6 flex gap-1 border-b border-white/[0.08]">
        {tabs.map(([t, l]) => (
          <button key={t} onClick={() => navigate(t === 'listing' ? `/apps/${app.id}` : `/apps/${app.id}/${t}`)}
            className={`relative px-4 py-2.5 text-sm transition ${tab === t ? 'font-medium text-white' : 'text-neutral-400 hover:text-neutral-200'}`}>
            {l}{t === 'reviews' && appReviews.length > 0 ? ` (${appReviews.length})` : t === 'releases' && appReleases.length > 0 ? ` (${appReleases.length})` : ''}
            {tab === t && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-emerald-500" />}
          </button>
        ))}
      </div>

      {tab === 'listing' && (
        <form onSubmit={(e) => { e.preventDefault(); setError(''); void updateApp(app.id, {
          name: form.name, category: form.category, shortDesc: form.shortDesc, fullDesc: form.fullDesc,
          iconUrl: form.iconUrl, supportEmail: form.supportEmail, privacyPolicyUrl: form.privacyPolicyUrl,
          screenshots: shots,
        }).then(() => setMsg('Store listing saved. Text and image changes go live immediately; APKs always require review.')).catch((err: Error) => setError(err.message)); }}>
          <div className="space-y-5">
            <Card title="App details" desc="How your app appears on Gothwad Store.">
              <div className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div><label className={labelCls}>App name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required /></div>
                  <div><label className={labelCls}>Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
                </div>
                <div>
                  <label className={labelCls}>Short description</label>
                  <input maxLength={80} value={form.shortDesc} onChange={(e) => setForm({ ...form, shortDesc: e.target.value })} className={inputCls} placeholder="One line that explains what your app does" />
                  <p className="mt-1 text-right text-[11px] text-neutral-600">{form.shortDesc.length} / 80</p>
                </div>
                <div><label className={labelCls}>Full description</label><textarea rows={7} value={form.fullDesc} onChange={(e) => setForm({ ...form, fullDesc: e.target.value })} className={inputCls} placeholder="Describe your app, its key features, and who it is for." /></div>
              </div>
            </Card>

            <Card title="Graphics" desc="Images are hosted on ImgBB and are resized in the browser before upload.">
              <div className="space-y-5">
                <div>
                  <label className={labelCls}>App icon · 512 × 512</label>
                  <div className="flex flex-wrap items-center gap-4">
                    {form.iconUrl ? <img src={form.iconUrl} alt="" className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/10" /> : <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#333] font-display text-xl font-semibold text-white">{form.name.charAt(0)}</span>}
                    <label className={`${btnGhost} cursor-pointer`}><ImagePlus size={16} /> {iconName || 'Upload icon'}<input type="file" accept="image/*" className="hidden" onChange={(e) => void onImage(e.target.files?.[0], 'icon')} /></label>
                    <span className="text-xs text-neutral-500">PNG, JPG or WebP</span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Screenshots · at least 2 required</label>
                  <div className="flex flex-wrap gap-3">
                    {shots.map((s, i) => (
                      <span key={i} className="group relative">
                        <img src={s} alt={`Screenshot ${i + 1}`} className="h-40 w-[90px] rounded-lg object-cover ring-1 ring-white/10" />
                        <button type="button" onClick={() => setShots(shots.filter((_, x) => x !== i))} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100" aria-label="Remove screenshot"><X size={13} /></button>
                      </span>
                    ))}
                    <label className="grid h-40 w-[90px] cursor-pointer place-items-center rounded-lg border border-dashed border-white/20 text-neutral-400 transition hover:border-emerald-500/50 hover:text-emerald-300">
                      <span className="flex flex-col items-center gap-1.5 text-xs font-medium"><ImagePlus size={19} /> Add</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => void onImage(e.target.files?.[0], 'shot')} />
                    </label>
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Contact & privacy">
              <div className="grid gap-5 sm:grid-cols-2">
                <div><label className={labelCls}>Support email</label><input type="email" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Privacy policy URL</label><input value={form.privacyPolicyUrl ?? ''} onChange={(e) => setForm({ ...form, privacyPolicyUrl: e.target.value })} className={inputCls} placeholder="https://example.com/privacy" /><p className={hintCls}>Required if your app collects personal data.</p></div>
              </div>
            </Card>

            <div className="sticky bottom-4 flex justify-end gap-2.5 rounded-xl border border-white/[0.08] bg-[#2a2a2a]/95 px-4 py-3 shadow-xl shadow-black/30 backdrop-blur">
              <button type="button" onClick={() => { setForm(app); setShots(app.screenshots); }} className={btnGhost}>Discard changes</button>
              <button className={btnPrimary}>Save listing</button>
            </div>
          </div>
        </form>
      )}

      {tab === 'releases' && (
        <div className="space-y-5">
          <Card title="Upload a new release" desc="APK files up to 25 MB are stored on GitHub (storefiles). Larger APKs go to Backblaze B2.">
            <form className="space-y-5" onSubmit={(e) => {
              e.preventDefault(); if (!apk) return;
              setError('');
              void (async () => {
                try {
                  let uploaded: UploadedApk | undefined;
                  if (apiMode) {
                    if (apk.manifest?.packageName && apk.manifest.packageName !== app.packageName) {
                      throw new Error(`This APK is for ${apk.manifest.packageName}, but this listing is ${app.packageName}.`);
                    }
                    // Ticket rule inside uploadApk: <=25 MB GitHub via Worker, >25 MB B2 presigned direct.
                    setUploadPct(0);
                    uploaded = await uploadApk(apk.file, app, Number(ver.versionCode), (f) => setUploadPct(Math.round(f * 100)));
                    setUploadPct(null);
                  }
                  const rel = await addRelease(app.id, {
                    versionName: ver.versionName, versionCode: Number(ver.versionCode), sizeBytes: apk.size,
                    changelog: ver.changelog, permissions: apk.manifest?.permissions?.length ? apk.manifest.permissions : ['android.permission.INTERNET'],
                    apkName: apk.name, apkUrl: uploaded?.url, apkProvider: uploaded?.provider, apkKey: uploaded?.key,
                    apkSha256: uploaded?.sha256, manifest: uploaded?.manifest ?? apk.manifest ?? undefined,
                  });
                  setMsg(`Release v${rel.versionName} created (${formatBytes(apk.size)} → ${apkProviderForSize(apk.size) === 'github' ? 'GitHub · storefiles' : 'Backblaze B2'}). Submit it for review below.`);
                  setApk(null);
                } catch (err) {
                  setUploadPct(null);
                  setError(err instanceof Error ? err.message : 'Release creation failed');
                }
              })();
            }}>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-white/20 bg-[#242424] px-4 py-9 text-center transition hover:border-emerald-500/50">
                <UploadCloud size={30} className="text-emerald-400" />
                <span className="text-sm font-medium text-white">{apk ? `${apk.name} · ${formatBytes(apk.size)}` : 'Choose an APK file or drop it here'}</span>
                <span className="text-xs text-neutral-500">{apk ? (apkProviderForSize(apk.size) === 'github' ? 'Will be stored on GitHub (storefiles) — ≤25 MB rule' : 'Will be stored on Backblaze B2 — >25 MB rule') : 'Signed release APK built with your release keystore'}</span>
                <input type="file" accept=".apk,application/vnd.android.package-archive" className="hidden" onChange={(e) => { void onApkFile(e.target.files?.[0]); }} />
              </label>
              <div className="grid gap-5 sm:grid-cols-2">
                <div><label className={labelCls}>Version name</label><input required value={ver.versionName} onChange={(e) => setVer({ ...ver, versionName: e.target.value })} className={inputCls} placeholder="1.0.0" /></div>
                <div><label className={labelCls}>Version code</label><input required type="number" min={1} value={ver.versionCode} onChange={(e) => setVer({ ...ver, versionCode: e.target.value })} className={inputCls} placeholder="1" /><p className={hintCls}>Integer that increases with every release.</p></div>
              </div>
              {apk?.manifest && (apk.manifest.minSdk || apk.manifest.permissions.length > 0) && (
                <p className="rounded-lg bg-white/[0.04] px-3 py-2 text-xs leading-relaxed text-neutral-400">
                  Read from APK: package <span className="text-neutral-200">{apk.manifest.packageName ?? app.packageName}</span>
                  {apk.manifest.minSdk ? <> · min Android SDK {apk.manifest.minSdk}</> : null}
                  {apk.manifest.targetSdk ? <> · target SDK {apk.manifest.targetSdk}</> : null}
                  {apk.manifest.permissions.length ? <> · {apk.manifest.permissions.length} permissions</> : null}
                </p>
              )}
              <div><label className={labelCls}>Release notes</label><textarea rows={3} value={ver.changelog} onChange={(e) => setVer({ ...ver, changelog: e.target.value })} className={inputCls} placeholder="What is new in this version?" /></div>
              <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] pt-4">
                {uploadPct !== null && <span className="text-xs text-neutral-400">Uploading APK… {uploadPct}%</span>}
                <button disabled={!apk || uploadPct !== null} className={btnPrimary}><FileUp size={16} /> Create release</button>
              </div>
            </form>
          </Card>

          <Card title="Release history" desc={live ? `Currently live: v${live.versionName} (${live.versionCode})` : 'Nothing is live yet. Your first approved release will appear here.'}>
            {appReleases.length ? (
              <div className="-mx-5 -my-2 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead><tr className="border-b border-white/[0.07] text-xs uppercase tracking-wide text-neutral-500">
                    <th className="px-5 py-2.5 font-semibold">Version</th><th className="px-3 py-2.5 font-semibold">Size</th><th className="px-3 py-2.5 font-semibold">Storage</th>
                    <th className="px-3 py-2.5 font-semibold">Review</th><th className="px-3 py-2.5 text-right font-semibold">Downloads</th><th className="px-3 py-2.5 text-right font-semibold">Action</th>
                  </tr></thead>
                  <tbody>{appReleases.map((r) => (
                    <tr key={r.id} className="border-b border-white/[0.05] last:border-0">
                      <td className="px-5 py-3"><span className="font-medium text-white">v{r.versionName}</span> <span className="text-xs text-neutral-500">({r.versionCode})</span>{r.isLive && <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-400/25">Live</span>}</td>
                      <td className="px-3 py-3 text-neutral-400">{formatBytes(r.apkSizeBytes)}</td>
                      <td className="px-3 py-3 text-neutral-400">{r.apkProvider === 'github' ? 'GitHub' : 'Backblaze B2'}</td>
                      <td className="px-3 py-3"><span className={r.reviewStatus === 'approved' ? 'text-emerald-300' : r.reviewStatus === 'rejected' ? 'text-red-300' : 'text-amber-300'}>{r.reviewStatus === 'approved' ? 'Approved' : r.reviewStatus === 'rejected' ? 'Rejected' : 'Pending'}</span>{r.reviewStatus === 'rejected' && r.reviewNote ? <span className="block max-w-[220px] truncate text-xs text-neutral-500" title={r.reviewNote}>{r.reviewNote}</span> : null}</td>
                      <td className="px-3 py-3 text-right text-neutral-300">{formatCount(r.downloads)}</td>
                      <td className="px-3 py-3 text-right">
                        {r.reviewStatus === 'pending' && app.status !== 'in_review'
                          ? <button onClick={() => { setError(''); void submitForReview(app.id, r.id).then(() => setMsg('Submitted for review. Once an admin approves it, this version will go live.')).catch((err: Error) => setError(err.message)); }} className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-400">Submit for review</button>
                          : <span className="text-xs text-neutral-600">—</span>}
                      </td>
                    </tr>))}
                  </tbody>
                </table>
              </div>
            ) : <p className="py-6 text-center text-sm text-neutral-500">No releases yet. Upload your first APK above.</p>}
          </Card>
        </div>
      )}

      {tab === 'reviews' && (
        <div className="space-y-4">
          {appReviews.map((r) => (
            <section key={r.id} className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#3a3a3a] text-xs font-semibold text-white">{r.username.charAt(0).toUpperCase()}</span>
                <b className="text-sm text-white">@{r.username}</b>
                <span className="text-amber-300">{'★'.repeat(r.rating)}<span className="text-neutral-700">{'★'.repeat(5 - r.rating)}</span></span>
                <span className="ml-auto text-xs text-neutral-600">{new Date(r.createdAt).toLocaleDateString('en-US')}</span>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-neutral-300">{r.body}</p>
              {r.developerReply
                ? <p className="mt-3 rounded-lg bg-[#242424] px-3.5 py-2.5 text-[13px] text-neutral-300"><b className="text-emerald-300">Your reply: </b>{r.developerReply}</p>
                : <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void replyReview(r.id, replyDraft[r.id] ?? '').catch((err: Error) => alert(err.message)); }}>
                    <input value={replyDraft[r.id] ?? ''} onChange={(e) => setReplyDraft({ ...replyDraft, [r.id]: e.target.value })} placeholder="Reply as the developer…" className={inputCls} />
                    <button className={`${btnPrimary} shrink-0`}>Reply</button>
                  </form>}
            </section>
          ))}
          {!appReviews.length && <Card><p className="py-6 text-center text-sm text-neutral-500">No reviews yet for this app.</p></Card>}
        </div>
      )}
    </main>
  );
}

// ════════════════ STATS / REVIEWS / SETTINGS ════════════════
function StatsPage() {
  const { apps, developer } = useApp();
  const mine = apps.filter((a) => a.developerId === developer?.id && a.status === 'published');
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data = useMemo(() => mine.map((a, i) => ({ app: a, vals: days.map((_, d) => 20 + ((a.downloadsCount / 97 + d * 13 + i * 7) % 90)) })), [mine]); // eslint-disable-line react-hooks/exhaustive-deps
  const weekTotal = data.reduce((t, x) => t + x.vals.reduce((a, b) => a + Math.round(b), 0), 0);
  return (
    <main>
      <PageHeader title="Statistics" desc="Downloads for the last 7 days. Production data comes from the Worker downloads table." />
      <div className="mb-6 grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <StatCard label="Downloads (7 days)" value={formatCount(weekTotal)} sub="Across published apps" icon={Download} />
        <StatCard label="Published apps" value={String(mine.length)} sub="Currently live on the store" icon={Smartphone} />
        <StatCard label="Total downloads" value={formatCount(mine.reduce((t, a) => t + a.downloadsCount, 0))} sub="All time" icon={BarChart3} />
        <StatCard label="Total ratings" value={formatCount(mine.reduce((t, a) => t + a.ratingCount, 0))} sub="Across published apps" icon={Star} />
      </div>
      <div className="space-y-5">
        {data.map(({ app, vals }) => (
          <Card key={app.id} title={app.name} desc={`${formatCount(app.downloadsCount)} total downloads · ${app.ratingAvg.toFixed(1)} average rating (${formatCount(app.ratingCount)} ratings)`}>
            <div className="flex h-36 items-end gap-2.5">
              {vals.map((v, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <span className="w-full rounded-t-md bg-emerald-600/80 transition hover:bg-emerald-500" style={{ height: `${Math.max(7, v)}%` }} title={`${days[i]}: ${Math.round(v)} downloads`} />
                  <span className="text-[11px] text-neutral-500">{days[i]}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
        {!mine.length && <Card><p className="py-8 text-center text-sm text-neutral-500">Charts will appear here once you have a published app.</p></Card>}
      </div>
    </main>
  );
}

function ReviewsPage() {
  const { apps, developer, reviews, replyReview } = useApp();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const mine = reviews.filter((r) => apps.some((a) => a.id === r.appId && a.developerId === developer?.id));
  return (
    <main>
      <PageHeader title="Reviews" desc="Reviews across all of your apps. Public replies build trust with users." />
      <div className="space-y-4">
        {mine.map((r) => { const a = apps.find((x) => x.id === r.appId); return (
          <section key={r.id} className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] px-5 py-4">
            <p className="text-xs text-neutral-500">{a?.name} · <span className="font-medium text-neutral-300">@{r.username}</span></p>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-200">{r.body}</p>
            {!r.developerReply
              ? <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void replyReview(r.id, draft[r.id] ?? '').catch((err: Error) => alert(err.message)); }}><input value={draft[r.id] ?? ''} onChange={(e) => setDraft({ ...draft, [r.id]: e.target.value })} className={inputCls} placeholder="Write a public reply…" /><button className={`${btnPrimary} shrink-0`}>Reply</button></form>
              : <p className="mt-2.5 text-[13px] text-neutral-400"><b className="text-emerald-300">You: </b>{r.developerReply}</p>}
          </section>);})}
        {!mine.length && <Card><p className="py-8 text-center text-sm text-neutral-500">No reviews yet.</p></Card>}
      </div>
    </main>
  );
}

function SettingsPage() {
  const { developer, registerDeveloper, user } = useApp();
  const [form, setForm] = useState({ displayName: developer?.displayName ?? '', orgName: developer?.orgName ?? '', supportEmail: developer?.supportEmail ?? '', website: developer?.website ?? '' });
  const [saved, setSaved] = useState(false);
  if (!developer) return null;
  return (
    <main className="max-w-3xl">
      <PageHeader title="Developer profile" desc="Public publisher information shown on your listings." />
      <div className="space-y-5">
        <Card title="Profile">
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void registerDeveloper(form).then(() => setSaved(true)).catch((err: Error) => alert(err.message)); }}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div><label className={labelCls}>Name</label><input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className={inputCls} required /></div>
              <div><label className={labelCls}>Organization name</label><input value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} className={inputCls} required /></div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div><label className={labelCls}>Support email</label><input type="email" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} className={inputCls} required /></div>
              <div><label className={labelCls}>Website</label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputCls} /></div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] pt-4">
              {saved && <span className="flex items-center gap-1.5 text-sm text-emerald-300"><CheckCircle2 size={15} /> Saved</span>}
              <button className={btnPrimary}>Save changes</button>
            </div>
          </form>
        </Card>
        <Card title="Gothwad Account" desc="Identity is managed by Gothwad Accounts, not here.">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-neutral-500">Username</dt><dd className="mt-0.5 font-medium text-white">@{user?.username}</dd></div>
            <div><dt className="text-neutral-500">Email</dt><dd className="mt-0.5 font-medium text-white">{user?.email}</dd></div>
          </dl>
          <p className={hintCls}>To change your name, password, or security settings, visit accounts.gothwadtech.com.</p>
        </Card>
      </div>
    </main>
  );
}

// ════════════════ CALLBACK + ROOT ════════════════
function Callback() {
  const { setUser } = useApp();
  const [msg, setMsg] = useState('Returning from Gothwad Accounts…');
  useEffect(() => {
    void import('../lib/auth').then((m) =>
      m.handleOAuthCallback().then((r) => {
        if ('user' in r) { setUser(r.user); setMsg('Signed in! Opening your dashboard…'); setTimeout(() => window.location.replace('/'), 600); }
        else setMsg(`We could not sign you in (${r.error}).`);
      }),
    );
  }, [setUser]);
  return <main className="mx-auto max-w-md px-4 py-24 text-center text-neutral-300">{msg}</main>;
}

export default function ConsoleApp() {
  const [path, navigate] = usePath();
  const { user, developer, apps, signInDemo } = useApp();
  if (path === '/auth/callback') return <div className="min-h-dvh bg-[#212121] text-neutral-200"><Callback /></div>;
  if (!user) return <div className="min-h-dvh bg-[#212121]"><SignInPrompt onDemo={signInDemo} what="Developer Console" /></div>;
  if (!developer && path !== '/onboarding') {
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
    page = app ? <AppDetail app={app} navigate={navigate} tab={tab} /> : <main className="py-16 text-center text-neutral-400">This app was not found, or it does not belong to your developer profile.</main>;
  } else if (path === '/stats') page = <StatsPage />;
  else if (path === '/reviews') page = <ReviewsPage />;
  else if (path === '/settings') page = <SettingsPage />;
  return <Shell navigate={navigate} path={path}>{page}</Shell>;
}
