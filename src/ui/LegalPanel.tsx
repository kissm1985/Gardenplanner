import { useMemo } from 'react';
import legalEn from '../../docs/legal/LEGAL.md?raw';
import legalHu from '../../docs/legal/JOGI.md?raw';
import { getLang } from '../i18n';
import { markdownToHtml } from './markdown';

/** Terms of use, privacy notice, data sources and third-party licences (bundled, offline too). */
export function LegalPanel() {
  const html = useMemo(() => markdownToHtml(getLang() === 'en' ? legalEn : legalHu, (s) => s), []);
  return <div className="guide legal" dangerouslySetInnerHTML={{ __html: html }} />;
}
