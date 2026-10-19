export class StravaError extends Error {
  status: number;
}
export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch seconds. */
  expiresAt: number;
  athlete?: { id: number; name: string };
}
export interface StravaActivity {
  id: number;
  sportType: string;
  start: string;
  movingTime: number;
  elapsedTime: number;
  distance?: number;
  kilojoules?: number;
  calories?: number;
  averageHeartrate?: number;
  elevationGain?: number;
}
type Fetch = typeof fetch;
export function stravaConfig(host?: string): { configured: boolean; clientId?: string; callbackDomain?: string };
export function exchangeCode(code: string, fetchImpl?: Fetch): Promise<StravaTokens>;
export function refreshTokens(refreshToken: string, fetchImpl?: Fetch): Promise<StravaTokens>;
export function listActivities(accessToken: string, after?: number, fetchImpl?: Fetch): Promise<StravaActivity[]>;
export function deauthorize(accessToken: string, fetchImpl?: Fetch): Promise<void>;
