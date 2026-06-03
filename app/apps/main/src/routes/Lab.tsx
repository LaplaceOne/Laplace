import { Button, ArrowLink, Icon, Reveal } from '@laplace/ui';
import { PageHead } from '../marketing/PageHead';
import { SecHead } from '../marketing/SecHead';
import { Cta } from '../marketing/Cta';
import { ArchitectureDiagram } from '../components/diagrams/ArchitectureDiagram';
import styles from './Lab.module.css';

const VERTICALS = [
  {
    icon: 'eva:swap-outline',
    title: 'Conditional OTC settlement',
    desc: 'Large trades that settle only when an agreed, verifiable condition holds — with refund fallback. Removes counterparty custody risk.',
    tag: 'signature · proof',
  },
  {
    icon: 'eva:pie-chart-outline',
    title: 'Escrowed options',
    desc: 'Payout gated by a proof of a reference value or event; expiry as option expiry; refund when unexercised.',
    tag: 'validity',
  },
  {
    icon: 'eva:award-outline',
    title: 'Proof-gated grants',
    desc: 'Funds released when a claimant proves they met objective criteria — reducing manual adjudication for bounties and grants.',
    tag: 'validity',
  },
  {
    icon: 'eva:globe-outline',
    title: 'Cross-chain liquidity routing',
    desc: 'Bridge generalized to multi-hop atomic swaps with asymmetric timeouts and ZK attestations for trust-minimized relaying.',
    tag: 'cross-chain proof',
  },
  {
    icon: 'eva:checkmark-circle-2-outline',
    title: 'Compliance-gated disbursement',
    desc: 'Release only on a proof of an off-chain attestation (KYC/AML, audit) — without revealing the underlying data on-chain.',
    tag: 'validity',
  },
  {
    icon: 'eva:cube-outline',
    title: 'Public unlock / puzzle',
    desc: 'Pay a fixed receiver when any party reveals a committed secret — built directly on the console, no spin-off needed.',
    tag: 'hashlock',
  },
];

export default function Lab() {
  return (
    <>
      {/* Page head */}
      <div className="wrap">
        <PageHead
          eyebrow="Laplace Lab · the app family"
          title={
            <>
              One protocol.
              <br />A family of <em>products.</em>
            </>
          }
        >
          Laplace is not a single app. It's a small, auditable escrow core with a pluggable
          criterion interface — and a family of front-ends built on a shared SDK. The protocol
          stays general; each product stays narrow, hiding the protocol behind one polished use
          case.
        </PageHead>
      </div>

      {/* Architecture */}
      <section className={styles.block} style={{ paddingBottom: 56 }} id="architecture">
        <div className="wrap">
          <Reveal>
            <SecHead
              label="Architecture"
              title="Built on shared layers."
              sub="New use cases become new criteria and new front-ends — never forks of the escrow core. The SDK, criterion registry, and design system are shared across every product."
            />
          </Reveal>
          <Reveal>
            <ArchitectureDiagram />
          </Reveal>
        </div>
      </section>

      {/* Products */}
      <section className={styles.block} id="products" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal>
            <SecHead
              label="Products"
              title={
                <>
                  Three faces, shipping
                  <br />
                  in sequence.
                </>
              }
              sub="The main site exposes every criterion for developers and power users. Each spin-off hides the protocol behind one focused product for end users."
            />
          </Reveal>

          {/* Main site & Console */}
          <Reveal className={styles.productPanel}>
            <div className={styles.ppLeft}>
              <div className={styles.pnum}>01</div>
              <h3>Main site &amp; Console</h3>
              <div className={styles.ppMeta}>
                <div className={styles.row}>
                  <span className={styles.lbl}>Status</span>
                  <span className={`${styles.pbadge} ${styles.live}`}>
                    <span className={styles.d} />
                    Live · devnet
                  </span>
                </div>
                <div className={styles.row}>
                  <span className={styles.lbl}>Criteria</span>
                  <span className={styles.crit}>
                    <Icon icon="eva:hash-outline" />
                    Hashlock
                  </span>
                  <span className={styles.crit}>
                    <Icon icon="eva:shield-outline" />
                    Validity
                  </span>
                </div>
                <div className={styles.row}>
                  <span className={styles.lbl}>For</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Developers · power users</span>
                </div>
              </div>
            </div>
            <div className={styles.ppRight}>
              <p>
                The protocol's home: marketing landing, developer documentation, the criterion
                catalog, and a <strong>general protocol console</strong>. It supports SOL and SPL
                escrow, both official criteria, and the full intent lifecycle — create, track,
                fulfill, refund, close — plus manual per-instruction operations and criterion
                configuration.
              </p>
              <ul className={styles.ppAdds}>
                <li>Role-aware dashboard of every intent</li>
                <li>Recipe-driven intent creation</li>
                <li>Manual per-instruction console</li>
                <li>ValidityConfig registration</li>
              </ul>
              <div className={styles.ppFlow}>
                <div className={styles.ft}>Lifecycle</div>
                <div className={styles.ppSteps}>
                  <span>create_intent</span>
                  <span className={styles.arr}>→</span>
                  <span>fulfill | refund</span>
                  <span className={styles.arr}>→</span>
                  <span>close_intent</span>
                </div>
              </div>
              <div style={{ marginTop: 18 }}>
                <Button variant="accent" as="a" href="/app">
                  Launch console <Icon icon="eva:arrow-forward-outline" />
                </Button>
              </div>
            </div>
          </Reveal>

          {/* Bridge */}
          <Reveal className={styles.productPanel}>
            <div className={styles.ppLeft}>
              <div className={styles.pnum}>02</div>
              <h3>Laplace Bridge</h3>
              <div className={styles.ppMeta}>
                <div className={styles.row}>
                  <span className={styles.lbl}>Status</span>
                  <span className={styles.pbadge}>Roadmap</span>
                </div>
                <div className={styles.row}>
                  <span className={styles.lbl}>Criterion</span>
                  <span className={styles.crit}>
                    <Icon icon="eva:hash-outline" />
                    Hashlock
                  </span>
                </div>
                <div className={styles.row}>
                  <span className={styles.lbl}>For</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Cross-chain traders</span>
                </div>
              </div>
            </div>
            <div className={styles.ppRight}>
              <p>
                A cross-chain atomic swap product. Two chains that both run Laplace swap tokens
                using a <strong>shared hashlock and asymmetric timeouts</strong>: Alice locks on
                chain A with hashlock{' '}
                <span className="mono" style={{ color: 'var(--text)' }}>
                  h
                </span>
                , Bob mirrors on chain B, Alice reveals the secret to claim, and Bob uses the
                revealed secret to claim back.
              </p>
              <ul className={styles.ppAdds}>
                <li>Counterparty &amp; offer discovery</li>
                <li>Relayer nodes propagate the reveal</li>
                <li>Timeout / finality safety rails</li>
                <li>Guided two-leg swap UI</li>
              </ul>
              <div className={styles.ppFlow}>
                <div className={styles.ft}>Atomic swap</div>
                <div className={styles.ppSteps}>
                  <span>lock A (h)</span>
                  <span className={styles.arr}>→</span>
                  <span>mirror B (h)</span>
                  <span className={styles.arr}>→</span>
                  <span>reveal s</span>
                  <span className={styles.arr}>→</span>
                  <span>both claim</span>
                </div>
              </div>
              <div className={styles.ppTrust}>
                <Icon icon="eva:info-outline" />
                <span>
                  Relayers are liveness helpers, not custodians — safety rests on the hashlock and
                  the rule{' '}
                  <span className="mono">T_A &gt; T_B + margins</span>. Revealing the secret is
                  public by design.
                </span>
              </div>
            </div>
          </Reveal>

          {/* Disclosure */}
          <Reveal className={styles.productPanel}>
            <div className={styles.ppLeft}>
              <div className={styles.pnum}>03</div>
              <h3>Laplace Disclosure</h3>
              <div className={styles.ppMeta}>
                <div className={styles.row}>
                  <span className={styles.lbl}>Status</span>
                  <span className={styles.pbadge}>Roadmap</span>
                </div>
                <div className={styles.row}>
                  <span className={styles.lbl}>Criterion</span>
                  <span className={styles.crit}>
                    <Icon icon="eva:shield-outline" />
                    Validity · SP1
                  </span>
                </div>
                <div className={styles.row}>
                  <span className={styles.lbl}>For</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Data &amp; secret sellers</span>
                </div>
              </div>
            </div>
            <div className={styles.ppRight}>
              <p>
                Buy a verifiable secret. A seller is paid{' '}
                <strong>only after publishing an encrypted secret and an SP1 proof</strong> that
                the plaintext satisfies the buyer's criteria and is bound to that exact ciphertext.
                The buyer decrypts locally after settlement. Targets data sales, key escrow, and
                bounty-style disclosures.
              </p>
              <ul className={styles.ppAdds}>
                <li>Proof binds plaintext ↔ ciphertext</li>
                <li>Encryption keys separate from wallet</li>
                <li>Large files off-chain, hash-committed</li>
                <li>Refund if the proof never lands</li>
              </ul>
              <div className={styles.ppFlow}>
                <div className={styles.ft}>Disclosure</div>
                <div className={styles.ppSteps}>
                  <span>escrow payment</span>
                  <span className={styles.arr}>→</span>
                  <span>publish ciphertext + proof</span>
                  <span className={styles.arr}>→</span>
                  <span>release</span>
                  <span className={styles.arr}>→</span>
                  <span>decrypt</span>
                </div>
              </div>
              <div className={styles.ppTrust}>
                <Icon icon="eva:info-outline" />
                <span>
                  The SP1 guest proves{' '}
                  <span className="mono">
                    criteria(secret) ∧ ciphertext_hash == hash(encrypt(secret, …))
                  </span>{' '}
                  with intent fields in the public inputs, so the seller can't prove one plaintext
                  and publish another.
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Future verticals */}
      <section className={styles.block} id="future" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal>
            <SecHead
              label="Future verticals"
              title="Where the model goes."
              sub="Directional, dependent on future criteria (signature, multi-criterion, cross-chain proof). Each is a criterion plus a front-end — never a fork of settlement."
            />
          </Reveal>
          <Reveal className={styles.verticals}>
            {VERTICALS.map((v) => (
              <div className={styles.vert} key={v.title}>
                <div className={styles.vico}>
                  <Icon icon={v.icon} />
                </div>
                <h4>{v.title}</h4>
                <p>{v.desc}</p>
                <span className={styles.vtag}>{v.tag}</span>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* How a product is born */}
      <section className={styles.block} id="born" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal>
            <SecHead
              label="How a product is born"
              title={
                <>
                  Add a criterion,
                  <br />
                  add a face.
                </>
              }
              sub={
                <>
                  Every product above reuses the identical lifecycle and the identical{' '}
                  <span className="mono" style={{ color: 'var(--text)' }}>
                    verify_criterion
                  </span>{' '}
                  CPI boundary. The differences live entirely in the criterion, the commitment, and
                  the fulfillment payload.
                </>
              }
            />
          </Reveal>
          <div className={styles.steps}>
            <Reveal className={styles.step}>
              <span className={styles.n}>01</span>
              <h3>Author the criterion</h3>
              <p>
                Deploy a program implementing{' '}
                <span className="mono" style={{ color: 'var(--text)' }}>
                  verify_criterion
                </span>{' '}
                (out-of-band, via CLI/SDK). For stateful criteria, define the config account and
                commitment hashing.
              </p>
            </Reveal>
            <Reveal className={styles.step}>
              <span className={styles.n}>02</span>
              <h3>Register it</h3>
              <p>
                Add a descriptor to{' '}
                <span className="mono" style={{ color: 'var(--text)' }}>
                  @laplace/registry
                </span>{' '}
                — per-cluster program IDs, flags, warnings, docs. The core never whitelists; the UI
                labels anything unofficial.
              </p>
            </Reveal>
            <Reveal className={styles.step}>
              <span className={styles.n}>03</span>
              <h3>Give it a face</h3>
              <p>
                Add a recipe to the console, or spin off a dedicated product. Either way it rides
                the same SDK, lifecycle, and design system — settlement is never rebuilt.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* CTA */}
      <Reveal>
        <Cta
          title={
            <>
              Build on the <em>protocol</em>.
            </>
          }
          sub="Start in the console with hashlock and validity today, or read how to author a criterion and ship a new face of Laplace."
          buttons={
            <>
              <Button variant="accent" size="lg" as="a" href="/app">
                Launch console <Icon icon="eva:arrow-forward-outline" />
              </Button>
              <Button size="lg" as="a" href="/docs">
                Read the docs
              </Button>
            </>
          }
        />
      </Reveal>
    </>
  );
}
