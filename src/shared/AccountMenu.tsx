import { useEffect, useRef } from 'react';
import {
  accountsApiOrigin,
  accountsWebOrigin,
  buildSignInUrl,
  manageAccountUrl,
} from '../lib/auth';
import { BRAND, SITE_URLS, detectMode } from '../lib/config';
import { useApp } from '../lib/AppContext';
import {
  ensureGothwadAccountMenu,
  type WidgetAccountItem,
  type WidgetExtraAction,
} from './gothwadAccountMenuFallback';
import { Avatar } from './ui';

export function AccountMenu({
  size = 36,
  showSignIn = false,
}: {
  size?: number;
  showSignIn?: boolean;
}) {
  const { user, accounts, activeSlot, authuser, isAdmin, switchAccount, signOutSlot, signOut } = useApp();
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    void ensureGothwadAccountMenu();
  }, []);

  if (!user) {
    if (!showSignIn) return null;
    return (
      <a
        href={buildSignInUrl()}
        className="inline-flex items-center justify-center rounded-full bg-[#a8c7fa] px-4 py-1.5 text-sm font-medium text-[#062e6f] transition hover:bg-[#c2d7fa]"
      >
        Sign in
      </a>
    );
  }

  const avatarSrc = user.avatarUrl || user.picture;

  const handleOpen = async () => {
    const widget = await ensureGothwadAccountMenu();
    if (widget.isOpen?.()) {
      widget.close();
      return;
    }

    const mappedAccounts: WidgetAccountItem[] = (
      accounts.length > 0
        ? accounts
        : [
            {
              id: activeSlot || user.id,
              slot: activeSlot || user.id,
              authuser,
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              name: user.name,
              email: user.email,
              avatarUrl: avatarSrc ?? null,
              active: true,
            },
          ]
    ).map((acc, idx) => {
      const fullName = acc.name || acc.username;
      const parts = fullName.split(' ');
      return {
        id: acc.id || acc.slot || String(idx),
        authuser: typeof acc.authuser === 'number' ? acc.authuser : idx,
        username: acc.username,
        firstName: acc.firstName || parts[0] || acc.username,
        lastName: acc.lastName || parts.slice(1).join(' ') || '',
        name: fullName,
        email: acc.email,
        avatarUrl: acc.avatarUrl || acc.picture || null,
        active: Boolean(acc.active),
      };
    });

    const userParts = (user.name || user.username).split(' ');
    const currentUserItem: WidgetAccountItem = {
      id: activeSlot || user.id,
      authuser,
      username: user.username,
      firstName: user.firstName || userParts[0] || user.username,
      lastName: user.lastName || userParts.slice(1).join(' ') || '',
      name: user.name,
      email: user.email,
      avatarUrl: avatarSrc ?? null,
      active: true,
    };

    const mode = detectMode();
    const extraActions: WidgetExtraAction[] = [];
    if (mode !== 'store') {
      extraActions.push({ id: 'store', label: `${BRAND.storeName}`, href: SITE_URLS.store });
    }
    if (mode !== 'console') {
      extraActions.push({ id: 'console', label: `${BRAND.consoleName}`, href: SITE_URLS.console });
    }
    if (isAdmin && mode !== 'admin') {
      extraActions.push({ id: 'admin', label: `${BRAND.adminName}`, href: SITE_URLS.admin });
    }

    widget.open(
      {
        user: currentUserItem,
        accounts: mappedAccounts,
        activeId: activeSlot || mappedAccounts.find((a) => a.active)?.id || user.id,
        authuser,
      },
      {
        anchorEl: btnRef.current,
        appDomain: BRAND.appDomain,
        accountsWebOrigin: accountsWebOrigin(),
        accountsApiOrigin: accountsApiOrigin(),
        ecosystemName: BRAND.ecosystemName,
        authuser,
        nextUrl: window.location.href,
        manageAccountHref: manageAccountUrl(authuser),
        extraActions,
        onSwitchAccount: async (acc) => {
          await switchAccount({ id: acc.id, authuser: acc.authuser });
        },
        onSignOutAccount: async (acc) => {
          await signOutSlot(acc.id);
        },
        onSignOutAll: async () => {
          await signOut();
        },
      },
    );
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => void handleOpen()}
        aria-haspopup="dialog"
        aria-label={`Account menu (${user.email})`}
        title={`${user.name} (${user.email})`}
        className="grid place-items-center overflow-hidden rounded-full ring-2 ring-white/10 transition hover:ring-emerald-400/60"
        style={{ width: size, height: size }}
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={user.name}
            width={size}
            height={size}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <Avatar name={user.name} size={size} />
        )}
      </button>
    </div>
  );
}
