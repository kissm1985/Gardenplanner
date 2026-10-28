import { useEffect, useRef, type ReactNode } from 'react';

/** Bottom sheet on phones, centred dialog on wider screens. Uses <dialog> for focus trapping and Esc. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop tap
      }}
    >
      <div className="sheet-head">
        <h2>{title}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Bezárás">
          ×
        </button>
      </div>
      <div className="sheet-body">{open && children}</div>
    </dialog>
  );
}
