import { useCallback, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import type { StoreApp } from '../types';
import { formatCount } from '../lib/storage';
import { CATEGORY_LABELS } from '../data/categories';
import { handleOAuthCallback, startGothwadSignIn } from '../lib/auth';
import { ACCOUNTS_HOST, APP_SHORT_NAME } from '../lib/config';
import { useApp } from '../lib/AppContext';
export { AccountMenu } from './AccountMenu';

/** Chhoti helper - conditional class names jodne ke liye. */
export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export function Logo({ subtitle, compact = false }: { subtitle: string; compact?: boolean }) {
  return (
    <span className="flex select-none items-center gap-2.5">
      <img
        src="/assets/icon-192.png"
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-[10px] object-cover shadow-lg shadow-black/40 ring-1 ring-white/10"
      />
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-[16px] font-semibold tracking-tight text-white">{APP_SHORT_NAME}</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{subtitle}</span>
        </span>
      )}
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
  return CATEGORY_LABELS[slug] ?? slug;
}

// ════════════════ DESIGN SYSTEM (chaaro sites yahi use karti hain) ════════════════

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-emerald-500 text-[#08130e] font-semibold shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 active:bg-emerald-500',
  secondary:
    'border border-white/12 bg-white/[0.04] text-neutral-100 hover:bg-white/[0.08] hover:text-white',
  ghost: 'text-neutral-300 hover:bg-white/[0.06] hover:text-white',
  danger: 'bg-red-600 text-white font-semibold shadow-lg shadow-red-900/25 hover:bg-red-500',
  quiet: 'border border-white/10 bg-transparent text-neutral-300 hover:border-white/20 hover:text-white',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 px-3.5 text-[13px]',
  md: 'h-11 gap-2 px-5 text-sm',
  lg: 'h-12 gap-2 px-6 text-[15px]',
};

export const BUTTON_BASE =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition duration-150 disabled:cursor-not-allowed disabled:opacity-45';

/** Purane call sites (Console/Admin) inhi class strings ko use karte hain. */
export const btnPrimary = cx(BUTTON_BASE, BUTTON_VARIANTS.primary, BUTTON_SIZES.sm, 'rounded-lg');
export const btnGhost = cx(BUTTON_BASE, BUTTON_VARIANTS.secondary, BUTTON_SIZES.sm);
export const btnDanger = cx(BUTTON_BASE, BUTTON_VARIANTS.danger, BUTTON_SIZES.sm);

export function Button({
  variant = 'primary',
  size = 'md',
  pill = false,
  full = false,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  full?: boolean;
}) {
  return (
    <button
      {...rest}
      className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], pill && 'rounded-full', full && 'w-full', className)}
    >
      {children}
    </button>
  );
}

export function Card({
  title,
  desc,
  action,
  children,
  className,
  bodyClassName,
  flush = false,
}: {
  title?: string;
  desc?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
}) {
  return (
    <section className={cx('overflow-hidden rounded-2xl border border-white/[0.08] bg-[#262626]/85 shadow-xl shadow-black/20', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="font-display text-[15px] font-semibold tracking-tight text-white">{title}</h2>}
            {desc && <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-400">{desc}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cx(flush ? '' : 'px-5 py-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-[22px] font-bold tracking-tight text-white sm:text-[27px]">{title}</h1>
        {desc && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-neutral-400">{desc}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'emerald',
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: typeof Star;
  tone?: 'emerald' | 'red' | 'amber' | 'sky' | 'neutral';
}) {
  const tones = {
    emerald: 'bg-emerald-500/12 text-emerald-300',
    red: 'bg-red-500/12 text-red-300',
    amber: 'bg-amber-500/12 text-amber-300',
    sky: 'bg-sky-500/12 text-sky-300',
    neutral: 'bg-white/[0.07] text-neutral-300',
  } as const;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#262626]/85 p-4 transition hover:border-white/[0.14] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
        {Icon && <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-lg', tones[tone])}><Icon size={16} /></span>}
      </div>
      <p className="mt-2.5 font-display text-[26px] font-bold leading-none text-white tabular-nums sm:text-[30px]">{value}</p>
      {sub && <p className="mt-2 text-xs leading-relaxed text-neutral-500">{sub}</p>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  desc,
  action,
  className,
}: {
  icon?: typeof Star;
  title: string;
  desc?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col items-center px-6 py-14 text-center', className)}>
      {Icon && (
        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-neutral-400">
          <Icon size={24} />
        </span>
      )}
      <p className="mt-4 font-display text-[15px] font-semibold text-white">{title}</p>
      {desc && <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-neutral-500">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cx('skeleton block rounded-lg', className)} aria-hidden="true" />;
}

export function Pill({ children, tone = 'neutral', className }: { children: React.ReactNode; tone?: 'neutral' | 'emerald' | 'amber' | 'red' | 'sky'; className?: string }) {
  const tones = {
    neutral: 'bg-white/[0.06] text-neutral-300 ring-white/10',
    emerald: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/25',
    amber: 'bg-amber-500/15 text-amber-300 ring-amber-400/25',
    red: 'bg-red-500/15 text-red-300 ring-red-400/25',
    sky: 'bg-sky-500/15 text-sky-300 ring-sky-400/25',
  } as const;
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1', tones[tone], className)}>{children}</span>;
}

export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={cx('grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 font-display font-bold text-[#08130e]', className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────
type Toast = { id: number; message: string; tone: 'info' | 'success' | 'error' };

export function useToast(timeout = 4500) {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    setToast({ id: Date.now(), message, tone });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), timeout);
    return () => window.clearTimeout(timer);
  }, [toast, timeout]);
  const node = toast ? (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'toast-in fixed bottom-24 left-1/2 z-[70] w-[min(92vw,26rem)] -translate-x-1/2 rounded-xl px-4 py-3 text-sm shadow-2xl shadow-black/50 ring-1 backdrop-blur-xl lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0',
        toast.tone === 'error'
          ? 'bg-red-950/85 text-red-100 ring-red-400/30'
          : toast.tone === 'success'
            ? 'bg-emerald-950/85 text-emerald-100 ring-emerald-400/30'
            : 'bg-[#2a2a2a]/95 text-neutral-100 ring-white/12',
      )}
    >
      <div className="flex items-start gap-2.5">
        <p className="min-w-0 flex-1 leading-relaxed">{toast.message}</p>
        <button onClick={() => setToast(null)} className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 hover:text-white">
          Close
        </button>
      </div>
    </div>
  ) : null;
  return { show, node };
}

// ── OAuth Callback view ───────────────────────────────────────────────
export function AuthCallbackView({ onDone }: { onDone: () => void }) {
  const { setUser } = useApp();
  const [msg, setMsg] = useState('Returning from Gothwad Accounts…');
  useEffect(() => {
    void handleOAuthCallback().then((r) => {
      if ('user' in r) {
        setUser(r.user);
        setMsg('Signed in! Opening dashboard…');
        window.setTimeout(onDone, 600);
      } else {
        setMsg(`We could not sign you in (${r.error}).`);
      }
    });
  }, [onDone, setUser]);
  return <main className="mx-auto max-w-md px-4 py-24 text-center text-neutral-300">{msg}</main>;
}

// ── Tabs (Console/Admin/App detail) ───────────────────────────────────
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={cx('no-scrollbar flex gap-1 overflow-x-auto border-b border-white/[0.08]', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            'relative shrink-0 px-4 py-2.5 text-sm transition',
            value === t.id ? 'font-semibold text-white' : 'text-neutral-400 hover:text-neutral-200',
          )}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className={cx('ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold', value === t.id ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.07] text-neutral-400')}>
              {t.count}
            </span>
          )}
          {value === t.id && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-emerald-500" />}
        </button>
      ))}
    </div>
  );
}

// ── Mobile drawer (Console/Admin sidebar phone par) ───────────────────
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[65] lg:hidden">
      <button aria-label="Close menu" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="fade-up absolute inset-y-0 left-0 flex w-[min(84vw,20rem)] flex-col border-r border-white/[0.08] bg-[#1b1b1b] shadow-2xl shadow-black/60">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
          {title && <p className="font-display text-sm font-semibold text-white">{title}</p>}
          <button onClick={onClose} className="rounded-lg p-2 text-neutral-400 hover:bg-white/5 hover:text-white" aria-label="Close menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ── Shared site footer ────────────────────────────────────────────────
export function SiteFooter({ note, children }: { note?: string; children?: React.ReactNode }) {
  return (
    <footer className="mt-auto border-t border-white/[0.06] bg-[#1e1e1e]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 text-[13px] text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="leading-relaxed">
          <b className="font-display font-semibold text-neutral-300">{APP_SHORT_NAME}</b>
          {note ? ` · ${note}` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">{children}</div>
      </div>
    </footer>
  );
}

export function AppCard({ app, onOpen }: { app: StoreApp; onOpen: (a: StoreApp) => void }) {
  return (
    <button onClick={() => onOpen(app)} className="group w-[112px] shrink-0 text-left sm:w-[136px]">
      <span className="block overflow-hidden rounded-[22%] shadow-lg shadow-black/30 ring-1 ring-white/10 transition duration-200 group-hover:-translate-y-0.5 group-hover:ring-emerald-400/40">
        <AppIcon app={app} size={136} rounded="rounded-none" />
      </span>
      <span className="mt-2 line-clamp-1 block text-[13px] font-medium text-neutral-100">{app.name}</span>
      <span className="line-clamp-1 block text-[11px] text-neutral-400">{categoryName(app.category)}</span>
      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-400">
        {app.ratingAvg.toFixed(1)} <Star size={10} className="fill-neutral-400 text-neutral-400" /> · {formatCount(app.downloadsCount)}
      </span>
    </button>
  );
}

export function AppRow({ app, rank, onOpen }: { app: StoreApp; rank?: number; onOpen: (a: StoreApp) => void }) {
  return (
    <button onClick={() => onOpen(app)} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.05]">
      {rank !== undefined && <span className="w-6 shrink-0 text-center font-display text-lg font-bold text-neutral-500 tabular-nums">{rank}</span>}
      <AppIcon app={app} size={48} rounded="rounded-xl" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 block text-sm font-medium text-neutral-100">{app.name}</span>
        <span className="line-clamp-1 block text-xs text-neutral-400">{app.shortDesc || categoryName(app.category)}</span>
        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-400">
          {app.ratingAvg.toFixed(1)} <Star size={10} className="fill-neutral-400 text-neutral-400" /> · {formatCount(app.downloadsCount)} downloads
        </span>
      </span>
      <span className="shrink-0 text-neutral-600 transition group-hover:text-neutral-400" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6" /></svg>
      </span>
    </button>
  );
}

export function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4 px-1">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-neutral-400">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function SignInPrompt({ what }: { what: string }) {
  const { demoModeAvailable, signInDemo } = useApp();
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="fade-up rounded-3xl border border-white/10 bg-[#262626] p-8 shadow-2xl shadow-black/40">
        <div className="flex justify-center"><Logo subtitle={what} /></div>
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-white">Sign in with your Gothwad Account</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          One Gothwad Account for Mail, Drive, Store, and more. Sign in to continue to {what}.
        </p>
        <button
          onClick={() => { void startGothwadSignIn(); }}
          className="mt-6 w-full rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-[#08130e] shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
        >
          Sign in with Gothwad
        </button>
        {demoModeAvailable && (
          <button onClick={signInDemo} className="mt-2.5 w-full rounded-lg border border-white/15 px-5 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-white/5">
            Explore demo mode (preview / dev only)
          </button>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-neutral-500">Authentication is handled at {ACCOUNTS_HOST}. Your password is never entered here.</p>
      </div>
    </div>
  );
}
