import { Button, ArrowLink, Icon, Reveal } from '@laplace/ui';
import { PageHead } from '../marketing/PageHead';
import { SecHead } from '../marketing/SecHead';
import { Cta } from '../marketing/Cta';
import { RegistryCatalog } from './registry/RegistryCatalog';
import styles from './Registry.module.css';

export default function Registry() {
  return (
    <>
      {/* Page header */}
      <PageHead eyebrow="Community Registry" title={<>Permissionless protocol.<br /><em>Legible</em> trust.</>}>
        The Laplace core never whitelists — a maker can target any criterion program. So trust can&apos;t live in the protocol; it lives here, in the open: every criterion and SP1 guest carries a trust tier, its audit and build provenance, and its track record. Nothing is hidden, and friction scales with risk.
      </PageHead>

      {/* Trust model */}
      <section className="block" style={{ paddingBottom: '56px' }}>
        <div className="wrap">
          <Reveal>
            <SecHead
              label="The trust model"
              title={<>What&apos;s automatic,<br />what&apos;s on you.</>}
              sub={<>The protocol guarantees the <em>binding</em> cryptographically. Whether a criterion&apos;s <em>logic</em> is honest is a human judgment — the registry exists to inform it.</>}
            />
          </Reveal>
          <Reveal>
            <div className={styles.trustsplit}>
              <div className={`${styles.half} ${styles.halfAuto}`}>
                <div className={styles.halfIco}>
                  <Icon icon="eva:lock-outline" style={{ fontSize: '22px' }} />
                </div>
                <div className={styles.halfTagline}>Automatic · cryptographic</div>
                <h3>Binding is guaranteed</h3>
                <p>A fulfillment is bound to your exact intent — intent ID, parties, asset, amount, expiry, and criterion commitment all sit in the verification request. A proof or preimage accepted for one intent can never be replayed against another. The core enforces this; you don&apos;t have to check it.</p>
              </div>
              <div className={`${styles.half} ${styles.halfHuman}`}>
                <div className={styles.halfIco}>
                  <Icon icon="eva:eye-outline" style={{ fontSize: '22px' }} />
                </div>
                <div className={styles.halfTagline}>Human · judgment</div>
                <h3>Logic is your call</h3>
                <p>Whether a criterion releases <em>only</em> when it should is a property of its code. A buggy or malicious criterion could accept a fulfillment it shouldn&apos;t — releasing your escrow. The registry surfaces audits, verifiable builds, and track record so you can judge before you escrow.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Trust tiers */}
      <section className="block" style={{ paddingTop: '0', paddingBottom: '56px' }}>
        <div className="wrap">
          <Reveal>
            <SecHead
              label="Trust tiers"
              title={<>Five tiers.<br />Each earns its badge.</>}
              sub="A tier is assigned from evidence, not opinion: public source, a reproducible build that matches deployed bytecode, and an independent audit. Friction in the console scales with the tier."
            />
          </Reveal>
          <Reveal>
            <div className={styles.tierlegend}>
              <div className={styles.tl}>
                <span className={`${styles.tierBadge} ${styles.tierOfficial}`}>
                  <span className={styles.tdot} />Official
                </span>
                <p>In-repo, maintained by Laplace, audited, reproducible build. One-click in the console.</p>
              </div>
              <div className={styles.tl}>
                <span className={`${styles.tierBadge} ${styles.tierAudited}`}>
                  <span className={styles.tdot} />Audited
                </span>
                <p>Third-party audit on file, verified build, public source. Trusted, with the report linked.</p>
              </div>
              <div className={styles.tl}>
                <span className={`${styles.tierBadge} ${styles.tierCommunity}`}>
                  <span className={styles.tdot} />Community
                </span>
                <p>Source public &amp; build verified, but no audit. Usable — after you review the code.</p>
              </div>
              <div className={styles.tl}>
                <span className={`${styles.tierBadge} ${styles.tierUnverified}`}>
                  <span className={styles.tdot} />Unverified
                </span>
                <p>Only a program ID; no source, build, or audit. Heavy warning + typed acknowledgment.</p>
              </div>
              <div className={styles.tl}>
                <span className={`${styles.tierBadge} ${styles.tierFlagged}`}>
                  <span className={styles.tdot} />Flagged
                </span>
                <p>A known incident or deprecation. Hard-gated — the console blocks new intents.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Catalog */}
      <section className="block" style={{ paddingTop: '0' }}>
        <div className="wrap">
          <Reveal>
            <RegistryCatalog />
          </Reveal>
        </div>
      </section>

      {/* Submission pipeline */}
      <section id="submit" className="block" style={{ paddingTop: '0' }}>
        <div className="wrap">
          <Reveal>
            <SecHead
              label="List your criterion"
              title={<>Submission is a<br />review pipeline.</>}
              sub="Authoring happens out-of-band (deploy a program, or build an SP1 guest + vkey). Listing it here is a transparent, staged review — automated checks first, humans and auditors after. The tier is the outcome, not the input."
            />
          </Reveal>
          <Reveal>
            <div className={styles.pipeline}>
              <div className={styles.pstep}>
                <div className={styles.pn}>1</div>
                <h4>Submit</h4>
                <p>Link the program ID + cluster (or guest ELF + vkey), the public source repo, and a commit.</p>
                <ul>
                  <li>program / vkey</li>
                  <li>source @ commit</li>
                  <li>declared interface</li>
                </ul>
              </div>
              <div className={styles.pstep}>
                <div className={styles.pn}>2</div>
                <h4>Automated checks</h4>
                <p>Run before any human looks. A failure stops the listing.</p>
                <ul>
                  <li>bytecode == source</li>
                  <li>verify discriminator</li>
                  <li>account-count declared</li>
                  <li>replay-binding self-test</li>
                </ul>
              </div>
              <div className={styles.pstep}>
                <div className={styles.pn}>3</div>
                <h4>Review</h4>
                <p>Maintainers review the PR for interface conformance and intent-field binding.</p>
                <ul>
                  <li>conformance read</li>
                  <li>binding review</li>
                  <li>metadata + warnings</li>
                </ul>
              </div>
              <div className={styles.pstep}>
                <div className={styles.pn}>4</div>
                <h4>Audit &amp; list</h4>
                <p>An audit promotes the tier from Community to Audited. Listed with its full dossier.</p>
                <ul>
                  <li>tier assigned</li>
                  <li>dossier published</li>
                  <li>usage tracked</li>
                </ul>
              </div>
            </div>
          </Reveal>
          <Reveal>
            <div className={styles.submitActions}>
              <a
                className="btn btn--accent"
                href="https://github.com/LaplaceOne/Laplace"
                target="_blank"
                rel="noopener"
              >
                Submit a PR <Icon icon="mdi:github" />
              </a>
              <ArrowLink href="/docs#interface">Read the criterion interface</ArrowLink>
            </div>
            <p className={styles.roadmapNote}>
              <strong>On the roadmap:</strong> the registry is a curated, PR-reviewed dataset today. As curation needs to be trust-minimized, an on-chain registry with reputation and governance can back the same interface — open questions remain on who governs listings and how deprecations are signaled. The UI above is designed to be unchanged when that backing moves on-chain.
            </p>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <Cta
        title={<>Trust, made <em>legible</em>.</>}
        sub="Browse criteria and guests with their provenance in the open, then escrow in the console with friction that matches the risk."
        buttons={
          <>
            <Button variant="accent" size="lg" as="a" href="/app">
              Launch console <Icon icon="eva:arrow-forward-outline" />
            </Button>
            <Button size="lg" as="a" href="/docs#interface">
              Criterion interface
            </Button>
          </>
        }
      />
    </>
  );
}
