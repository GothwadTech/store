import { useEffect, useRef, useState } from 'react';
import { ExternalLink, LogOut, Plus } from 'lucide-react';
import { addAccountUrl, manageAccountUrl } from '../lib/auth';
import { useApp } from '../lib/AppContext';
import { Avatar } from './ui';

export function AccountMenu({ size = 36 }: { size?: number }) {
  const { user, accounts, authuser, switchAccount, signOut } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onClick); window.removeEventListener('keydown', onKey); };
  }, [open]);
  if (!user) return null;
  const avatarSrc = user.picture || user.avatarUrl;
  const otherAccounts = accounts.filter((a) => a.username.toLowerCase() !== user.username.toLowerCase());
  return (
    <div className="relative shrink-0" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu"
        className="grid overflow-hidden place-items-center rounded-full ring-2 ring-white/10 transition hover:ring-emerald-400/50"
        style={{ width: size, height: size }}>
        {avatarSrc ? (
          <img src={avatarSrc} alt={user.name} width={size} height={size} className="h-full w-full rounded-full object-cover" />
        ) : (
          <Avatar name={user.name} size={size} />
        )}
      </button>
      {open && (
        <div role="menu" className="fade-up absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 overflow-hidden rounded-xl border border-white/10 bg-[#262626] shadow-2xl shadow-black/60">
          <div className="border-b border-white/[0.06] px-4 py-3.5">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <p className="truncate text-xs text-neutral-400">@{user.username}</p>
            <p className="truncate text-xs text-neutral-500">{user.email}</p>
            <a href={manageAccountUrl(authuser)} target="_blank" rel="noreferrer" className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-2.5 py-1 text-[11px] font-medium text-neutral-200 transition hover:bg-white/[0.06]">
              Manage Gothwad Account <ExternalLink size={11} />
            </a>
          </div>
          {otherAccounts.length > 0 && (
            <div className="border-b border-white/[0.06] py-1">
              <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Switch account</p>
              {otherAccounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => { setOpen(false); void switchAccount({ id: acc.id, authuser: acc.authuser }); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-xs text-neutral-300 transition hover:bg-white/[0.05] hover:text-white"
                >
                  {acc.avatarUrl || acc.picture ? (
                    <img src={(acc.avatarUrl || acc.picture)!} alt="" width={24} height={24} className="h-6 w-6 shrink-0 rounded-full object-cover" />
                  ) : (
                    <Avatar name={acc.name || acc.username} size={24} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-white">{acc.name || acc.username}</span>
                    <span className="block truncate text-[11px] text-neutral-500">{acc.email}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <a href={addAccountUrl()} className="flex w-full items-center gap-2.5 border-b border-white/[0.06] px-4 py-2.5 text-left text-xs font-medium text-neutral-300 transition hover:bg-white/[0.05] hover:text-white">
            <Plus size={14} /> Add another account
          </a>
          <button onClick={signOut} className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm text-neutral-300 transition hover:bg-white/[0.05] hover:text-white">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
