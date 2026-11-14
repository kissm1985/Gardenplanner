// Anonymous usage statistics and error reports (PL-ANA-01), only with the user's consent and only when the build is
// configured with a statistics server (an Umami-compatible endpoint, ideally self-hosted in the EU). No cookies, no
// user or device id, no plan contents: an event name and a few coarse values. Without consent nothing is sent.

const ENDPOINT = (import.meta.env?.VITE_ANALYTICS_URL as string | undefined) || '';
const SITE = (import.meta.env?.VITE_ANALYTICS_SITE as string | undefined) || '';
const KEY = 'kerttervezo.consent';

export type Consent = 'yes' | 'no' | null;

/** A statistics server is set for this build. */
export const analyticsConfigured = () => !!ENDPOINT && !!SITE;

export function getConsent(): Consent {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'yes' || v === 'no' ? v : null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
export function setConsent(v: 'yes' | 'no') {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* this session only */
  }
  listeners.forEach((f) => f());
}
export function onConsentChange(f: () => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** "50–100" style bands, so exact counts never leave the device. */
export function band(n: number): string {
  const steps = [0, 1, 10, 50, 100, 250, 500, 1000];
  for (let i = steps.length - 1; i >= 0; i--) if (n >= steps[i]) return i === steps.length - 1 ? `${steps[i]}+` : `${steps[i]}–${steps[i + 1] - 1}`;
  return '0';
}

/** The events the app may send (see docs/legal: the privacy notice lists them). */
export type EventName = 'app_start' | 'area_created' | 'example_used' | 'plant_placed' | 'idea_generated' | 'list_opened' | 'export' | 'visual_sent' | 'quote_requested' | 'error';

export interface Sent {
  name: EventName;
  data?: Record<string, string | number | boolean>;
}
/** Last events, for tests and for the user to see what is sent. */
export const recent: Sent[] = [];

export function track(name: EventName, data?: Sent['data']): boolean {
  if (!analyticsConfigured() || getConsent() !== 'yes') return false;
  const payload = {
    type: 'event',
    payload: { website: SITE, name, data, url: '/', hostname: location.hostname, language: document.documentElement.lang, screen: `${screen.width}x${screen.height}` },
  };
  recent.push({ name, data });
  if (recent.length > 50) recent.shift();
  try {
    const body = JSON.stringify(payload);
    if (!navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'application/json' })))
      void fetch(ENDPOINT, { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
  } catch {
    /* statistics never break the app */
  }
  return true;
}

let installed = false;
/** Unhandled errors as "error" events (with consent): version and the first line of the message only. */
export function installErrorReporting(version: string) {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const report = (msg: unknown) =>
    track('error', {
      v: version,
      msg: String(msg ?? '')
        .split('\n')[0]
        .slice(0, 120),
    });
  window.addEventListener('error', (e) => report(e.message));
  window.addEventListener('unhandledrejection', (e) => report((e.reason as Error)?.message ?? e.reason));
}
