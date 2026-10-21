import { Capacitor } from '@capacitor/core';
import { API_BASE, ApiError } from './api';

const MAX_REPORTS = 10;
const sent = new Set<string>();

export interface ErrorReport {
  kind: 'error' | 'rejection' | 'render';
  message: string;
  stack?: string;
  route: string;
  platform: string;
}

/** What gets sent: no recipe or diary contents, only the error and the screen it happened on. */
export function describeError(kind: ErrorReport['kind'], error: unknown): ErrorReport | undefined {
  // Expected failures (offline, server errors) are shown to the user and need no report.
  if (error instanceof ApiError) return undefined;
  const err = error instanceof Error ? error : undefined;
  const message = (err ? `${err.name}: ${err.message}` : String(error)).slice(0, 500);
  if (!message || /ResizeObserver loop/.test(message)) return undefined;
  return {
    kind,
    message,
    stack: err?.stack?.slice(0, 4000),
    // Ids in the route say nothing about the user; drop them anyway to keep reports comparable.
    route: (globalThis.location?.hash ?? '').replace(/\/[\w-]{16,}/g, '/:id').slice(0, 100),
    platform: Capacitor.getPlatform(),
  };
}

/** Sends an unexpected error to the Taisty server's log (each distinct one once, at most a few per session). */
export function reportError(kind: ErrorReport['kind'], error: unknown): void {
  const report = describeError(kind, error);
  if (!report || API_BASE === undefined || sent.size >= MAX_REPORTS || sent.has(report.message)) return;
  sent.add(report.message);
  fetch(`${API_BASE}/api/errors`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(report),
    keepalive: true,
  }).catch(() => {});
}

export function setupErrorReporting(): void {
  window.addEventListener('error', (e) => reportError('error', e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => reportError('rejection', e.reason));
}
