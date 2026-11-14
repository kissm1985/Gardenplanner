// Feedback from the app (PL-FUN-06): bug, idea or question. Without a server it prepares an e-mail to the author;
// with the Pro backend connected it is sent there. Technical data and the plan only with the user's consent.
import { useState } from 'react';
import { getLang, t } from '../i18n';
import { CONTACT_EMAIL } from './About';
import { backupNow } from './backup';
import { useProject } from '../store/projectStore';
import { getTier } from '../model/tier';
import { apiBase, sendFeedback } from '../engine/api';

type Kind = 'bug' | 'idea' | 'question';

export function technicalInfo() {
  return [
    `Planterra ${__APP_VERSION__} (${__BUILD_TIME__})`,
    `${t('Nyelv', 'Language')}: ${getLang()}`,
    `${t('Csomag', 'Tier')}: ${getTier()}`,
    `${t('Képernyő', 'Screen')}: ${window.innerWidth}×${window.innerHeight}`,
    `${navigator.userAgent}`,
  ].join('\n');
}

export function FeedbackPanel({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState<Kind>('bug');
  const [text, setText] = useState('');
  const [tech, setTech] = useState(true);
  const [plan, setPlan] = useState(false);
  const [msg, setMsg] = useState('');
  const project = useProject((s) => s.project);
  const KIND: Record<Kind, string> = { bug: t('Hiba', 'Bug'), idea: t('Ötlet', 'Idea'), question: t('Kérdés', 'Question') };

  const send = async () => {
    const body = `${text.trim()}\n\n${tech ? `-- ${t('Technikai adatok', 'Technical data')} --\n${technicalInfo()}` : ''}`;
    if (apiBase()) {
      const ok = await sendFeedback({ kind, text: text.trim(), tech: tech ? technicalInfo() : undefined }).catch(() => false);
      if (ok) {
        setMsg(t('Köszönjük! A visszajelzésed megérkezett.', 'Thank you! Your feedback has arrived.'));
        setText('');
        return;
      }
    }
    if (plan && project) await backupNow(project);
    const subject = `[Planterra] ${KIND[kind]}`;
    location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + (plan ? `\n\n${t('(A tervet letöltöttem, mellékelem.)', '(I downloaded the plan and attach it.)')}` : ''))}`;
    setMsg(
      t(
        'Megnyílt a leveleződ az elkészített levéllel. Ha nem nyílt meg, írj ide: ' + CONTACT_EMAIL,
        'Your mail app opened with the prepared message. If it did not, write to ' + CONTACT_EMAIL,
      ),
    );
  };

  return (
    <div className="form feedback">
      <div className="seg" role="radiogroup" aria-label={t('Típus', 'Type')}>
        {(Object.keys(KIND) as Kind[]).map((k) => (
          <button key={k} type="button" className="chip-btn" role="radio" aria-checked={kind === k} aria-pressed={kind === k} onClick={() => setKind(k)}>
            {KIND[k]}
          </button>
        ))}
      </div>
      <label className="field">
        <span>{kind === 'bug' ? t('Mi történt, és mit vártál?', 'What happened, and what did you expect?') : t('Írd le röviden', 'Tell us briefly')}</span>
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={tech} onChange={(e) => setTech(e.target.checked)} />
        <span>{t('Technikai adatok csatolása (verzió, nyelv, képernyő, böngésző)', 'Attach technical data (version, language, screen, browser)')}</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={plan} onChange={(e) => setPlan(e.target.checked)} />
        <span>{t('A jelenlegi terv mentése, hogy mellékelhessem (hozzájárulok)', 'Save the current plan so I can attach it (I agree)')}</span>
      </label>
      <p className="mono muted">
        {t(
          'Személyes adatot csak az kap, akinek a levelet elküldöd; a tervet csak akkor, ha csatolod. Lásd: Adatvédelmi tájékoztató.',
          'Only the recipient of your message gets personal data, and the plan only if you attach it. See the privacy notice.',
        )}
      </p>
      <div className="form-actions">
        <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={send}>
          {t('Küldés', 'Send')}
        </button>
        <button type="button" className="btn" onClick={onDone}>
          {t('Mégse', 'Cancel')}
        </button>
      </div>
      {msg && (
        <p className="toast" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
