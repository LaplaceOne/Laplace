import { Button, CodeBlock, CopyButton, Icon, Reveal } from '@laplace/ui';
import { getCluster } from '@laplace/registry';
import { StateMachineDiagram } from '../components/diagrams/StateMachineDiagram';
import { useScrollSpy } from './useScrollSpy';
import { env } from '../env';
import { interfaceConstants, requestStruct, createIntentFull } from '../content/snippets';
import styles from './Docs.module.css';

const NPM_INSTALL = 'npm i @laplace/sdk';

const SECTION_IDS = [
  'overview',
  'lifecycle',
  'interface',
  'hashlock',
  'validity',
  'future',
  'quickstart',
  'programs',
];

const RAIL = [
  {
    label: undefined as string | undefined,
    links: [
      { id: 'overview', text: 'Overview' },
      { id: 'lifecycle', text: 'Intent lifecycle' },
      { id: 'interface', text: 'Criterion interface' },
    ],
  },
  {
    label: 'Criteria',
    links: [
      { id: 'hashlock', text: 'Hashlock' },
      { id: 'validity', text: 'Validity · SP1' },
      { id: 'future', text: 'Future criteria' },
    ],
  },
  {
    label: 'Build',
    links: [
      { id: 'quickstart', text: 'SDK quickstart' },
      { id: 'programs', text: 'Program IDs' },
    ],
  },
];

const FUTURE = [
  {
    icon: 'eva:edit-outline',
    name: 'Signature',
    desc: 'Release on an authorized signature over the intent — manual approval, OTC settlement.',
  },
  {
    icon: 'eva:eye-off-outline',
    name: 'Encrypted disclosure',
    desc: "Pay only when a seller publishes an encrypted secret plus a proof the plaintext satisfies the buyer's criteria.",
  },
  {
    icon: 'eva:link-2-outline',
    name: 'Cross-chain lock proof',
    desc: 'Prove a counterparty lock exists on another chain — ZK-assisted, trust-minimized cross-chain intents.',
  },
  {
    icon: 'eva:layers-outline',
    name: 'Multi-criterion',
    desc: 'Require several criteria together for complex workflows.',
  },
];

function tokens(arr: { text: string; cls?: string }[]) {
  return arr.map((t, i) =>
    t.cls ? (
      <span key={i} className={t.cls}>
        {t.text}
      </span>
    ) : (
      t.text
    ),
  );
}

export default function Docs() {
  const active = useScrollSpy(SECTION_IDS);
  const programs = getCluster(env.cluster).programs;

  return (
    <div className={`wrap ${styles.docsLayout}`}>
      <aside className={styles.docsRail}>
        <span className={`${styles.railLabel} label`}>Documentation</span>
        {RAIL.map((grp, gi) => (
          <div className={styles.grp} key={gi}>
            {grp.label && <span className={`${styles.railLabel} label`}>{grp.label}</span>}
            {grp.links.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                className={active === l.id ? styles.active : undefined}
                aria-current={active === l.id ? 'true' : undefined}
              >
                {l.text}
              </a>
            ))}
          </div>
        ))}
      </aside>

      <main className={styles.docsContent}>
        <section id="overview" className={styles.section}>
          <Reveal>
            <span className={styles.secTag}>Overview</span>
            <h2>One protocol, many faces.</h2>
            <p className={styles.lead}>
              Laplace is a Solana protocol for intent-based atomic settlement: a maker locks assets
              in an escrow that releases to a recipient only when a pluggable on-chain criterion is
              provably satisfied before expiry — otherwise the maker is refunded.
            </p>
            <p>
              Laplace is <strong>not a single app</strong>. It is a protocol with a small, auditable
              escrow core and a pluggable criterion interface, plus a family of front-ends built on a
              shared SDK. The escrow lifecycle never changes; each <em>criterion</em> defines what
              "the condition was met" means, and each can be packaged into a focused product.
            </p>
            <div className={styles.codeAbstraction} style={{ margin: '24px 0' }}>
              <CodeBlock filename="the core abstraction">
                {'Intent = escrow + recipient + refund recipient\n       + expiry + criterion program + criterion commitment'}
              </CodeBlock>
            </div>
            <p>
              The on-chain core owns only the escrow lifecycle. It does not know whether a criterion
              is a hashlock, a ZK proof, or a cross-chain attestation — it forwards a canonical{' '}
              <span className="mono" style={{ color: 'var(--text)' }}>
                CriterionVerificationRequest
              </span>{' '}
              to the configured criterion program by CPI and releases funds only if that CPI
              succeeds. That is what lets one protocol fan out into many products.
            </p>
          </Reveal>
        </section>

        <section id="lifecycle" className={styles.section}>
          <Reveal>
            <span className={styles.secTag}>Protocol</span>
            <h2>The intent lifecycle.</h2>
            <p>
              Every intent is a small on-chain state machine with four instructions and one-way
              transitions. It resolves to a proven fulfillment or an expiry refund — there is no
              third outcome.
            </p>
            <div style={{ margin: '28px 0' }}>
              <StateMachineDiagram />
            </div>
            <dl className={styles.deftable}>
              <div className={styles.defrow}>
                <dt>create_intent</dt>
                <dd>
                  Maker creates the intent PDA and locks SOL into it (or SPL tokens into a vault),
                  binding the criterion program, recipient, refund recipient, and expiry slot.
                </dd>
              </div>
              <div className={styles.defrow}>
                <dt>fulfill_with_criterion</dt>
                <dd>
                  A fulfiller submits fulfillment bytes + criterion accounts. The core forwards a
                  canonical request by CPI; on success it releases the escrow to the receiver and
                  marks the intent <code>Fulfilled</code>.
                </dd>
              </div>
              <div className={styles.defrow}>
                <dt>refund_expired_intent</dt>
                <dd>
                  Once <code>slot &gt; expiry_slot</code> and the intent is still Active, anyone can
                  crank the refund — funds return to the refund recipient.
                </dd>
              </div>
              <div className={styles.defrow}>
                <dt>close_intent</dt>
                <dd>
                  After Fulfilled or Refunded, the maker closes the account to reclaim rent (and
                  closes the SPL vault).
                </dd>
              </div>
            </dl>
            <p style={{ marginTop: 20 }}>
              <strong>Slots are the source of truth;</strong> wall-clock time is display-only. Every
              deadline polls{' '}
              <span className="mono" style={{ color: 'var(--text)' }}>
                getSlot
              </span>
              .
            </p>
          </Reveal>
        </section>

        <section id="interface" className={styles.section}>
          <Reveal>
            <span className={styles.secTag}>Protocol</span>
            <h2>The criterion interface.</h2>
            <p>
              Every pluggable criterion program exposes one instruction,{' '}
              <span className="mono" style={{ color: 'var(--text)' }}>
                verify_criterion
              </span>
              . The core calls it by CPI and releases escrow only if the CPI succeeds. The request
              is the security boundary — criteria must bind these fields to prevent a fulfillment
              accepted for one intent being replayed against another.
            </p>
            <div style={{ margin: '24px 0' }}>
              <CodeBlock filename="interface constants">{tokens(interfaceConstants)}</CodeBlock>
            </div>
            <div style={{ margin: '24px 0' }}>
              <CodeBlock filename="CriterionVerificationRequest">{tokens(requestStruct)}</CodeBlock>
            </div>
            <p>
              <span className="mono" style={{ color: 'var(--text)' }}>
                fulfill_with_criterion
              </span>{' '}
              takes a{' '}
              <span className="mono" style={{ color: 'var(--text)' }}>
                criterion_account_count
              </span>
              ; only that prefix of remaining-accounts is forwarded to the criterion, while later
              accounts are reserved for asset settlement. The core rejects passing protected
              accounts — the intent, receiver, and SPL vault — to the criterion.
            </p>
          </Reveal>
        </section>

        <section id="hashlock" className={styles.section}>
          <Reveal>
            <span className={styles.secTag}>Criteria</span>
            <h2>Hashlock.</h2>
            <p>
              The simplest settlement condition, and the primitive behind trustless atomic swaps.
              Release the escrow when a preimage hashing to a committed digest is revealed on-chain.
              Stateless — no config account.
            </p>
            <dl className={styles.deftable}>
              <div className={styles.defrow}>
                <dt>program</dt>
                <dd>
                  <code>{programs.hashlock}</code>
                </dd>
              </div>
              <div className={styles.defrow}>
                <dt>stateful?</dt>
                <dd>
                  No · <code>criterion_account_count = 0</code>
                </dd>
              </div>
              <div className={styles.defrow}>
                <dt>commitment</dt>
                <dd>
                  <code>criterion_data_hash = SHA256(intent_binding_hash ‖ hash_fn_id ‖ SHA256(secret))</code>
                </dd>
              </div>
              <div className={styles.defrow}>
                <dt>fulfillment</dt>
                <dd>
                  <code>fulfillment_data = secret</code>; the adapter recomputes the intent-bound
                  commitment from the live request and accepts iff it equals{' '}
                  <code>criterion_data_hash</code>
                </dd>
              </div>
            </dl>
            <div className={styles.warnBox} style={{ marginTop: 20, maxWidth: '64ch' }}>
              <Icon icon="eva:alert-triangle-outline" />
              <p>
                The adapter binds every fulfillment to the exact intent via{' '}
                <code>intent_binding_hash</code> (domain <code>laplace-intent-bind-v1</code>): a
                revealed secret <strong>cannot be replayed against any other intent</strong> — yet a
                shared secret still unlocks every leg of an atomic swap, since each leg recomputes the
                commitment from its own fields. Revealing a preimage on-chain is public and
                irreversible, so use <strong>high-entropy</strong> secrets generated client-side.
              </p>
            </div>
          </Reveal>
        </section>

        <section id="validity" className={styles.section}>
          <Reveal>
            <span className={styles.secTag}>Criteria</span>
            <h2>Validity · SP1.</h2>
            <p>
              Settle against arbitrary SP1 guest logic. The adapter verifies a Groth16-wrapped proof
              on-chain against a committed verifying key, letting an intent release on the truth of a
              private or complex computation without revealing the witness.
            </p>
            <dl className={styles.deftable}>
              <div className={styles.defrow}>
                <dt>program</dt>
                <dd>
                  <code>{programs.validity}</code>
                </dd>
              </div>
              <div className={styles.defrow}>
                <dt>stateful?</dt>
                <dd>
                  Yes — <code>ValidityConfig</code> PDA · <code>criterion_account_count = 1</code>
                </dd>
              </div>
              <div className={styles.defrow}>
                <dt>config</dt>
                <dd>
                  <code>config_hash = hash_config(guest_elf_hash, sp1_vkey_hash, fixed_public_inputs)</code>
                </dd>
              </div>
              <div className={styles.defrow}>
                <dt>commitment</dt>
                <dd>
                  intent <code>criterion_data_hash = config_hash</code>
                </dd>
              </div>
              <div className={styles.defrow}>
                <dt>fulfillment</dt>
                <dd>
                  <code>ValidityFulfillment {'{ proof, public_inputs_suffix }'}</code>; verified
                  against <code>sp1_vkey_hash</code> (~270–280k CU)
                </dd>
              </div>
            </dl>
            <p style={{ marginTop: 18 }}>
              The adapter prepends the 32-byte <code>intent_binding_hash</code> as the leading public
              input, binding the proof to this exact intent; the config's{' '}
              <code>fixed_public_inputs</code> carries only criterion constants, and the fulfiller
              supplies the suffix. Proof generation happens off-app for the MVP. The
              encrypted-disclosure profile builds on this criterion — a guest proves the plaintext
              satisfies the buyer's criteria and is bound to the published ciphertext.
            </p>
          </Reveal>
        </section>

        <section id="future" className={styles.section}>
          <Reveal>
            <span className={styles.secTag}>Criteria</span>
            <h2>Future criteria.</h2>
            <p>
              Named in the protocol design, not yet built. Each is a criterion program plus a
              front-end — never a fork of the escrow core.
            </p>
            <div className={styles.conds} style={{ marginTop: 8 }}>
              {FUTURE.map((c) => (
                <div className={styles.cond} key={c.name}>
                  <div className={styles.condIco}>
                    <Icon icon={c.icon} />
                  </div>
                  <h3>{c.name}</h3>
                  <p>{c.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        <section id="quickstart" className={styles.section}>
          <Reveal>
            <span className={styles.secTag}>Build</span>
            <h2>SDK quickstart.</h2>
            <p>
              A single typed SDK is the only thing that talks to the chain — UIs never hand-build
              instructions. Generated from the Anchor IDLs over{' '}
              <span className="mono" style={{ color: 'var(--text)' }}>
                @solana/kit
              </span>
              .
            </p>
            <div className={styles.install} style={{ margin: '20px 0' }}>
              <code>
                <span className={styles.pr}>$</span> {NPM_INSTALL}
              </code>
              <CopyButton value={NPM_INSTALL} />
            </div>
            <CodeBlock filename="create-intent.ts">{tokens(createIntentFull)}</CodeBlock>
            <p style={{ marginTop: 18 }}>
              Role discovery is client-side for now via{' '}
              <span className="mono" style={{ color: 'var(--text)' }}>
                getProgramAccounts
              </span>{' '}
              + memcmp, exposed as{' '}
              <span className="mono" style={{ color: 'var(--text)' }}>
                useIntents({'{ role }'})
              </span>{' '}
              so a dedicated indexer can be slotted in behind the same interface.
            </p>
          </Reveal>
        </section>

        <section id="programs" className={`${styles.section} ${styles.sectionLast}`}>
          <Reveal>
            <span className={styles.secTag}>Build</span>
            <h2>Program IDs.</h2>
            <p>
              Targets <strong>devnet</strong> first; the registry carries per-cluster addresses so
              mainnet is a config change, not a rewrite.
            </p>
            <dl className={styles.deftable}>
              <div className={styles.defrow}>
                <dt>laplace</dt>
                <dd>
                  <code>{programs.laplace}</code>
                </dd>
              </div>
              <div className={styles.defrow}>
                <dt>hashlock</dt>
                <dd>
                  <code>{programs.hashlock}</code>
                </dd>
              </div>
              <div className={styles.defrow}>
                <dt>validity</dt>
                <dd>
                  <code>{programs.validity}</code>
                </dd>
              </div>
            </dl>
            <div style={{ marginTop: 28, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Button variant="accent" as="a" href="/app">
                Launch console <Icon icon="eva:arrow-forward-outline" />
              </Button>
              <Button as="a" href="https://github.com/LaplaceOne/Laplace">
                <Icon icon="mdi:github" /> GitHub
              </Button>
            </div>
          </Reveal>
        </section>
      </main>
    </div>
  );
}
