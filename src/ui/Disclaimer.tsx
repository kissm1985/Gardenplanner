import { t } from '../i18n';

/** The toxicity notice shown next to every toxicity filter and value. */
export const toxicNotice = () =>
  t(
    'Tájékoztató adat, nem orvosi vagy állatorvosi tanács. A mérgezőség fajtánként és növényrészenként eltér, és a lista egy része még ellenőrizendő. Gyerek vagy háziállat mellé ültetés előtt ellenőrizd megbízható forrásban (pl. faiskola, állatorvos, toxikológiai tájékoztató).',
    'For information only, not medical or veterinary advice. Toxicity differs by cultivar and plant part, and some of the data still needs checking. Before planting near children or pets, check a reliable source (e.g. a nursery, a vet, a poison information service).',
  );

export function ToxicNotice({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`toxic-notice${compact ? ' is-compact' : ''}`} role="note">
      <span aria-hidden="true">⚠ </span>
      {compact ? t('Mérgezőség: tájékoztató adat, ültetés előtt ellenőrizd.', 'Toxicity: for information only, check before planting.') : toxicNotice()}
    </p>
  );
}
