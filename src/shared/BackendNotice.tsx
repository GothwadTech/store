import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react';
import { useApp } from '../lib/AppContext';
import { APP_NAME } from '../lib/config';

export function BackendNotice() {
  const { catalogStatus, isPreviewMode, isDemoUser, backendLive } = useApp();

  if (isPreviewMode) {
    const connecting = catalogStatus === 'loading';
    const message = isDemoUser && backendLive
      ? 'Demo account active: demo actions stay in this browser. The live catalog is read-only here, and no sample APKs are hosted.'
      : connecting
        ? 'Preview mode is active while the live catalog connects. Sample listings and demo actions are local to this browser.'
        : 'Preview mode: sample listings and demo actions are local to this browser. No sample APKs are hosted.';
    return (
      <div role={connecting ? 'status' : 'note'} className="mx-auto mt-4 flex max-w-7xl items-center gap-3 rounded-xl border border-sky-400/20 bg-sky-500/[0.07] px-4 py-3 text-sm text-sky-100">
        {connecting
          ? <LoaderCircle size={18} className="shrink-0 animate-spin text-sky-300" />
          : <AlertCircle size={18} className="shrink-0 text-sky-300" />}
        <p className="min-w-0 flex-1">{message}</p>
        {!connecting && (
          <button onClick={() => window.location.reload()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-200/20 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-100/10">
            <RefreshCw size={13} /> Try live catalog
          </button>
        )}
      </div>
    );
  }

  if (catalogStatus === 'ready') return null;
  const loading = catalogStatus === 'loading';
  const unconfigured = catalogStatus === 'unconfigured';
  const message = loading
    ? `Connecting to the ${APP_NAME}…`
    : unconfigured
      ? 'The Store catalog is not available yet. Please try again later.'
      : 'We could not connect to the Store. Check your connection and try again.';

  return (
    <div role={loading ? 'status' : 'alert'} className="mx-auto mt-4 flex max-w-7xl items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-100">
      {loading
        ? <LoaderCircle size={18} className="shrink-0 animate-spin text-amber-300" />
        : <AlertCircle size={18} className="shrink-0 text-amber-300" />}
      <p className="min-w-0 flex-1">{message}</p>
      {!loading && (
        <button onClick={() => window.location.reload()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-200/20 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-100/10">
          <RefreshCw size={13} /> Try again
        </button>
      )}
    </div>
  );
}
