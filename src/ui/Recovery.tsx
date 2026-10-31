import { Component, type ReactNode } from 'react';
import { t } from '../i18n';
import { useProject } from '../store/projectStore';
import { clearProject } from '../store/persist';
import { downloadText } from './download';

const stamp = () => new Date().toISOString().slice(0, 10);

/**
 * Shown when the saved plan cannot be read, or the app hit an error while drawing.
 * The plan can always be downloaded first; starting over is a separate, confirmed step.
 */
export function RecoveryScreen({ message, data, onRetry }: { message: string; data: unknown; onRetry?: () => void }) {
  const save = () => downloadText(`planterra-mentes-${stamp()}.json`, JSON.stringify(data ?? null, null, 2), 'application/json');
  return (
    <main className="welcome recovery" role="alert">
      <h1>{t('Valami elromlott', 'Something went wrong')}</h1>
      <p className="lead">
        {t(
          'A terv nem jeleníthető meg. Először töltsd le a mentést: abból később is visszaállítható, vagy elküldheted hibajelentésként.',
          'The plan cannot be shown. Download the backup first: it can be restored later, or sent along with a bug report.',
        )}
      </p>
      <p className="mono muted recovery-msg">{message}</p>
      <div className="form-actions form-actions-start">
        <button type="button" className="btn btn-primary" onClick={save} disabled={!data}>
          {t('Terv letöltése (JSON)', 'Download the plan (JSON)')}
        </button>
        {onRetry && (
          <button type="button" className="btn" onClick={onRetry}>
            {t('Utolsó lépés visszavonása', 'Undo the last step')}
          </button>
        )}
        <button type="button" className="btn" onClick={() => location.reload()}>
          {t('Újratöltés', 'Reload')}
        </button>
      </div>
      <p className="mono muted">
        {t(
          'Ha az újratöltés sem segít: a letöltött mentés után kezdhetsz tiszta lappal. A hibás terv ilyenkor törlődik erről a készülékről.',
          'If reloading does not help: after downloading the backup you can start over. The broken plan is then removed from this device.',
        )}
      </p>
      <div className="form-actions form-actions-start">
        <button
          type="button"
          className="btn btn-danger"
          onClick={async () => {
            if (!confirm(t('Biztosan törlöd a tervet erről a készülékről? Letöltötted a mentést?', 'Remove the plan from this device? Did you download the backup?'))) return;
            await clearProject().catch(() => {});
            location.reload();
          }}
        >
          {t('Tiszta lap (terv törlése)', 'Start over (remove the plan)')}
        </button>
      </div>
    </main>
  );
}

/** Catches render errors so a broken plan shows the recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const st = useProject.getState();
    return (
      <RecoveryScreen
        message={error.message}
        data={st.project}
        onRetry={
          st.past.length
            ? () => {
                useProject.getState().undo();
                this.setState({ error: null });
              }
            : undefined
        }
      />
    );
  }
}
