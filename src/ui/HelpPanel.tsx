import { useEffect, useMemo, useRef } from 'react';
import guideHu from '../../docs/UTMUTATO.md?raw';
import { markdownToHtml } from './markdown';

// Screenshots of the guide, bundled (and cached offline by the service worker).
const IMAGES = import.meta.glob('../../docs/img/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const imageUrl = (src: string) => IMAGES[`../../docs/${src}`] ?? src;

/** The user guide inside the app; opens at `section` (a heading id) when given. */
export function HelpPanel({ section }: { section?: string }) {
  const html = useMemo(() => markdownToHtml(guideHu, imageUrl), []);
  const ref = useRef<HTMLDivElement>(null);

  const go = (id: string) => {
    const el = ref.current?.querySelector(`[id="${CSS.escape(id)}"]`);
    el?.scrollIntoView({ block: 'start' });
  };

  useEffect(() => {
    if (section) requestAnimationFrame(() => go(section));
  }, [section]);

  return (
    <div
      ref={ref}
      className="guide"
      onClick={(e) => {
        // In-page links scroll within the sheet instead of changing the address.
        const a = (e.target as Element).closest('a[data-anchor]');
        if (!a) return;
        e.preventDefault();
        go(a.getAttribute('data-anchor')!);
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
