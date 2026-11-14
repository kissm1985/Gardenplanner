// What a locked feature looks like, and the small window that explains it.
import type { ReactNode } from 'react';
import { t } from '../i18n';
import { FEATURE_LABEL, FEATURE_TIER, hasFeature, lockedText, setTier, TIER_LABEL, useTier, type Feature } from '../model/tier';
import { useUi } from '../store/uiStore';
import { useProject } from '../store/projectStore';
import { ALAP_LIMITS } from '../model/tier';
import { Sheet } from './Sheet';

/** Runs `fn` if the tier has the feature, else explains the lock. */
export function requireFeature(f: Feature, fn?: () => void): boolean {
  if (hasFeature(f)) {
    fn?.();
    return true;
  }
  useUi.getState().setLocked(f);
  return false;
}

/** A button that shows a lock and the explanation when its feature is not in the tier. */
export function FeatureButton({
  feature,
  onClick,
  className = 'btn btn-small',
  children,
  ...rest
}: { feature: Feature; onClick: () => void; className?: string; children: ReactNode } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  useTier();
  const ok = hasFeature(feature);
  return (
    <button type="button" className={`${className}${ok ? '' : ' is-locked'}`} onClick={() => requireFeature(feature, onClick)} {...rest}>
      {!ok && <span aria-hidden="true">🔒 </span>}
      {children}
    </button>
  );
}

export function LockedSheet() {
  const f = useUi((s) => s.locked);
  const close = () => useUi.getState().setLocked(null);
  return (
    <Sheet open={!!f} title={t('Másik csomagban érhető el', 'Available in another tier')} onClose={close}>
      {f && (
        <div className="form locked-info">
          <p>
            <b>{FEATURE_LABEL[f]}</b>
          </p>
          <p>{lockedText(f)}</p>
          <p className="mono muted">{t('A meglévő terveid csomagváltáskor sem vesznek el.', 'Your plans are kept whatever tier you switch to.')}</p>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setTier(FEATURE_TIER[f]);
                close();
              }}
            >
              {t(`Váltás: ${TIER_LABEL[FEATURE_TIER[f]]}`, `Switch to ${TIER_LABEL[FEATURE_TIER[f]]}`)}
            </button>
            <button type="button" className="btn" onClick={close}>
              {t('Később', 'Later')}
            </button>
          </div>
          <p className="mono muted">
            {t('Fizetés még nincs: a csomag ebben a verzióban szabadon választható.', 'There are no payments yet: in this version the tier is a free choice.')}
          </p>
        </div>
      )}
    </Sheet>
  );
}

/** Room for one more area in the open project (Basic: two areas). */
export function roomForArea(): boolean {
  const n = useProject.getState().project?.areas.length ?? 0;
  return n < ALAP_LIMITS.areas || requireFeature('moreAreas');
}

/** Room for one more project on this device (Basic: one project). */
export function roomForProject(count: number): boolean {
  return count < ALAP_LIMITS.projects || requireFeature('moreProjects');
}
