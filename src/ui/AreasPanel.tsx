import { useState } from 'react';
import { AREA_TEMPLATES } from '../data/templates';
import { SOIL_LABEL } from '../model/plants';
import { AREA_KIND_LABEL, ORIENTATION_LABEL, type Area } from '../model/types';
import { useProject } from '../store/projectStore';
import { AreaForm } from './AreaForm';
import { startShapeEdit } from './ShapeEditBar';
import { useUi } from '../store/uiStore';

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
        submitLabel="Terület létrehozása"
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
          submitLabel="Mentés"
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
      {project.areas.length === 0 && <p className="empty">Még nincs területed. Hozz létre egyet, vagy indulj egy sablonból.</p>}
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
            onDelete={() => {
              if (confirm(`Biztosan törlöd a(z) „${a.name}” területet? Visszavonással visszahozható.`)) deleteArea(a.id);
            }}
          />
        ))}
      </ul>
      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={() => setMode({ kind: 'new' })}>
          + Új terület
        </button>
      </div>
      <h3 className="sub-h">Sablonból</h3>
      <div className="tpl-list">
        {AREA_TEMPLATES.map((t) => (
          <button key={t.key} type="button" className="tpl" onClick={() => addTemplate(t.key)}>
            <b>{t.title}</b>
            <small>{t.summary}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function AreaCard({ a, current, onOpen, onEdit, onShape, onDelete }: {
  a: Area;
  current: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onShape: () => void;
  onDelete: () => void;
}) {
  const c = a.constraints;
  const tags = [
    c.maxHeightCm != null && `max. ${c.maxHeightCm} cm`,
    c.maxTrees != null && `max. ${c.maxTrees} fa`,
    a.soil && `talaj: ${SOIL_LABEL[a.soil]}`,
    a.kind && AREA_KIND_LABEL[a.kind],
    a.shape.kind === 'polygon' && 'szabad alak',
    c.noThorns && 'tüskementes',
    c.nonToxic && 'nem mérgező',
    c.drip && 'csepegtető',
    c.mulchCover && 'agrotextil + mulcs',
  ].filter(Boolean) as string[];
  return (
    <li className={`area-card${current ? ' is-current' : ''}`}>
      <button type="button" className="area-open" onClick={onOpen}>
        <b>{a.name}</b>
        <span className="mono">
          {a.widthCm} × {a.lengthCm} cm · {ORIENTATION_LABEL[a.orientation]}
          {a.sunUntil && ` · napos ${a.sunUntil}`}
        </span>
      </button>
      {tags.length > 0 && (
        <ul className="chips">
          {tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      <div className="card-actions">
        <button type="button" className="btn btn-small" onClick={onEdit}>
          Szerkesztés
        </button>
        <button type="button" className="btn btn-small" onClick={onShape}>
          Alak szerkesztése
        </button>
        <button type="button" className="btn btn-small btn-danger" onClick={onDelete}>
          Törlés
        </button>
      </div>
    </li>
  );
}
