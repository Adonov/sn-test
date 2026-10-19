// Strava connection. The client secret stays on the server: it exchanges the authorization code
// for tokens and refreshes them. Activity requests are passed through so the website avoids CORS.
// Nothing from Strava is stored on the server.

const STRAVA = 'https://www.strava.com';

export class StravaError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.status = status;
  }
}

function credentials() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new StravaError('not_configured', 503);
  return { clientId, clientSecret };
}

/** What the app needs to start the authorization (no secret). */
export function stravaConfig(hostHeader) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId || !process.env.STRAVA_CLIENT_SECRET) return { configured: false };
  // Must equal the "Authorization Callback Domain" of the Strava API application.
  const callbackDomain = process.env.STRAVA_CALLBACK_DOMAIN || String(hostHeader ?? '').split(':')[0] || 'localhost';
  return { configured: true, clientId, callbackDomain };
}

/** Only the fields the app uses, so tokens and athlete data stay minimal. */
function tokens(data) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    athlete: data.athlete ? { id: data.athlete.id, name: [data.athlete.firstname, data.athlete.lastname].filter(Boolean).join(' ') } : undefined,
  };
}

async function tokenRequest(params, fetchImpl) {
  const { clientId, clientSecret } = credentials();
  const res = await fetchImpl(`${STRAVA}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, ...params }),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 400 || res.status === 401) throw new StravaError('strava_denied', 401);
  if (!res.ok) throw new StravaError('strava_failed', 502);
  return tokens(await res.json());
}

export function exchangeCode(code, fetchImpl = fetch) {
  if (typeof code !== 'string' || !code) throw new StravaError('invalid');
  return tokenRequest({ code, grant_type: 'authorization_code' }, fetchImpl);
}

export function refreshTokens(refreshToken, fetchImpl = fetch) {
  if (typeof refreshToken !== 'string' || !refreshToken) throw new StravaError('invalid');
  return tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' }, fetchImpl);
}

/** The athlete's activities since `after` (epoch seconds), newest first. */
export async function listActivities(accessToken, after, fetchImpl = fetch) {
  if (!accessToken) throw new StravaError('strava_denied', 401);
  const since = Number(after) > 0 ? Math.floor(Number(after)) : Math.floor(Date.now() / 1000) - 28 * 86_400;
  const res = await fetchImpl(`${STRAVA}/api/v3/athlete/activities?after=${since}&per_page=100`, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401) throw new StravaError('strava_denied', 401);
  if (res.status === 429) throw new StravaError('rate_limited', 429);
  if (!res.ok) throw new StravaError('strava_failed', 502);
  const list = await res.json();
  return (Array.isArray(list) ? list : []).map((a) => ({
    id: a.id,
    sportType: a.sport_type ?? a.type,
    start: a.start_date,
    movingTime: a.moving_time,
    elapsedTime: a.elapsed_time,
    distance: a.distance,
    kilojoules: a.kilojoules,
    calories: a.calories,
    averageHeartrate: a.average_heartrate,
    elevationGain: a.total_elevation_gain,
  }));
}

export async function deauthorize(accessToken, fetchImpl = fetch) {
  if (!accessToken) return;
  await fetchImpl(`${STRAVA}/oauth/deauthorize`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {});
}
