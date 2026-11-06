/** Planterra mark: a "P" whose bowl is a leaf, split from the stem by a light curve. Colours follow the theme tokens. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg className={`logo-mark${className ? ` ${className}` : ''}`} viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <path d="M27 6H43Q57 6 57 20V25Q57 46 26 47Z" fill="var(--brand-leaf)" />
      <path d="M8 6H27C39 15 40 34 26 47V58H8Z" fill="var(--brand-stem)" />
      <path d="M27 6C39 15 40 34 26 47" fill="none" stroke="var(--bg)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** Mark + "Planterra" wordmark; `tagline` adds the spaced GARDEN DESIGN SOFTWARE line; `stacked` puts the mark above. */
export function Logo({ size = 32, tagline, stacked }: { size?: number; tagline?: string; stacked?: boolean }) {
  return (
    <span className={`logo${stacked ? ' logo-stacked' : ''}`} style={{ fontSize: stacked ? size * 0.62 : size * 0.78 }}>
      <LogoMark size={size} />
      <span className="logo-text">
        <span className="logo-word">Planterra</span>
        {tagline && <span className="logo-tagline">{tagline}</span>}
      </span>
    </span>
  );
}
