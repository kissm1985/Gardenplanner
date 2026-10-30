/** Gardenly mark: a roof line with a chimney sheltering two leaves. Colours follow the theme tokens. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg className={`logo-mark${className ? ` ${className}` : ''}`} viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <path d="M41.5 13.2V6h6v12.2" fill="var(--brand-roof)" />
      <path d="M17 52C8.5 45 6.5 31 13 22.5L32 6.5 51.5 23" fill="none" stroke="var(--brand-roof)" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M25 50.5C14.5 46.5 13 33.5 20 24 30.5 29.5 31.5 41.5 25 50.5Z" fill="var(--brand-leaf-2)" />
      <path d="M27 54.5C27 38 38.5 27 57 25 57.5 42.5 45.5 54 27 54.5Z" fill="var(--brand-leaf)" />
      <path d="M30.5 51.5C36 43 42 37 52 30" fill="none" stroke="var(--bg)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M24.2 47.5C23.2 40.5 22.4 34.5 21.5 28.5" fill="none" stroke="var(--bg)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Mark + "Gardenly" wordmark; `tagline` adds the spaced DESIGN · PLANT · ENJOY line; `stacked` puts the mark above. */
export function Logo({ size = 32, tagline, stacked }: { size?: number; tagline?: string; stacked?: boolean }) {
  return (
    <span className={`logo${stacked ? ' logo-stacked' : ''}`} style={{ fontSize: stacked ? size * 0.62 : size * 0.78 }}>
      <LogoMark size={size} />
      <span className="logo-text">
        <span className="logo-word">Gardenly</span>
        {tagline && <span className="logo-tagline">{tagline}</span>}
      </span>
    </span>
  );
}
