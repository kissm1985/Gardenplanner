import { useState } from 'react';
import { RULE_LABEL, type Severity, type Warning } from '../engine/rules';
import { useProject } from '../store/projectStore';
import { canvasBridge, useUi } from '../store/uiStore';
import { labels, t } from '../i18n';

export const SEVERITY_LABEL: Record<Severity, string> = labels({ error: ['hiba', 'error'], warn: ['figyelmeztetés', 'warning'], info: ['megjegyzés', 'note'] });

/** Active and muted warnings; tap jumps to the element, the switch mutes it as a deliberate exception. */
export function WarningsPanel({ active, muted, onJump }: { active: Warning[]; muted: Warning[]; onJump: () => void }) {
  const [showMuted, setShowMuted] = useState(false);
  const jump = (w: Warning) => {
    useUi.getState().setTool('select');
    useUi.getState().select(w.itemIds);
    onJump();
    // Let the sheet close before the canvas recentres.
    requestAnimationFrame(() => canvasBridge.focus?.(w.at[0], w.at[1]));
  };
  return (
    <div className="warnings">
      {active.length === 0 ? (
        <p className="empty ok-text">{t('Nincs figyelmeztetés. A terv megfelel a terület korlátainak.', 'No warnings. The plan meets the limits of the area.')}</p>
      ) : (
        <ul className="warn-list">
          {active.map((w) => (
            <WarningRow key={w.id} w={w} onJump={() => jump(w)} />
          ))}
        </ul>
      )}
      {muted.length > 0 && (
        <>
          <button type="button" className="btn btn-small" onClick={() => setShowMuted((v) => !v)} aria-expanded={showMuted}>
            {t('Elnémítva', 'Muted')}: {muted.length} {showMuted ? '▴' : '▾'}
          </button>
          {showMuted && (
            <ul className="warn-list is-muted">
              {muted.map((w) => (
                <WarningRow key={w.id} w={w} muted onJump={() => jump(w)} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function WarningRow({ w, muted, onJump }: { w: Warning; muted?: boolean; onJump: () => void }) {
  return (
    <li className={`warn-row sev-${w.severity}`}>
      <button type="button" className="warn-main" onClick={onJump}>
        <span className="warn-tag mono">
          {RULE_LABEL[w.rule]} · {SEVERITY_LABEL[w.severity]}
        </span>
        <span className="warn-msg">{w.message}</span>
        {w.hint && <span className="warn-hint">{w.hint}</span>}
      </button>
      <button type="button" className="btn btn-small" onClick={() => useProject.getState().setMuted(w.id, !muted)}>
        {muted ? t('Visszakapcsolás', 'Unmute') : t('Elnémítás', 'Mute')}
      </button>
    </li>
  );
}
