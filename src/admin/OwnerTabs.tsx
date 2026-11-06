// Publishing, users, the security log and the signed-in user's two-step sign-in.
import { useEffect, useState } from 'react';
import { t } from '../i18n';
import type { AdminSession, AdminUser, Client, SpeciesList } from './adminApi';

export function PublishTab({ api, data, canEdit, reload }: { api: Client; data: SpeciesList; canEdit: boolean; reload: () => void }) {
  const [msg, setMsg] = useState('');
  const p = data.pending;
  const n = p.added.length + p.changed.length + p.removed.length;
  return (
    <section className="form">
      <p>
        {data.version
          ? t(
              `Közzétett változat: ${data.version}. (${data.publishedAt?.slice(0, 16).replace('T', ' ')})`,
              `Published version: ${data.version} (${data.publishedAt?.slice(0, 16).replace('T', ' ')})`,
            )
          : t('Még nincs közzétett változat.', 'Nothing published yet.')}
      </p>
      {n ? (
        <ul className="admin-pending">
          <li>
            {t('Új', 'New')}: {p.added.length ? p.added.join(', ') : '–'}
          </li>
          <li>
            {t('Változott', 'Changed')}: {p.changed.length ? p.changed.join(', ') : '–'}
          </li>
          <li>
            {t('Törölve', 'Removed')}: {p.removed.length ? p.removed.join(', ') : '–'}
          </li>
        </ul>
      ) : (
        <p className="muted">{t('A piszkozat megegyezik a közzétett változattal.', 'The draft matches the published version.')}</p>
      )}
      {canEdit && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={!n}
          onClick={async () => {
            try {
              const r = await api.publish();
              setMsg(
                t(`Közzétéve: ${r.version}. változat. A tervezők a következő frissítéskor megkapják.`, `Published version ${r.version}. Planners get it at their next update.`),
              );
              reload();
            } catch (e) {
              setMsg((e as Error).message);
            }
          }}
        >
          {t(`Közzététel (${n} változás)`, `Publish (${n} changes)`)}
        </button>
      )}
      {msg && (
        <p className="mono" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}

const ROLE: Record<string, () => string> = { owner: () => t('tulajdonos', 'owner'), editor: () => t('szerkesztő', 'editor'), viewer: () => t('megtekintő', 'viewer') };

export function UsersTab({ api, me }: { api: Client; me: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [msg, setMsg] = useState('');
  const load = () =>
    api
      .users()
      .then((r) => setUsers(r.users))
      .catch((e: Error) => setMsg(e.message));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const act = (p: Promise<unknown>) => p.then(load).catch((e: Error) => setMsg(e.message));
  return (
    <section className="form">
      <table className="admin-table">
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className={u.disabled ? 'is-disabled' : ''}>
              <td>
                {u.email}
                {u.totp && <span className="admin-tag">2FA</span>}
              </td>
              <td>
                <select aria-label={t('Szerep', 'Role')} value={u.role} onChange={(e) => act(api.patchUser(u.id, { role: e.target.value as AdminUser['role'] }))}>
                  {Object.keys(ROLE).map((r) => (
                    <option key={r} value={r}>
                      {ROLE[r]()}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                {u.email !== me && (
                  <>
                    <button type="button" className="btn btn-small" onClick={() => act(api.patchUser(u.id, { disabled: !u.disabled }))}>
                      {u.disabled ? t('Engedélyezés', 'Enable') : t('Letiltás', 'Disable')}
                    </button>
                    <button type="button" className="btn btn-small btn-danger" onClick={() => confirm(t(`Törlöd: ${u.email}?`, `Delete ${u.email}?`)) && act(api.deleteUser(u.id))}>
                      {t('Törlés', 'Delete')}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        className="form-actions form-actions-start"
        onSubmit={(e) => {
          e.preventDefault();
          void act(api.addUser(email.trim(), role).then(() => setEmail('')));
        }}
      >
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('új felhasználó e-mail-címe', 'new user’s e-mail')} required />
        <select aria-label={t('Szerep', 'Role')} value={role} onChange={(e) => setRole(e.target.value)}>
          {Object.keys(ROLE).map((r) => (
            <option key={r} value={r}>
              {ROLE[r]()}
            </option>
          ))}
        </select>
        <button className="btn btn-small btn-primary">{t('Hozzáadás', 'Add')}</button>
      </form>
      {msg && (
        <p className="mono" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}

export function AuditTab({ api }: { api: Client }) {
  const [rows, setRows] = useState<Awaited<ReturnType<Client['audit']>>['entries']>([]);
  useEffect(() => {
    void api.audit().then((r) => setRows(r.entries));
  }, [api]);
  return (
    <section className="admin-scroll">
      <table className="admin-table mono">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.at.slice(0, 19).replace('T', ' ')}</td>
              <td>{r.action}</td>
              <td>{r.email ?? ''}</td>
              <td>{r.detail ?? ''}</td>
              <td>{r.ip ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function AccountTab({ api, session, onTotp }: { api: Client; session: AdminSession; onTotp: () => void }) {
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  return (
    <section className="form">
      <p>
        {session.user.email} · {ROLE[session.user.role]()} · {session.tenant.name}
      </p>
      <fieldset className="field-group">
        <legend>{t('Kétlépcsős belépés', 'Two-step sign-in')}</legend>
        {session.user.totp ? (
          <p>{t('Be van kapcsolva: belépéskor a hitelesítő alkalmazás kódját is kérjük.', 'On: signing in also asks for your authenticator app code.')}</p>
        ) : setup ? (
          <>
            <p>
              {t(
                'Add hozzá a kulcsot a hitelesítő alkalmazásodhoz (pl. Google Authenticator, Aegis), majd írd be az első kódot.',
                'Add the key to your authenticator app (e.g. Google Authenticator, Aegis), then enter the first code.',
              )}
            </p>
            <p className="mono admin-secret">{setup.secret}</p>
            <p className="muted mono admin-secret">{setup.uri}</p>
            <div className="form-actions form-actions-start">
              <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} aria-label={t('Kód', 'Code')} />
              <button
                type="button"
                className="btn btn-small btn-primary"
                onClick={() =>
                  api
                    .totpEnable(code.trim())
                    .then(() => {
                      setMsg(t('Bekapcsolva.', 'Switched on.'));
                      onTotp();
                    })
                    .catch((e: Error) => setMsg(e.message))
                }
              >
                {t('Bekapcsolás', 'Switch on')}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-small"
            onClick={() =>
              api
                .totpSetup()
                .then(setSetup)
                .catch((e: Error) => setMsg(e.message))
            }
          >
            {t('Beállítás', 'Set up')}
          </button>
        )}
        {msg && <p className="mono">{msg}</p>}
      </fieldset>
    </section>
  );
}
