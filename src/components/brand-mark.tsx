/**
 * EnergyTracker brand mark — a bespoke pulse-line monogram.
 *
 * Replaces the generic filled bolt. Drawn as a single continuous path so it
 * scales cleanly and reads as identity rather than stock energy iconography.
 * Inherits `currentColor`, so callers control tone through text utilities.
 */
export function BrandMark({ size = 17 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      focusable="false"
    >
      <path
        d="M3 12h3.2c1.6 0 2.2-5 3.8-5s2.2 10 3.8 10 2.2-5 3.8-5H21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
