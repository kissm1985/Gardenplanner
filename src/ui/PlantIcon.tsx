import type { Plant } from '../model/types';
import { plantName } from '../model/plants';
import { PlantChip } from './PlantChip';
import { sideUrl } from './pictograms';

/** The plant's side-view pictogram with its code badge; the coloured chip when it has no pictogram. */
export function PlantIcon({ p, size = 40 }: { p: Plant; size?: number }) {
  const src = sideUrl(p);
  if (!src) return <PlantChip p={p} size={size} />;
  const badge = Math.max(16, Math.round(size * 0.42));
  return (
    <span className="picon" style={{ width: size, height: size }} aria-hidden="true">
      <img src={src} alt="" width={size} height={size} loading="lazy" title={plantName(p)} />
      <PlantChip p={p} size={badge} />
    </span>
  );
}
