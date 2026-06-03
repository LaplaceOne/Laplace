import './diagram.css';

/**
 * Intent lifecycle line diagram — ported from index.html's hero
 * `<svg class="diagram" viewBox="0 0 480 400">`. Attributes converted to JSX;
 * strokes are statically visible (no draw-on animation gating), per the design
 * decision. The pulse-dot animation respects prefers-reduced-motion via diagram.css.
 */
export function LifecycleDiagram() {
  return (
    <svg className="diagram" viewBox="0 0 480 400" role="img" aria-label="Intent lifecycle line diagram">
      <rect className="box draw" pathLength={100} x="150" y="14" width="180" height="58" rx="10" />
      <text className="t-label" x="166" y="36">create_intent</text>
      <text className="t-title" x="166" y="56">Lock → escrow PDA</text>

      <path className="ln draw" pathLength={100} d="M240 72 V104" />
      <circle className="dot" cx="240" cy="108" r="3.5" />
      <path className="ln draw" pathLength={100} d="M240 112 V120" />

      <rect className="box-accent draw" pathLength={100} x="150" y="120" width="180" height="74" rx="10" />
      <text className="t-label" x="166" y="144" style={{ fill: 'var(--primary-solid)' }}>criterion · CPI</text>
      <text className="t-mono" x="166" y="163">verify_criterion()</text>
      <text className="t-mono" x="166" y="177">→ accept | reject</text>
      <circle className="dot dot-accent pulse-dot" cx="316" cy="139" r="4" />

      <path className="ln-dash draw" pathLength={100} d="M150 157 H70 V99" />
      <circle className="dot" cx="70" cy="86" r="13" />
      <text x="70" y="90" textAnchor="middle" fontFamily="monospace" fontSize="13" fill="var(--text-secondary)">#</text>
      <text className="t-label" x="70" y="64" textAnchor="middle">hashlock</text>

      <path className="ln-dash draw" pathLength={100} d="M330 157 H410 V99" />
      <circle className="dot" cx="410" cy="86" r="13" />
      <text x="410" y="91" textAnchor="middle" fontSize="14" fill="var(--text-secondary)">π</text>
      <text className="t-label" x="410" y="64" textAnchor="middle">validity</text>

      <path className="ln draw" pathLength={100} d="M240 194 V250" />
      <circle className="dot dot-accent" cx="240" cy="222" r="4" />

      <path className="ln draw" pathLength={100} d="M240 250 H360 V290" />
      <path className="ln-accent draw" pathLength={100} d="M240 250 H120 V290" />

      <rect className="box-accent draw" pathLength={100} x="36" y="290" width="168" height="58" rx="10" />
      <text className="t-label" x="52" y="313" style={{ fill: 'var(--primary-solid)' }}>fulfilled</text>
      <text className="t-title" x="52" y="333" style={{ fill: 'var(--primary-solid)' }}>Release → receiver</text>

      <rect className="box draw" pathLength={100} x="276" y="290" width="168" height="58" rx="10" />
      <text className="t-label" x="292" y="313">refunded</text>
      <text className="t-title" x="292" y="333">Refund → maker</text>

      <text className="t-mono" x="240" y="384" textAnchor="middle">— one intent, two terminal outcomes —</text>
    </svg>
  );
}
