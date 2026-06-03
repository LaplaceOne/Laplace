import './diagram.css';

/**
 * Intent state-machine line diagram — ported from docs.html's §lifecycle
 * `<svg class="diagram" viewBox="0 0 760 150">` (create_intent → Active → Fulfilled
 * → Closed, with the refund_expired_intent branch). Attributes converted to JSX
 * (`class`→`className`, `stroke-width`→`strokeWidth`, `text-anchor`→`textAnchor`),
 * preserving every node/path/label. Strokes are statically visible. Uses the shared
 * global diagram.css classes.
 */
export function StateMachineDiagram() {
  return (
    <svg
      className="diagram"
      viewBox="0 0 760 150"
      role="img"
      aria-label="Intent state machine"
      style={{ maxWidth: 680 }}
    >
      <rect className="box" x="8" y="55" width="150" height="44" rx="9" />
      <text className="t-title" x="83" y="81" textAnchor="middle">create_intent</text>
      <path className="ln" d="M158 77 H214" />
      <circle className="dot" cx="214" cy="77" r="3.5" />
      <rect className="box-accent" x="222" y="55" width="120" height="44" rx="9" />
      <text className="t-title" x="282" y="81" textAnchor="middle" style={{ fill: 'var(--primary-solid)' }}>Active</text>
      <path className="ln-accent" d="M342 77 H410" />
      <path className="ln" d="M282 55 V28 H470 V55" />
      <text className="t-mono" x="376" y="20" textAnchor="middle">refund_expired_intent</text>
      <text className="t-mono" x="376" y="71" textAnchor="middle">fulfill</text>
      <rect className="box-accent" x="410" y="55" width="120" height="44" rx="9" />
      <text className="t-title" x="470" y="81" textAnchor="middle" style={{ fill: 'var(--primary-solid)' }}>Fulfilled</text>
      <rect className="box" x="410" y="112" width="120" height="34" rx="9" style={{ display: 'none' }} />
      <path className="ln" d="M530 77 H590" />
      <circle className="dot" cx="590" cy="77" r="3.5" />
      <rect className="box" x="598" y="55" width="120" height="44" rx="9" />
      <text className="t-title" x="658" y="81" textAnchor="middle">Closed</text>
      <text className="t-mono" x="564" y="71" textAnchor="middle">close</text>
    </svg>
  );
}
