import { Link } from 'react-router-dom';
import { Button, ArrowLink, CodeBlock, Icon, Reveal } from '@laplace/ui';
import { Eyebrow } from '../marketing/Eyebrow';
import { SecHead } from '../marketing/SecHead';
import { Cta } from '../marketing/Cta';
import { LifecycleDiagram } from '../components/diagrams/LifecycleDiagram';
import { useStats } from '../indexer/hooks';
import { HERO_SUB, CTA_SUB, FUTURE_CRITERIA, APP_FAMILY } from '../content/site';
import { createIntent } from '../content/snippets';
import styles from './Landing.module.css';

function fmt(n: number | undefined): string {
  return typeof n === 'number' ? n.toLocaleString('en-US') : '—';
}

export default function Landing() {
  const stats = useStats();

  return (
    <>
      {/* 1. Hero */}
      <Reveal as="header" className={styles.hero}>
        <div className={`wrap ${styles.heroGrid}`}>
          <div>
            <Eyebrow>Intent-based atomic settlement · Solana · Devnet</Eyebrow>
            <h1 className={styles.heroTitle}>
              Escrow that releases <em>only on proof</em>, refunds on expiry.
            </h1>
            <p className={styles.heroSub}>{HERO_SUB}</p>
            <div className={styles.heroCta}>
              <Button variant="accent" size="lg" as="a" href="/app">
                Launch console <Icon icon="eva:arrow-forward-outline" />
              </Button>
              <ArrowLink href="/docs">Read the docs</ArrowLink>
            </div>
          </div>
          <div>
            <LifecycleDiagram />
          </div>
        </div>
      </Reveal>

      {/* 2. Guarantees */}
      <section className={styles.block} id="guarantees">
        <div className="wrap">
          <Reveal>
            <SecHead
              label="Guarantees"
              title={
                <>
                  Enforced by the program,
                  <br />
                  not by trust.
                </>
              }
              sub="Every property below holds on-chain — there is no operator, relayer, or admin key in a position to weaken them."
            />
          </Reveal>
          <Reveal className={styles.principles}>
            <div className={styles.principle}>
              <div className={styles.pico}>
                <Icon icon="eva:lock-outline" />
              </div>
              <h3>Non-custodial</h3>
              <p>
                Assets sit in a program-derived escrow from the moment they're locked. No
                operator, relayer, or admin key can move them.
              </p>
            </div>
            <div className={styles.principle}>
              <div className={styles.pico}>
                <Icon icon="eva:cube-outline" />
              </div>
              <h3>Atomic</h3>
              <p>
                Settlement is a single instruction — release to the receiver or refund the
                maker. Never a partial transfer, never a stuck state.
              </p>
            </div>
            <div className={styles.principle}>
              <div className={styles.pico}>
                <Icon icon="eva:clock-outline" />
              </div>
              <h3>Refund-guaranteed</h3>
              <p>
                If no valid fulfillment lands by the expiry slot, the refund recipient reclaims
                the escrow in full. A failed intent is never a lost deposit.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 3. How it works */}
      <section className={styles.block} id="how">
        <div className="wrap">
          <Reveal>
            <SecHead
              label="How it works"
              title={
                <>
                  The lifecycle
                  <br />
                  is the product.
                </>
              }
              sub={
                <>
                  Every Laplace intent is a small on-chain state machine:{' '}
                  <span className="mono" style={{ color: 'var(--text)' }}>
                    create → fulfill | refund → close
                  </span>
                  . The escrow core is criterion-agnostic.{' '}
                  <ArrowLink href="/docs#lifecycle">Read the protocol</ArrowLink>
                </>
              }
            />
          </Reveal>
          <div className={styles.steps}>
            <Reveal className={styles.step}>
              <span className={styles.n}>01</span>
              <h3>
                <Icon icon="eva:lock-outline" /> Create
              </h3>
              <p>
                The maker locks SOL or SPL into an intent PDA and binds a criterion program,
                receiver, refund recipient, and expiry slot. Funds are non-custodial from this
                point on.
              </p>
            </Reveal>
            <Reveal className={styles.step}>
              <span className={styles.n}>02</span>
              <h3>
                <Icon icon="eva:checkmark-square-outline" /> Fulfill
              </h3>
              <p>
                A fulfiller submits evidence. The core forwards a canonical request to the
                criterion program by CPI and releases the escrow to the receiver only if that CPI
                accepts — atomically.
              </p>
            </Reveal>
            <Reveal className={styles.step}>
              <span className={styles.n}>03</span>
              <h3>
                <Icon icon="eva:flip-2-outline" /> Refund or close
              </h3>
              <p>
                No valid fulfillment by expiry? Anyone can crank the refund to the refund
                recipient. After a terminal state, the maker closes the intent to reclaim rent.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 4. Pluggable criteria */}
      <section className={styles.block} id="criteria">
        <div className="wrap">
          <Reveal>
            <SecHead
              label="Pluggable criteria"
              title={
                <>
                  One protocol,
                  <br />
                  many faces.
                </>
              }
              sub={
                <>
                  A criterion is any program implementing the{' '}
                  <span className="mono" style={{ color: 'var(--text)' }}>
                    verify_criterion
                  </span>{' '}
                  interface. Two ship today; more are named in the design.{' '}
                  <ArrowLink href="/docs#hashlock">All criteria</ArrowLink>
                </>
              }
            />
          </Reveal>
          <Reveal className={styles.crit2}>
            <div className={styles.cell}>
              <div className={styles.top}>
                <div className={styles.ico}>
                  <Icon icon="eva:hash-outline" />
                </div>
                <h3>Hashlock</h3>
                <span className={styles.tag}>official</span>
              </div>
              <p>
                Release when a preimage hashing to a committed digest is revealed on-chain.
                Stateless — the primitive behind trustless atomic swaps and public unlocks.
              </p>
              <code>criterion_data_hash = SHA256(intent_bind ‖ SHA256(secret))</code>
            </div>
            <div className={styles.cell}>
              <div className={styles.top}>
                <div className={styles.ico}>
                  <Icon icon="eva:shield-outline" />
                </div>
                <h3>Validity · SP1</h3>
                <span className={styles.tag}>official</span>
              </div>
              <p>
                Release against a Groth16 proof verified on-chain by a committed verifying key.
                Settle on private or complex computation without revealing the witness.
              </p>
              <code>sp1_verify(proof, vkey_hash)</code>
            </div>
          </Reveal>
          <Reveal>
            <p className={styles.futureNote}>
              Named for future releases — each a criterion program plus a front-end, never a fork
              of the core:{' '}
              {FUTURE_CRITERIA.map((c, i) => (
                <span key={c}>
                  <strong>{c}</strong>
                  {i < FUTURE_CRITERIA.length - 1 ? ', ' : '.'}
                </span>
              ))}
            </p>
          </Reveal>
        </div>
      </section>

      {/* 5. The app family */}
      <section className={styles.block} id="products">
        <div className="wrap">
          <Reveal>
            <SecHead
              label="The app family"
              title={
                <>
                  The protocol stays general.
                  <br />
                  The products stay narrow.
                </>
              }
              sub={
                <>
                  The main site exposes every criterion for developers and power users. Each
                  spin-off hides the protocol behind one polished use case.{' '}
                  <ArrowLink href="/lab">Explore the Lab</ArrowLink>
                </>
              }
            />
          </Reveal>
          <Reveal className={styles.products}>
            {APP_FAMILY.map((p) =>
              p.live ? (
                <Link key={p.key} to={p.href} className={styles.product}>
                  <span className={`${styles.pbadge} ${styles.live}`}>● {p.status}</span>
                  <h3>{p.name}</h3>
                  <p>{p.desc}</p>
                </Link>
              ) : (
                <div key={p.key} className={styles.product}>
                  <span className={styles.pbadge}>{p.status}</span>
                  <h3>{p.name}</h3>
                  <p>{p.desc}</p>
                </div>
              ),
            )}
          </Reveal>
        </div>
      </section>

      {/* 6. For developers */}
      <section className={styles.block} id="build">
        <div className={`wrap ${styles.buildGrid}`}>
          <Reveal>
            <span className="label">For developers</span>
            <h2 className={`sec-title ${styles.buildTitle}`} style={{ fontSize: 'clamp(27px, 3.3vw, 38px)', lineHeight: 1.12, fontWeight: 'var(--fw-semibold)', letterSpacing: '-.02em' }}>
              A single typed SDK
              <br />
              talks to the chain.
            </h2>
            <p className={`${styles.heroSub} ${styles.buildSub}`} style={{ fontSize: 16 }}>
              UIs never hand-build instructions. The SDK derives PDAs, assembles criterion +
              settlement accounts, and pins the protocol constants. Role discovery is client-side,
              swappable for an indexer.
            </p>
            <div className={styles.buildBtns}>
              <Button variant="accent" as="a" href="/docs#quickstart">
                SDK quickstart <Icon icon="eva:arrow-forward-outline" />
              </Button>
              <ArrowLink href="https://github.com/LaplaceOne/Laplace" icon="mdi:github" target="_blank">
                GitHub
              </ArrowLink>
            </div>
          </Reveal>
          <Reveal>
            <CodeBlock filename="create-intent.ts">
              {createIntent.map((t, i) =>
                t.cls ? (
                  <span key={i} className={t.cls}>
                    {t.text}
                  </span>
                ) : (
                  t.text
                ),
              )}
            </CodeBlock>
          </Reveal>
        </div>
      </section>

      {/* 7. Live protocol stats */}
      <section className={styles.block} id="stats">
        <div className="wrap">
          <Reveal>
            <SecHead
              label="Live protocol stats"
              title="On devnet now."
              sub="Best-effort counts from client-side indexing. Slots are the source of truth."
            />
          </Reveal>
          <Reveal className={styles.statline}>
            <div className={styles.s}>
              <div className={styles.k}>Intents created</div>
              <div className={styles.v}>{fmt(stats?.total)}</div>
            </div>
            <div className={styles.s}>
              <div className={styles.k}>Fulfilled</div>
              <div className={styles.v}>{fmt(stats?.byStatus.fulfilled)}</div>
            </div>
            <div className={styles.s}>
              <div className={styles.k}>Refunded</div>
              <div className={styles.v}>{fmt(stats?.byStatus.refunded)}</div>
            </div>
            <div className={styles.s}>
              <div className={styles.k}>Active</div>
              <div className={styles.v}>{fmt(stats?.byStatus.active)}</div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 8. CTA */}
      <Reveal>
        <Cta
          title={
            <>
              Settle on <em>certainty</em>.
            </>
          }
          sub={CTA_SUB}
          buttons={
            <>
              <Button variant="accent" size="lg" as="a" href="/app">
                Launch console <Icon icon="eva:arrow-forward-outline" />
              </Button>
              <Button size="lg" as="a" href="https://github.com/LaplaceOne/Laplace">
                <Icon icon="mdi:github" /> View on GitHub
              </Button>
            </>
          }
        />
      </Reveal>
    </>
  );
}
