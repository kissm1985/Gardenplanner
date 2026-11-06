// Client for the Planterra backend (Pro tier). The app works without it; a server address is set only when a
// nursery connects its catalogue. Requests carry the session token; nothing is sent while no server is set.

const SERVER = 'kerttervezo.server';
const TOKEN = 'kerttervezo.serverToken';

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {
    /* this session only */
  }
};

/** Base URL of the connected server, or null. */
export const apiBase = () => read(SERVER);
export const setApiBase = (url: string | null) => write(SERVER, url ? url.replace(/\/+$/, '') : null);
export const apiToken = () => read(TOKEN);
export const setApiToken = (tok: string | null) => write(TOKEN, tok);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}, base = apiBase()): Promise<T> {
  if (!base) throw new ApiError(0, 'no server');
  const tok = apiToken();
  const res = await fetch(base + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}), ...init.headers },
  });
  const body = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, typeof body === 'object' && body && 'error' in body ? String((body as { error: string }).error) : res.statusText);
  return body as T;
}

export async function sendFeedback(f: { kind: string; text: string; tech?: string }): Promise<boolean> {
  await api('/api/v1/feedback', { method: 'POST', body: JSON.stringify(f) });
  return true;
}
