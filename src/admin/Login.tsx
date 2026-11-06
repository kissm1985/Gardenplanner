// Sign-in to the catalogue admin: nursery id and e-mail → one-time code by e-mail → (if set up) authenticator code.
import { useState } from 'react';
import { t } from '../i18n';
import { normalizeServer } from '../engine/catalogSync';
import { EMAIL_RE, SLUG_RE } from '../engine/catalog';
import { type AdminSession, AdminError, call } from './adminApi';

export const defaultAdminServer = () => (import.meta.env.VITE_API_ORIGIN as string | undefined) || location.origin;

export function Login({ onIn }: { onIn: (s: AdminSession) => void }) {
  const [server, setServer] = useState('');
  const [tenant, setTenant] = useState(() => new URLSearchParams(location.search).get('t') ?? '');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [totp, setTotp] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [needTotp, setNeedTotp] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const base = () => normalizeServer(server) || defaultAdminServer();

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    if (normalizeServer(server) === null) return setMsg(t('A szerver címe https:// kezdetű legyen.', 'The server address must start with https://.'));
    if (!SLUG_RE.test(tenant.trim())) return setMsg(t('Add meg a kertészet azonosítóját.', 'Enter the nursery id.'));
    if (!EMAIL_RE.test(email.trim())) return setMsg(t('Add meg az e-mail-címedet.', 'Enter your e-mail address.'));
    setBusy(true);
    try {
      await call(base(), '/api/v1/auth/request', { body: { tenant: tenant.trim(), email: email.trim() } });
      setStep('code');
      setMsg(
        t('Ha a cím szerepel a kertészet felhasználói között, 10 percen belül megérkezik a kód.', 'If the address belongs to the nursery, the code arrives within 10 minutes.'),
      );
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const r = await call<Omit<AdminSession, 'server'>>(base(), '/api/v1/auth/verify', {
        body: { tenant: tenant.trim(), email: email.trim(), code: code.trim(), ...(needTotp ? { totp: totp.trim() } : {}) },
      });
      onIn({ ...r, server: base() });
    } catch (err) {
      if (err instanceof AdminError && err.body.totp) setNeedTotp(true);
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-login">
      <h1>{t('Planterra – kertészeti katalógus', 'Planterra – nursery catalogue')}</h1>
      {step === 'email' ? (
        <form className="form" onSubmit={request}>
          <label className="field">
            <span>{t('Kertészet azonosítója', 'Nursery id')}</span>
            <input value={tenant} onChange={(e) => setTenant(e.target.value.toLowerCase())} autoCapitalize="none" spellCheck={false} required />
          </label>
          <label className="field">
            <span>{t('E-mail-cím', 'E-mail address')}</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <details>
            <summary>{t('Szerver', 'Server')}</summary>
            <label className="field">
              <span>{t('Szerver címe (üresen: ez az oldal)', 'Server address (empty: this site)')}</span>
              <input value={server} onChange={(e) => setServer(e.target.value)} placeholder={defaultAdminServer()} inputMode="url" />
            </label>
          </details>
          <button className="btn btn-primary" disabled={busy}>
            {t('Belépési kód kérése', 'Send me a sign-in code')}
          </button>
        </form>
      ) : (
        <form className="form" onSubmit={verify}>
          <label className="field">
            <span>{t('Az e-mailben kapott 6 jegyű kód', 'The 6-digit code from the e-mail')}</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
          </label>
          {needTotp && (
            <label className="field">
              <span>{t('A hitelesítő alkalmazás kódja', 'Authenticator app code')}</span>
              <input value={totp} onChange={(e) => setTotp(e.target.value)} inputMode="numeric" maxLength={6} required />
            </label>
          )}
          <div className="form-actions form-actions-start">
            <button className="btn btn-primary" disabled={busy}>
              {t('Belépés', 'Sign in')}
            </button>
            <button type="button" className="btn" onClick={() => setStep('email')}>
              {t('Vissza', 'Back')}
            </button>
          </div>
        </form>
      )}
      {msg && (
        <p className="mono" role="status">
          {msg}
        </p>
      )}
      <p className="muted">
        <a href="./">{t('Vissza a tervezőhöz', 'Back to the planner')}</a>
      </p>
    </main>
  );
}
