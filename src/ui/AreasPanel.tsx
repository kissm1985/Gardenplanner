import { useState } from 'react';
import { AREA_TEMPLATES } from '../data/templates';
import { SOIL_LABEL } from '../model/plants';
import { AREA_KIND_LABEL, ORIENTATION_LABEL, type Area } from '../model/types';
import { useProject } from '../store/projectStore';
import { AreaForm } from './AreaForm';
import { startLawnEdit, startShapeEdit } from './ShapeEditBar';
import { useUi } from '../store/uiStore';
import { t } from '../i18n';

type Mode = { kind: 'list' } | { kind: 'new' } | { kind: 'edit'; id: string };

/** Area list with add / edit / delete, shown inside a sheet. */
export function AreasPanel({ onDone }: { onDone: () => void }) {
  const project = useProject((s) => s.project)!;
  const currentAreaId = useProject((s) => s.currentAreaId);
  const { addArea, updateArea, deleteArea, selectArea } = useProject.getState();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });

  if (mode.kind === 'new') {
    return (
      <AreaForm
        submitLabel={t('Terület létrehozása', 'Create area')}
        onCancel={() => setMode({ kind: 'list' })}
        onSubmit={({ freeShape, ...d }) => {
          const id = addArea(d);
          if (freeShape) {
            useUi.getState().setTool('select');
            useUi.getState().setShapeEdit({ areaId: id, mode: 'draw', points: [], selected: null });
          }
          onDone();
        }}
      />
    );
  }
  if (mode.kind === 'edit') {
    const area = project.areas.find((a) => a.id === mode.id);
    if (area)
      return (
        <AreaForm
          initial={area}
          submitLabel={t('Mentés', 'Save')}
          onCancel={() => setMode({ kind: 'list' })}
          onSubmit={(d) => {
            updateArea(area.id, d);
            setMode({ kind: 'list' });
          }}
        />
      );
  }

  const addTemplate = (key: string) => {
    useProject.getState().addTemplateArea(key);
    onDone();
  };

  return (
    <div className="areas">
      {project.areas.length === 0 && <p className="empty">{t('Még nincs területed. Hozz létre egyet, vagy indulj egy sablonból.', 'You have no area yet. Create one, or start from a template.')}</p>}
      <ul className="area-list">
        {project.areas.map((a) => (
          <AreaCard
            key={a.id}
            a={a}
            current={a.id === currentAreaId}
            onOpen={() => {
              selectArea(a.id);
              onDone();
            }}
            onEdit={() => setMode({ kind: 'edit', id: a.id })}
            onShape={() => {
              selectArea(a.id);
              startShapeEdit(a);
              onDone();
            }}
            onLawn={() => {
              selectArea(a.id);
              startLawnEdit(a);
              onDone();
            }}
            onDelete={() => {
              if (confirm(t(`Biztosan törlöd a(z) „${a.name}” területet? Visszavonással visszahozható.`, `Delete the area “${a.name}”? Undo brings it back.`))) deleteArea(a.id);
            }}
          />
        ))}
      </ul>
      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={() => setMode({ kind: 'new' })}>
          {t('+ Új terület', '+ New area')}
        </button>
      </div>
      <h3 className="sub-h">{t('Sablonból', 'From a template')}</h3>
      <div className="tpl-list">
        {AREA_TEMPLATES.map((tp) => (
          <button key={tp.key} type="button" className="tpl" onClick={() => addTemplate(tp.key)}>
            <b>{tp.title}</b>
            <small>{tp.summary}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function AreaCard({ a, current, onOpen, onEdit, onShape, onLawn, onDelete }: {
  a: Area;
  current: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onShape: () => void;
  onLawn: () => void;
  onDelete: () => void;
}) {
  const c = a.constraints;
  const tags = [
    c.maxHeightCm != null && `max. ${c.maxHeightCm} cm`,
    c.maxTrees != null && t(`max. ${c.maxTrees} fa`, `max. ${c.maxTrees} trees`),
    a.soil && t(`talaj: ${SOIL_LABEL[a.soil]}`, `soil: ${SOIL_LABEL[a.soil]}`),
    a.kind && AREA_KIND_LABEL[a.kind],
    a.shape.kind === 'polygon' && t('szabad alak', 'free shape'),
    c.noThorns && t('tüskementes', 'no thorns'),
    c.nonToxic && t('nem mérgező', 'non-toxic'),
    c.drip && t('csepegtető', 'drip irrigation'),
    c.mulchCover && t('agrotextil + mulcs', 'fabric + mulch'),
  ].filter(Boolean) as string[];
  return (
    <li className={`area-card${current ? ' is-current' : ''}`}>
      <button type="button" className="area-open" onClick={onOpen}>
        <b>{a.name}</b>
        <span className="mono">
          {a.widthCm} × {a.lengthCm} cm · {ORIENTATION_LABEL[a.orientation]}
          {a.sunUntil && t(` · napos ${a.sunUntil}`, ` · sun ${a.sunUntil}`)}
        </span>
      </button>
      {tags.length > 0 && (
        <ul className="chips">
          {tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
      <div className="card-actions">
        <button type="button" className="btn btn-small" onClick={onEdit}>
          {t('Szerkesztés', 'Edit')}
        </button>
        <button type="button" className="btn btn-small" onClick={onShape}>
          {t('Alak szerkesztése', 'Edit shape')}
        </button>
        <button type="button" className="btn btn-small" onClick={onLawn}>
          {t('+ Gyepsáv', '+ Lawn strip')}
        </button>
        <button type="button" className="btn btn-small btn-danger" onClick={onDelete}>
          {t('Törlés', 'Delete')}
        </button>
      </div>
    </li>
  );
}
