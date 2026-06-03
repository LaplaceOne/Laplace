/* ============================================================
   Laplace Community Registry — data + render + interactions
   Criteria (deployed programs) and Validity guests (SP1).
   Trust is tiered; provenance is shown; nothing is hidden.
   ============================================================ */
(function () {
  'use strict';

  // ---- trust tiers ----
  var TIERS = {
    official:   { label: 'Official',   cls: 'official',   blurb: 'Built & maintained in-repo, audited, reproducible build.' },
    audited:    { label: 'Audited',    cls: 'audited',    blurb: 'Third-party audit on file, verified build, public source.' },
    community:  { label: 'Community',  cls: 'community',  blurb: 'Source public & build verified — but no audit. Review the code.' },
    unverified: { label: 'Unverified', cls: 'unverified', blurb: 'Only a program ID. No source, build, or audit. High risk.' },
    flagged:    { label: 'Flagged',    cls: 'flagged',    blurb: 'A known incident or deprecation. Interaction is hard-gated.' }
  };

  // ---- criteria ----
  var CRITERIA = [
    { key: 'hashlock', name: 'Hashlock', kind: 'Preimage', tier: 'official',
      desc: 'Releases when a preimage hashing to a committed digest is revealed on-chain. The primitive behind atomic swaps.',
      verify: 'SHA256(fulfillment_data) == criterion_data_hash',
      audit: { by: 'OtterSec', date: '2025-11', findings: '1 low · resolved', url: '#' },
      build: { repo: 'LaplaceOne/Laplace', commit: '31bde10', match: true },
      conformance: { binds: 'partial', accounts: 0, version: 2, note: 'Checks preimage only — does not yet bind intent fields. Use unique, high-entropy secrets.' },
      usage: { settled: 947, value: '3.1k SOL', since: '8 mo' }, incidents: 'None',
      programId: '9FWQGf16ZB5wdrwg3gDCmUcpRJNVuzp1uG12C6z5RVTw' },

    { key: 'validity', name: 'Validity · SP1', kind: 'ZK proof', tier: 'official',
      desc: 'Releases against a Groth16-wrapped SP1 proof verified on-chain by a committed verifying key. Powers private & complex settlement.',
      verify: 'sp1_verify(proof, public_inputs, vkey_hash) && config_hash == hash_config(...)',
      audit: { by: 'Zellic', date: '2025-12', findings: '2 low · resolved', url: '#' },
      build: { repo: 'LaplaceOne/Laplace', commit: '31bde10', match: true },
      conformance: { binds: 'full', accounts: 1, version: 2, note: 'Binds intent fields via the fixed public-input prefix committed in ValidityConfig.' },
      usage: { settled: 312, value: '1.4k SOL', since: '6 mo' }, incidents: 'None',
      programId: 'CuSVyvxRCfnsvvDWWqP8xRw8fNbGRwTdam5iKsqY3Kq1' },

    { key: 'twap', name: 'TWAP Oracle Gate', kind: 'Oracle', tier: 'audited',
      desc: 'Releases when a committed price feed\'s time-weighted average crosses a strike at fulfillment. Reads the oracle by CPI.',
      verify: 'oracle.twap(feed, window) >= strike  (intent-bound)',
      audit: { by: 'Neodyme', date: '2026-02', findings: '0 high · 3 low · resolved', url: '#' },
      build: { repo: 'community/laplace-twap', commit: 'a91f0c4', match: true },
      conformance: { binds: 'full', accounts: 1, version: 2, note: 'Binds intent_id, criterion_data_hash, and strike into the request.' },
      usage: { settled: 128, value: '420 SOL', since: '3 mo' }, incidents: 'None',
      programId: 'TWAPgate7kQ2hN8vRpa3FtL9wXcUe7yD4sZ1mGoJ2x' },

    { key: 'signature', name: 'Signature Approval', kind: 'Signature', tier: 'community',
      desc: 'Releases on an authorized Ed25519 signature over the intent — manual approval and OTC settlement.',
      verify: 'ed25519_verify(signer, sig, intent_message)',
      audit: null,
      build: { repo: 'community/laplace-signature', commit: '6d2e88b', match: true },
      conformance: { binds: 'full', accounts: 0, version: 2, note: 'Signs over intent_id + domain separator.' },
      usage: { settled: 41, value: '90 SOL', since: '2 mo' }, incidents: 'None',
      programId: 'SiG1nApprov4nW2kT8nQp3vRcL5xZe1yD9sH3bF2jU' },

    { key: 'merkle', name: 'Merkle Allowlist', kind: 'Membership', tier: 'community',
      desc: 'Releases when the fulfiller proves membership in a committed Merkle root. Allowlisted claims & airdrops.',
      verify: 'merkle_verify(root, leaf, path)',
      audit: null,
      build: { repo: 'community/laplace-merkle', commit: '0fa7d31', match: true },
      conformance: { binds: 'partial', accounts: 0, version: 2, note: 'Binds root but not amount — review for your use case.' },
      usage: { settled: 19, value: '12 SOL', since: '5 wk' }, incidents: 'None',
      programId: 'Mrk1eA11ow8kP5nR2wQa8vXcL3mZe7yT2sH8bF6jUo' },

    { key: 'multisig', name: 'Multisig Approval', kind: 'Signature', tier: 'unverified',
      desc: 'Claims to release on an m-of-n multisig over the intent. Source is not published and the build is unverified.',
      verify: 'unverified — bytecode does not match any published source',
      audit: null,
      build: null,
      conformance: { binds: 'unknown', accounts: 1, version: 2, note: 'Interface conformance could not be verified. Do not escrow against this without reading the deployed bytecode yourself.' },
      usage: { settled: 3, value: '0.4 SOL', since: '1 wk' }, incidents: 'None reported',
      programId: 'Mu1tiSig9kP8nR5wQa2vXcL1mZe4yT7sH5bF9jUoKd' }
  ];

  // ---- validity guests ----
  var GUESTS = [
    { key: 'fib', name: 'Fibonacci (reference)', tier: 'official',
      proves: 'The n-th Fibonacci number was computed correctly. The reference guest shipped with the validity adapter.',
      statement: 'output == fib(n)   // n fixed in config',
      schema: ['domain_separator', 'program_id', 'intent_id', 'criterion_data_hash', 'n', 'output'],
      elfHash: '0x4c…e1', vkeyHash: '0x9a3f…2b',
      build: { repo: 'succinctlabs/sp1-solana', commit: 'fixture', elfMatch: true, vkeyMatch: true },
      audit: { by: 'Succinct', date: '2025-10', findings: 'reference fixture', url: '#' },
      configs: 1, usage: { settled: 58, since: '6 mo' } },

    { key: 'solvency', name: 'Proof of Solvency', tier: 'audited',
      proves: 'Committed reserves are greater than or equal to committed liabilities, without revealing either balance.',
      statement: 'sum(reserves) >= sum(liabilities)',
      schema: ['domain_separator', 'intent_id', 'criterion_data_hash', 'reserves_root', 'liabilities_root', 'ok'],
      elfHash: '0x7c…12', vkeyHash: '0x5e21…aa',
      build: { repo: 'community/guest-solvency', commit: 'b4419ee', elfMatch: true, vkeyMatch: true },
      audit: { by: 'Zellic', date: '2026-01', findings: '1 medium · resolved', url: '#' },
      configs: 4, usage: { settled: 71, since: '3 mo' } },

    { key: 'disclosure', name: 'Encrypted Disclosure (XOR)', tier: 'official',
      proves: 'The plaintext satisfies the buyer\'s criteria AND the published ciphertext is bound to that exact secret.',
      statement: 'criteria(secret) && ciphertext_hash == hash(encrypt(secret, buyer_pk, r))',
      schema: ['intent_id', 'criterion_data_hash', 'buyer_pubkey', 'criteria_hash', 'ciphertext_hash'],
      elfHash: '0xa1…9f', vkeyHash: '0x33c0…41',
      build: { repo: 'LaplaceOne/Laplace', commit: '31bde10', elfMatch: true, vkeyMatch: true },
      audit: { by: 'in review', date: '2026-03', findings: 'audit in progress', url: '#' },
      configs: 2, usage: { settled: 9, since: '4 wk' } },

    { key: 'modelrun', name: 'Model-run Attestation', tier: 'community',
      proves: 'A committed model produced a committed output on a committed input. Proof-gated payouts for compute.',
      statement: 'output == model(input)   // weights committed',
      schema: ['intent_id', 'criterion_data_hash', 'model_hash', 'input_hash', 'output_hash'],
      elfHash: '0xe9…07', vkeyHash: '0x71b2…0c',
      build: { repo: 'community/guest-modelrun', commit: '2c5d8a1', elfMatch: true, vkeyMatch: true },
      audit: null,
      configs: 1, usage: { settled: 4, since: '2 wk' } },

    { key: 'kyc', name: 'Compliance Attestation', tier: 'community',
      proves: 'The fulfiller holds a valid attestation (KYC/AML) from a committed issuer — without revealing the underlying data.',
      statement: 'verify_attestation(issuer_pk, attestation) && fields_match',
      schema: ['intent_id', 'criterion_data_hash', 'issuer_pubkey', 'policy_hash', 'valid'],
      elfHash: '0x2d…b8', vkeyHash: '0x88f1…6e',
      build: { repo: 'community/guest-compliance', commit: '9efb220', elfMatch: true, vkeyMatch: false },
      audit: null,
      configs: 0, usage: { settled: 0, since: 'new' } }
  ];

  // ---- helpers ----
  function tierBadge(t) { var m = TIERS[t]; return '<span class="tier ' + m.cls + '"><span class="td"></span>' + m.label + '</span>'; }
  function trunc(s) { return s.length > 16 ? s.slice(0, 6) + '…' + s.slice(-6) : s; }
  function check(ok, yes, no) { return ok
    ? '<span class="ok"><iconify-icon icon="eva:checkmark-circle-2"></iconify-icon> ' + yes + '</span>'
    : '<span class="no"><iconify-icon icon="eva:close-circle-outline"></iconify-icon> ' + (no || 'no') + '</span>'; }

  var tab = 'criteria';
  var tierFilter = 'all';

  // ---- criterion dossier ----
  function critDossier(c) {
    var bindLabel = { full: 'Binds intent fields', partial: 'Partial binding', unknown: 'Binding unverified' }[c.conformance.binds];
    var bindOk = c.conformance.binds === 'full';
    var auditHtml = c.audit
      ? '<div class="dz-fact"><iconify-icon icon="eva:shield-outline"></iconify-icon><div><b>Audited · ' + c.audit.by + '</b><span>' + c.audit.date + ' · ' + c.audit.findings + ' · <a href="' + c.audit.url + '">report</a></span></div></div>'
      : '<div class="dz-fact warn"><iconify-icon icon="eva:alert-triangle-outline"></iconify-icon><div><b>No audit on file</b><span>This criterion has not been independently audited.</span></div></div>';
    var buildHtml = c.build
      ? '<div class="dz-fact"><iconify-icon icon="eva:checkmark-circle-2"></iconify-icon><div><b>Verified build</b><span>deployed bytecode matches <span class="mono">' + c.build.repo + '@' + c.build.commit + '</span></span></div></div>'
      : '<div class="dz-fact warn"><iconify-icon icon="eva:alert-triangle-outline"></iconify-icon><div><b>Unverified build</b><span>deployed bytecode does not match any published source</span></div></div>';
    var friction = c.tier === 'official' || c.tier === 'audited'
      ? '<a class="act-btn" href="app.html">Use in console</a>'
      : (c.tier === 'community'
        ? '<a class="act-btn ghost" href="app.html">Use — review the code first</a>'
        : '<a class="act-btn warnbtn" href="app.html">Use at your own risk</a>');
    return '<div class="dossier">' +
      '<div class="dz-grid">' +
        '<div class="dz-block"><div class="dz-h">What you\'re trusting</div><p>' + c.desc + '</p>' +
          '<div class="serialized" style="margin-top:10px;"><span class="k">verify</span> · ' + c.verify + '</div></div>' +
        '<div class="dz-block"><div class="dz-h">Provenance</div>' + auditHtml + buildHtml +
          '<div class="dz-fact"><iconify-icon icon="' + (bindOk ? 'eva:checkmark-circle-2' : 'eva:alert-triangle-outline') + '"></iconify-icon><div><b>' + bindLabel + '</b><span>' + c.conformance.note + '</span></div></div>' +
        '</div>' +
      '</div>' +
      '<div class="dz-stats">' +
        '<div><span class="k">Intents settled</span><span class="v">' + c.usage.settled + '</span></div>' +
        '<div><span class="k">Value routed</span><span class="v">' + c.usage.value + '</span></div>' +
        '<div><span class="k">Live since</span><span class="v">' + c.usage.since + '</span></div>' +
        '<div><span class="k">Incidents</span><span class="v">' + c.incidents + '</span></div>' +
        '<div><span class="k">Interface</span><span class="v">v' + c.conformance.version + ' · acc ' + c.conformance.accounts + '</span></div>' +
      '</div>' +
      '<div class="dz-foot"><div class="dz-pid"><span class="k">program</span> <span class="mono">' + c.programId + '</span></div>' + friction + '</div>' +
    '</div>';
  }

  // ---- guest dossier ----
  function guestDossier(g) {
    var auditHtml = g.audit
      ? '<div class="dz-fact"><iconify-icon icon="eva:shield-outline"></iconify-icon><div><b>' + (g.audit.findings === 'audit in progress' ? 'Audit in progress' : 'Audited · ' + g.audit.by) + '</b><span>' + g.audit.date + ' · ' + g.audit.findings + '</span></div></div>'
      : '<div class="dz-fact warn"><iconify-icon icon="eva:alert-triangle-outline"></iconify-icon><div><b>No audit on file</b><span>Guest logic has not been independently audited.</span></div></div>';
    return '<div class="dossier">' +
      '<div class="dz-grid">' +
        '<div class="dz-block"><div class="dz-h">What it proves</div><p>' + g.proves + '</p>' +
          '<div class="serialized" style="margin-top:10px;">' + g.statement + '</div>' +
          '<div class="dz-h" style="margin-top:16px;">Public inputs</div><div class="schema">' + g.schema.map(function (s) { return '<span>' + s + '</span>'; }).join('') + '</div></div>' +
        '<div class="dz-block"><div class="dz-h">Reproducible build</div>' +
          '<div class="dz-fact">' + check(g.build.elfMatch, 'guest_elf_hash matches', '') + '<div><span class="mono" style="font-size:11px;">' + g.elfHash + ' · ' + g.build.repo + '@' + g.build.commit + '</span></div></div>' +
          '<div class="dz-fact">' + (g.build.vkeyMatch
            ? '<iconify-icon icon="eva:checkmark-circle-2"></iconify-icon><div><b>vkey matches</b><span>sp1_vkey_hash == vk.bytes32() · ' + g.vkeyHash + '</span></div>'
            : '<iconify-icon icon="eva:alert-triangle-outline"></iconify-icon><div><b>vkey mismatch</b><span>published guest does not reproduce ' + g.vkeyHash + '</span></div>') + '</div>' +
          auditHtml +
        '</div>' +
      '</div>' +
      '<div class="dz-stats">' +
        '<div><span class="k">ValidityConfigs</span><span class="v">' + g.configs + '</span></div>' +
        '<div><span class="k">Intents settled</span><span class="v">' + g.usage.settled + '</span></div>' +
        '<div><span class="k">Live since</span><span class="v">' + g.usage.since + '</span></div>' +
      '</div>' +
      '<div class="dz-foot"><div class="dz-pid"><span class="k">vkey</span> <span class="mono">' + g.vkeyHash + '</span></div>' +
        (g.build.vkeyMatch ? '<a class="act-btn ghost" href="app.html">Create a ValidityConfig</a>' : '<span class="act-note">vkey unverified — cannot use</span>') + '</div>' +
    '</div>';
  }

  // ---- cards ----
  function critCard(c) {
    return '<div class="rcard" data-tier="' + c.tier + '" data-key="c-' + c.key + '">' +
      '<button class="rcard__head" data-toggle="c-' + c.key + '">' +
        '<div class="rcard__id"><div class="rcard__name">' + c.name + ' ' + tierBadge(c.tier) + '</div>' +
          '<div class="rcard__sub"><span class="kindtag">' + c.kind + '</span> · ' + (c.audit ? 'audited ' + c.audit.by : 'no audit') + ' · ' + (c.build ? 'verified build' : 'unverified build') + '</div></div>' +
        '<div class="rcard__right"><span class="usage">' + c.usage.settled + ' settled</span><iconify-icon icon="eva:chevron-down-outline" class="chev"></iconify-icon></div>' +
      '</button>' +
      '<div class="rcard__body">' + critDossier(c) + '</div>' +
    '</div>';
  }
  function guestCard(g) {
    return '<div class="rcard" data-tier="' + g.tier + '" data-key="g-' + g.key + '">' +
      '<button class="rcard__head" data-toggle="g-' + g.key + '">' +
        '<div class="rcard__id"><div class="rcard__name">' + g.name + ' ' + tierBadge(g.tier) + '</div>' +
          '<div class="rcard__sub"><span class="kindtag">SP1 guest</span> · ' + (g.audit ? (g.audit.findings === 'audit in progress' ? 'audit in progress' : 'audited ' + g.audit.by) : 'no audit') + ' · ' + (g.build.vkeyMatch ? 'vkey verified' : 'vkey mismatch') + '</div></div>' +
        '<div class="rcard__right"><span class="usage">' + g.configs + ' configs</span><iconify-icon icon="eva:chevron-down-outline" class="chev"></iconify-icon></div>' +
      '</button>' +
      '<div class="rcard__body">' + guestDossier(g) + '</div>' +
    '</div>';
  }

  function render() {
    var wrap = document.getElementById('catalog');
    var data = tab === 'criteria' ? CRITERIA : GUESTS;
    var items = data.filter(function (d) { return tierFilter === 'all' || d.tier === tierFilter; });
    wrap.innerHTML = items.length
      ? items.map(tab === 'criteria' ? critCard : guestCard).join('')
      : '<div class="empty"><iconify-icon icon="eva:search-outline"></iconify-icon><h3>Nothing in this tier</h3><p>No ' + tab + ' match this trust filter.</p></div>';
  }

  // ---- interactions ----
  document.addEventListener('click', function (e) {
    var tb = e.target.closest('[data-tab]');
    if (tb) { tab = tb.dataset.tab; tierFilter = 'all';
      document.querySelectorAll('[data-tab]').forEach(function (x) { x.classList.toggle('active', x === tb); });
      document.querySelectorAll('.tfilter').forEach(function (x) { x.classList.toggle('active', x.dataset.tier === 'all'); });
      document.getElementById('tabHint').textContent = tab === 'criteria'
        ? 'Deployed Solana programs that plug into the verify_criterion interface.'
        : 'SP1 guest programs whose proofs the validity criterion verifies.';
      render(); return; }

    var tf = e.target.closest('.tfilter');
    if (tf) { tierFilter = tf.dataset.tier;
      document.querySelectorAll('.tfilter').forEach(function (x) { x.classList.toggle('active', x === tf); });
      render(); return; }

    var tg = e.target.closest('[data-toggle]');
    if (tg) {
      var card = document.querySelector('.rcard[data-key="' + tg.dataset.toggle + '"]');
      card.classList.toggle('open');
      return;
    }
  });

  render();
  window.__registryReady = true;
})();
