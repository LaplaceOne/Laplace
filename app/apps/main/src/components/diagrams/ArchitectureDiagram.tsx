import './arch.css';

/**
 * Laplace product architecture line diagram — ported from lab.html's
 * `<svg class="arch" viewBox="0 0 800 320">` (Protocol → Shared SDK/registry/design-system
 * → Console[live·devnet] / Bridge[hashlock] / Disclosure[validity·sp1] / Future[dashed]).
 * Attributes converted to JSX (`class`→`className`, `stroke-width`→`strokeWidth`,
 * `text-anchor`→`textAnchor`, inline `style` strings→objects), preserving every
 * node/path/label. Strokes are statically visible. Uses the global `arch.css` classes.
 */
export function ArchitectureDiagram() {
  return (
    <svg className="arch" viewBox="0 0 800 320" role="img" aria-label="Laplace product architecture">
      {/* protocol core */}
      <rect className="box" x="250" y="14" width="300" height="50" rx="10" />
      <text className="t-title" x="400" y="36" textAnchor="middle">Laplace Protocol</text>
      <text className="t-mono" x="400" y="52" textAnchor="middle">escrow core · criterion programs</text>
      <path className="ln" d="M400 64 V104" />
      {/* shared layer */}
      <rect className="box-accent" x="190" y="104" width="420" height="50" rx="10" />
      <text className="t-title" x="400" y="126" textAnchor="middle" style={{ fill: 'var(--primary-solid)' }}>Shared SDK · criterion registry · design system</text>
      <text className="t-mono" x="400" y="142" textAnchor="middle">one typed interface to the chain</text>
      {/* fan */}
      <path className="ln" d="M400 154 V184 M100 184 H700 M100 184 V214 M300 184 V214 M500 184 V214 M700 184 V214" />
      <circle className="dot" cx="400" cy="184" r="3.5" />
      {/* products */}
      <rect className="box" x="18" y="214" width="164" height="88" rx="10" />
      <text className="t-title" x="100" y="248" textAnchor="middle">Main site</text>
      <text className="t-title" x="100" y="265" textAnchor="middle">&amp; Console</text>
      <text className="t-mono" x="100" y="285" textAnchor="middle" style={{ fill: 'var(--success)' }}>live · devnet</text>

      <rect className="box" x="218" y="214" width="164" height="88" rx="10" />
      <text className="t-title" x="300" y="256" textAnchor="middle">Laplace Bridge</text>
      <text className="t-mono" x="300" y="285" textAnchor="middle">hashlock</text>

      <rect className="box" x="418" y="214" width="164" height="88" rx="10" />
      <text className="t-title" x="500" y="248" textAnchor="middle">Laplace</text>
      <text className="t-title" x="500" y="265" textAnchor="middle">Disclosure</text>
      <text className="t-mono" x="500" y="285" textAnchor="middle">validity · sp1</text>

      <rect className="box-dash" x="618" y="214" width="164" height="88" rx="10" />
      <text className="t-title" x="700" y="256" textAnchor="middle" style={{ fill: 'var(--text-secondary)' }}>Future verticals</text>
      <text className="t-mono" x="700" y="285" textAnchor="middle">defi · investor</text>
    </svg>
  );
}
