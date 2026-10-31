import { useEffect, useRef, type ReactNode } from 'react';
import { t } from '../i18n';

const SWIPE_CLOSE_PX = 80;

/** Bottom sheet on phones, centred dialog on wider screens. Uses <dialog> for focus trapping and Esc. */
export function Sheet({ open, title, onClose, children, wide, onHelp }: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  /** Shows a "?" that opens the guide at this window's chapter. */
  onHelp?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ id: number; y: number } | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`sheet${wide ? ' sheet-wide' : ''}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop tap
      }}
    >
      <div
        className="sheet-head"
        onPointerDown={(e) => {
          if ((e.target as Element).closest('button')) return;
          drag.current = { id: e.pointerId, y: e.clientY };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId || !ref.current) return;
          ref.current.style.transform = `translateY(${Math.max(0, e.clientY - d.y)}px)`;
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (ref.current) ref.current.style.transform = '';
          // Pull the header down to close the sheet (phones).
          if (d && d.id === e.pointerId && e.clientY - d.y > SWIPE_CLOSE_PX) onClose();
        }}
        onPointerCancel={() => {
          drag.current = null;
          if (ref.current) ref.current.style.transform = '';
        }}
      >
        <span className="sheet-grip" aria-hidden="true" />
        <h2>{title}</h2>
        {onHelp && (
          <button type="button" className="icon-btn sheet-help" onClick={onHelp} aria-label={t(`Súgó: ${title}`, `Help: ${title}`)}>
            ?
          </button>
        )}
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t('Bezárás', 'Close')}>
          ×
        </button>
      </div>
      <div className="sheet-body">{open && children}</div>
    </dialog>
  );
}
