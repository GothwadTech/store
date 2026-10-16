import { Star, Store } from 'lucide-react';
import type { StoreApp } from '../types';
import { formatCount } from '../lib/storage';
import { CATEGORIES } from '../data/seed';

export function Logo({ subtitle }: { subtitle: string }) {
  return (
    <span className="flex items-center gap-2.5 select-none">
      <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-emerald-600 text-white">
        <Store size={19} strokeWidth={2.3} />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-[16px] font-semibold tracking-tight text-white">Gothwad</span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{subtitle}</span>
      </span>
    </span>
  );
}

export function AppIcon({ app, size = 56, rounded = 'rounded-2xl' }: { app: StoreApp; size?: number; rounded?: string }) {
  if (app.iconUrl) {
    return <img src={app.iconUrl} alt={app.name} width={size} height={size} className={`${rounded} shrink-0 object-cover`} style={{ width: size, height: size }} loading="lazy" />;
  }
  return (
    <span className={`grid shrink-0 place-items-center ${rounded} font-display font-bold text-white`} style={{ width: size, height: size, background: app.iconColor, fontSize: size * 0.42 }}>
      {app.name.charAt(0).toUpperCase()}
    </span>
  );
}

export function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-neutral-600'} />
      ))}
    </span>
  );
}

export function StatusBadge({ status }: { status: StoreApp['status'] }) {
  const map: Record<StoreApp['status'], string> = {
    draft: 'bg-neutral-500/15 text-neutral-300 ring-neutral-400/20',
    in_review: 'bg-amber-500/15 text-amber-300 ring-amber-400/25',
    published: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/25',
    unlisted: 'bg-zinc-500/15 text-zinc-300 ring-zinc-400/20',
    suspended: 'bg-red-500/15 text-red-300 ring-red-400/25',
  };
  const label: Record<StoreApp['status'], string> = {
    draft: 'Draft', in_review: 'In review', published: 'Published', unlisted: 'Unlisted', suspended: 'Suspended',
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${map[status]}`}>{label[status]}</span>;
}

export function categoryName(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}

export function AppCard({ app, onOpen }: { app: StoreApp; onOpen: (a: StoreApp) => void }) {
  return (
    <button onClick={() => onOpen(app)} className="group w-[104px] shrink-0 text-left sm:w-[128px]">
      <span className="block overflow-hidden rounded-[22%] shadow-lg shadow-black/30 ring-1 ring-white/10 transition group-hover:ring-emerald-400/40">
        <AppIcon app={app} size={128} rounded="rounded-none" />
      </span>
      <span className="mt-2 line-clamp-1 block text-[13px] font-medium text-neutral-100">{app.name}</span>
      <span className="line-clamp-1 block text-[11px] text-neutral-400">{categoryName(app.category)}</span>
      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-300">
        {app.ratingAvg.toFixed(1)} <Star size={10} className="fill-neutral-300 text-neutral-300" /> · {formatCount(app.downloadsCount)}
      </span>
    </button>
  );
}

export function AppRow({ app, rank, onOpen }: { app: StoreApp; rank?: number; onOpen: (a: StoreApp) => void }) {
  return (
    <button onClick={() => onOpen(app)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5">
      {rank !== undefined && <span className="w-6 shrink-0 text-center font-display text-lg font-bold text-neutral-500">{rank}</span>}
      <AppIcon app={app} size={48} rounded="rounded-xl" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 block text-sm font-medium text-neutral-100">{app.name}</span>
        <span className="line-clamp-1 block text-xs text-neutral-400">{app.shortDesc || categoryName(app.category)}</span>
        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-400">
          {app.ratingAvg.toFixed(1)} <Star size={10} className="fill-neutral-400 text-neutral-400" /> · {formatCount(app.downloadsCount)} downloads
        </span>
      </span>
    </button>
  );
}

export function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3 px-1">
      <h2 className="font-display text-lg font-bold text-white sm:text-xl">{title}</h2>
      {sub && <p className="text-[13px] text-neutral-400">{sub}</p>}
    </div>
  );
}

export function SignInPrompt({ onDemo, what }: { onDemo: () => void; what: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="rounded-2xl border border-white/10 bg-[#2a2a2a] p-8 shadow-xl shadow-black/20">
        <div className="flex justify-center"><Logo subtitle={what} /></div>
        <h1 className="mt-6 font-display text-2xl font-semibold text-white">Sign in with your Gothwad Account</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          One Gothwad Account for Mail, Drive, Store, and more. Sign in to continue to {what}.
        </p>
        <button
          onClick={() => { void import('../lib/auth').then((m) => m.startGothwadSignIn()); }}
          className="mt-6 w-full rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          Sign in with Gothwad
        </button>
        <button onClick={onDemo} className="mt-2.5 w-full rounded-lg border border-white/15 px-5 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-white/5">
          Explore demo mode (preview / dev only)
        </button>
        <p className="mt-4 text-[11px] leading-relaxed text-neutral-500">Authentication is handled at accounts.gothwadtech.com. Your password is never entered here.</p>
      </div>
    </div>
  );
}
