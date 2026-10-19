import { isNative } from './platform';

/**
 * Base URL of the Forkful server: the website calls its own origin, the apps the hosted server
 * configured at build time (VITE_API_URL). Undefined in an app build without a server.
 */
export const API_BASE: string | undefined = isNative ? import.meta.env.VITE_API_URL : '';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  if (API_BASE === undefined) throw new ApiError('not_configured', 0);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('unreachable', 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? 'failed', res.status);
  return data;
}
