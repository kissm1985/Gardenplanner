// Editor for the Pro tier's own PDF header (logo, company, contact, quote validity).
import { useRef } from 'react';
import { t } from '../i18n';
import { useFeature } from '../model/tier';
import { FeatureButton } from './Locked';
import { loadImage } from './imageFile';
import { setPdfHeader, usePdfHeader } from './pdfHeader';

export function PdfHeaderPanel() {
  const ok = useFeature('pdfHeader');
  const h = usePdfHeader();
  const ref = useRef<HTMLInputElement>(null);
  if (!ok)
    return (
      <FeatureButton feature="pdfHeader" onClick={() => {}}>
        {t('Saját fejléc a PDF-en (Profi)', 'Your own header on the PDF (Pro)')}
      </FeatureButton>
    );
  return (
    <fieldset className="field-group pdf-header-panel">
      <legend>{t('Saját fejléc a PDF-en', 'Your own header on the PDF')}</legend>
      <div className="form-actions form-actions-start">
        {h.logo && <img className="pdf-logo-preview" src={h.logo} alt={t('Logó', 'Logo')} />}
        <button type="button" className="btn btn-small" onClick={() => ref.current?.click()}>
          {h.logo ? t('Logó cseréje', 'Replace logo') : t('Logó feltöltése', 'Upload logo')}
        </button>
        {h.logo && (
          <button type="button" className="btn btn-small" onClick={() => setPdfHeader({ ...h, logo: undefined })}>
            {t('Logó törlése', 'Remove logo')}
          </button>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) setPdfHeader({ ...h, logo: (await loadImage(f, 400)).dataUrl });
          }}
        />
      </div>
      <label className="field">
        <span>{t('Cég neve', 'Company name')}</span>
        <input value={h.company} onChange={(e) => setPdfHeader({ ...h, company: e.target.value })} />
      </label>
      <label className="field">
        <span>{t('Elérhetőség (cím, telefon, e-mail)', 'Contact (address, phone, e-mail)')}</span>
        <input value={h.contact} onChange={(e) => setPdfHeader({ ...h, contact: e.target.value })} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>{t('Ügyfél (ehhez a nyomtatáshoz)', 'Customer (for this print)')}</span>
          <input value={h.customer ?? ''} onChange={(e) => setPdfHeader({ ...h, customer: e.target.value })} />
        </label>
        <label className="field">
          <span>{t('Ajánlat érvényessége (nap)', 'Quote valid for (days)')}</span>
          <input
            inputMode="numeric"
            value={String(h.validDays)}
            onChange={(e) => setPdfHeader({ ...h, validDays: Math.min(365, Number(e.target.value.replace(/\D/g, '')) || 0) })}
          />
        </label>
      </div>
    </fieldset>
  );
}
