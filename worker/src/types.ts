export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta?: {
    changes?: number;
    last_row_id?: number;
    rows_read?: number;
    rows_written?: number;
  };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
}

export interface R2ObjectBodyLike {
  body: ReadableStream | null;
  httpEtag?: string;
  size?: number;
}

export interface R2BucketLike {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBodyLike | null>;
  delete(key: string): Promise<void>;
}

export interface Env {
  DB?: D1Database;
  APK_BUCKET?: R2BucketLike;

  GITHUB_FILES_TOKEN?: string;
  GITHUB_STOREFILES_TOKEN?: string;
  GITHUB_FILES_OWNER?: string;
  GITHUB_FILES_REPO?: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;

  APP_NAME?: string;
  APP_SHORT_NAME?: string;
  ECOSYSTEM_NAME?: string;
  APP_DOMAIN?: string;
  STOREAPP_PACKAGE?: string;
  STORE_HOST?: string;
  CONSOLE_HOST?: string;
  ADMIN_HOST?: string;
  STOREAPP_HOST?: string;
  STORE_URL?: string;
  STORE_PUBLIC_URL?: string;
  CONSOLE_URL?: string;
  ADMIN_URL?: string;
  STOREAPP_URL?: string;

  AUTH_HUB_URL?: string;
  ACCOUNTS_API_URL?: string;
  AUTH_SIGNIN_URL?: string;
  ACCOUNTS_SIGNIN_URL?: string;
  ACCOUNTS_WEB_URL?: string;
  OAUTH_CLIENT_ID?: string;
  ADMIN_USERNAMES?: string;
  ALLOWED_ORIGINS?: string;
}

export interface AccountSlotItem {
  id: string;
  slot?: string;
  authuser: number;
  username: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  avatarUrl?: string | null;
  picture?: string | null;
  accountUrl?: string;
  lastUsedAt?: string;
  active?: boolean;
}

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  picture?: string;
  avatarUrl?: string;
}

export interface SessionResolution {
  user: AuthUser | null;
  activeSlot: string | null;
  authuser: number;
  accounts: AccountSlotItem[];
  accountUrl?: string;
  upstreamUnavailable?: boolean;
}

export type Row = Record<string, unknown>;
