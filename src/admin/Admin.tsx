// The nursery's catalogue admin (PL-BE-02): species and offers, price list import, publishing, users, security log.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { t, useLang, setLang, getLang } from '../i18n';
import { AdminError, client, loadSession, saveSession, type SpeciesList } from './adminApi';
import { ImportTab } from './ImportTab';
import { Login } from './Login';
import { AccountTab, AuditTab, PublishTab, UsersTab } from './OwnerTabs';
import { SpeciesTab } from './SpeciesTab';

type Tab = 'species' | 'import' | 'publish' | 'users' | 'audit' | 'account';

export function Admin() {
  useLang();
  const [session, setSession] = useState(loadSession);
  const [tab, setTab] = useState<Tab>('species');
  const [data, setData] = useState<SpeciesList | null>(null);
  const [msg, setMsg] = useState('');
  const api = useMemo(() => (session ? client(session) : null), [session]);

  const signOut = useCallback(() => {
    saveSession(null);
    setSession(null);
    setData(null);
  }, []);
  const reload = useCallback(() => {
    if (!api) return;
    api
      .species()
      .then((d) => {
        setData(d);
        setMsg('');
      })
      .catch((e: Error) => {
        if (e instanceof AdminError && e.status === 401) signOut();
        else if (e instanceof AdminError && e.body.totpSetup) setTab('account');
        setMsg(e.message);
      });
  }, [api, signOut]);
  useEffect(reload, [reload]);

  if (!session || !api)
    return (
      <Login
        onIn={(s) => {
          saveSession(s);
          setSession(s);
        }}
      />
    );
  const canEdit = session.user.role !== 'viewer';
  const owner = session.user.role === 'owner';
  const tabs: [Tab, string][] = [
    ['species', t('Fajok', 'Species')],
    ...(canEdit ? ([['import', t('Árlista importálása', 'Import price list')]] as [Tab, string][]) : []),
    ['publish', t('Közzététel', 'Publish')],
    ...(owner
      ? ([
          ['users', t('Felhasználók', 'Users')],
          ['audit', t('Napló', 'Log')],
        ] as [Tab, string][])
      : []),
    ['account', t('Fiók', 'Account')],
  ];
  const pendingN = data ? data.pending.added.length + data.pending.changed.length + data.pending.removed.length : 0;
  return (
    <div className="admin">
      <header className="admin-head">
        <b>{session.tenant.name}</b>
        <span className="muted"> · {t('katalógus', 'catalogue')}</span>
        <span className="spacer" />
        <button type="button" className="btn btn-small" onClick={() => setLang(getLang() === 'hu' ? 'en' : 'hu')}>
          {getLang() === 'hu' ? 'EN' : 'HU'}
        </button>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            void api.logout().catch(() => {});
            signOut();
          }}
        >
          {t('Kilépés', 'Sign out')}
        </button>
      </header>
      <nav className="admin-tabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`btn btn-small${tab === k ? ' btn-primary' : ''}`} onClick={() => setTab(k)}>
            {label}
            {k === 'publish' && pendingN > 0 ? ` (${pendingN})` : ''}
          </button>
        ))}
      </nav>
      {msg && (
        <p className="warn-box" role="alert">
          {msg}
        </p>
      )}
      <main className="admin-main">
        {tab === 'species' && data && <SpeciesTab api={api} data={data} canEdit={canEdit} reload={reload} />}
        {tab === 'import' && <ImportTab api={api} onDone={reload} />}
        {tab === 'publish' && data && <PublishTab api={api} data={data} canEdit={canEdit} reload={reload} />}
        {tab === 'users' && <UsersTab api={api} me={session.user.email} />}
        {tab === 'audit' && <AuditTab api={api} />}
        {tab === 'account' && (
          <AccountTab
            api={api}
            session={session}
            onTotp={() => {
              const s = { ...session, user: { ...session.user, totp: true } };
              saveSession(s);
              setSession(s);
            }}
          />
        )}
      </main>
    </div>
  );
}
