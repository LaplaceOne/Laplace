/** Exact hero subheading — the first (and only) Solana mention in the hero copy. */
export const HERO_SUB =
  'Laplace is a general conditional-escrow protocol on Solana. Lock assets behind a pluggable on-chain criterion; settlement happens the instant it’s provably met — otherwise the deposit returns to you.';

/** Exact closing CTA paragraph — the second (and only other) Solana mention. */
export const CTA_SUB =
  'Build intent-based swaps where the only outcomes are a proven release or a clean refund. Permissionless and non-custodial, live on Solana.';

/** Future criteria named for future releases — each a criterion program + front-end, never a fork. */
export const FUTURE_CRITERIA = [
  'Signature',
  'Encrypted disclosure',
  'Cross-chain lock proof',
  'Multi-criterion',
] as const;

/** App-family product entries. */
export const APP_FAMILY = [
  {
    key: 'console',
    name: 'Main site & console',
    status: 'Live · devnet',
    live: true,
    href: '/app',
    desc: 'The protocol hub: docs, the criterion catalog, and a general console to create, track, fulfill, refund, and close intents — for SOL and SPL, with both official criteria.',
  },
  {
    key: 'bridge',
    name: 'Laplace Bridge',
    status: 'Roadmap',
    live: false,
    href: '#',
    desc: 'Cross-chain atomic swap. Two chains running Laplace swap tokens with a shared hashlock and asymmetric timeouts; relayers add discovery and propagation, never custody.',
  },
  {
    key: 'disclosure',
    name: 'Laplace Disclosure',
    status: 'Roadmap',
    live: false,
    href: '#',
    desc: 'Buy a verifiable secret. A seller is paid only after publishing an encrypted secret plus an SP1 proof that the plaintext satisfies the buyer’s criteria and is bound to that ciphertext.',
  },
] as const;

/** Footer link groups. */
export const FOOTER_LINKS = [
  {
    heading: 'Docs',
    links: [
      { label: 'Lifecycle', href: '/docs#lifecycle' },
      { label: 'Criterion interface', href: '/docs#interface' },
      { label: 'Hashlock', href: '/docs#hashlock' },
      { label: 'Validity', href: '/docs#validity' },
    ],
  },
  {
    heading: 'Build',
    links: [
      { label: 'SDK quickstart', href: '/docs#quickstart' },
      { label: 'Program IDs', href: '/docs#programs' },
      { label: 'Registry', href: '/registry' },
      { label: 'GitHub', href: 'https://github.com/LaplaceOne/Laplace', external: true },
    ],
  },
  {
    heading: 'Products',
    links: [
      { label: 'Laplace Lab', href: '/lab' },
      { label: 'Main site & console', href: '/app' },
      { label: 'Laplace Bridge', href: '/lab#products' },
      { label: 'Laplace Disclosure', href: '/lab#products' },
    ],
  },
] as const;
