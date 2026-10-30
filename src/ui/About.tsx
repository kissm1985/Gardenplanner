import { locale, t } from '../i18n';
import { LogoMark } from './Logo';

export const AUTHOR = 'Kiss-Mihály István';
export const COPYRIGHT_YEAR = 2026;

/** One-line author and rights notice (start screen, project window, printouts). */
export function copyrightLine() {
  return t(`© ${COPYRIGHT_YEAR} ${AUTHOR}. Minden jog fenntartva.`, `© ${COPYRIGHT_YEAR} ${AUTHOR}. All rights reserved.`);
}

/** About box: the app, its author and the rights notice. */
export function About({ onLegal }: { onLegal?: () => void }) {
  return (
    <fieldset className="field-group about">
      <legend>{t('Névjegy', 'About')}</legend>
      <div className="about-head">
        <LogoMark size={40} />
        <div>
          <b className="about-name">Gardenly</b>
          <div className="mono muted">{t('Kerttervező alkalmazás', 'Garden planning app')}</div>
        </div>
      </div>
      <p>
        {t('Készítette:', 'Created by')} <b>{AUTHOR}</b>
      </p>
      <p className="mono muted about-version">
        {t('Verzió', 'Version')} {__APP_VERSION__} · {t('build', 'build')} {new Date(__BUILD_TIME__).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' })}
      </p>
      <p className="mono muted">
        {copyrightLine()}{' '}
        {t(
          'Az alkalmazással kapcsolatos minden szerzői jog a készítőé; a program, a tervei, szövegei és arculata a készítő engedélye nélkül nem másolhatók, nem terjeszthetők és nem módosíthatók.',
          'All copyright in the app belongs to its author; the program, its designs, texts and identity may not be copied, distributed or modified without the author’s permission.',
        )}
      </p>
      <div className="form-actions form-actions-start">
        {onLegal && (
          <button type="button" className="btn btn-small" onClick={onLegal}>
            {t('Jogi információk és adatvédelem', 'Legal information and privacy')}
          </button>
        )}
        <a className="btn btn-small" href="third-party-licenses.txt" target="_blank" rel="noopener">
          {t('Nyílt forrású licencek', 'Open-source licences')}
        </a>
      </div>
    </fieldset>
  );
}
