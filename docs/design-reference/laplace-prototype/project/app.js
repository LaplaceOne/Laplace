/* ============================================================
   Laplace Console — interactive prototype logic
   Mock data + view switching + live countdowns. No chain calls.
   ============================================================ */
(function () {
  'use strict';

  // ---- wallet (mock) ----
  var ME = { name: 'You', pk: '7Lp4xKq9rT3mWvb8sN2dHfgPzaE1nQ5cV9xQrAa' };
  var connected = false;

  // ---- parties (mock) ----
  var P = {
    bob:   'Bob5kQ2hN8vRpa3FtL9wXcUe7yD4sZ1mGoJbHr6Ku',
    carol: 'Caro1zV7bM4nKpQ9rWxe2LtY8hD5sF3jUaGc1NvBt',
    dave:  'Dave8nR3kP6wQa2vXcL7mZe9yT4sH1bF5jUoKdGr2',
    eve:   'Eve2mW9kT5nQp8vRcL3xZe6yD7sH4bF1jUaGoKr8',
    frank: 'Fran7kP2nR8wQa5vXcL9mZe3yT6sH2bF4jUoKdGc',
    grace: 'Grac3nW8kT2nQp5vRcL7xZe9yD4sH6bF8jUaGoK1',
    heidi: 'Heid9kP5nR2wQa8vXcL3mZe7yT2sH8bF6jUoKdGr',
    ivan:  'Ivan4nW2kT8nQp3vRcL5xZe1yD9sH3bF2jUaGoKt',
    judy:  'Judy6kP8nR5wQa2vXcL1mZe4yT7sH5bF9jUoKdGc'
  };

  var now = Date.now();
  var SLOT0 = 318894512; // mock current slot
  function tsToSlot(ts) { return SLOT0 + Math.round((ts - now) / 400); }

  // ---- mock intents ----
  var INTENTS = [
    { id: 'GhPADXrk91',  maker: ME.pk,   receiver: P.bob,   refund: ME.pk,   asset: 'SOL',  amount: 5,    criterion: 'hashlock', status: 'Active',    exp: now + 47*60e3,  created: now - 13*60e3 },
    { id: 'C4rZ8mQ2pV',  maker: P.carol, receiver: ME.pk,   refund: P.carol, asset: 'USDC', amount: 1200, criterion: 'hashlock', status: 'Active',    exp: now + 11*60e3,  created: now - 49*60e3 },
    { id: 'Tm9Kd3Wb7X',  maker: ME.pk,   receiver: P.dave,  refund: ME.pk,   asset: 'USDC', amount: 250,  criterion: 'validity', status: 'Active',    exp: now + 130*60e3, created: now - 20*60e3 },
    { id: 'Rf2Nx6Lp8Q',  maker: P.eve,   receiver: P.frank, refund: ME.pk,   asset: 'SOL',  amount: 3,    criterion: 'hashlock', status: 'Active',    exp: now - 8*60e3,   created: now - 240*60e3 },
    { id: 'Vk7Bh1Zs5W',  maker: ME.pk,   receiver: P.grace, refund: ME.pk,   asset: 'SOL',  amount: 0.5,  criterion: 'hashlock', status: 'Fulfilled', exp: now - 60*60e3,  created: now - 180*60e3 },
    { id: 'Qw3Mn8Td2Y',  maker: ME.pk,   receiver: P.heidi, refund: ME.pk,   asset: 'USDC', amount: 800,  criterion: 'validity', status: 'Refunded',  exp: now - 90*60e3,  created: now - 300*60e3 },
    { id: 'Zx5Cv2Rk9N',  maker: P.ivan,  receiver: ME.pk,   refund: P.ivan,  asset: 'USDC', amount: 25,   criterion: 'validity', status: 'Active',    exp: now + 300*60e3, created: now - 5*60e3 },
    { id: 'Bn8Wq4Lf6T',  maker: ME.pk,   receiver: P.judy,  refund: ME.pk,   asset: 'SOL',  amount: 2,    criterion: 'hashlock', status: 'Closed',    exp: now - 600*60e3, created: now - 720*60e3 }
  ];

  // ---- helpers ----
  function trunc(pk) { return pk.slice(0, 4) + '…' + pk.slice(-4); }
  function partyLabel(pk) { return pk === ME.pk ? 'You' : trunc(pk); }
  function fmtAmt(n) { return n.toLocaleString('en-US', { maximumFractionDigits: 4 }); }
  function isExpired(it) { return Date.now() > it.exp; }
  function effStatus(it) {
    if (it.status === 'Active' && !isExpired(it)) {
      return (it.exp - Date.now() < 15*60e3) ? 'Expiring soon' : 'Active';
    }
    return it.status;
  }
  function critMeta(k) {
    if (k === 'hashlock') return { icon: 'eva:hash-outline', name: 'Hashlock' };
    if (k === 'custom') return { icon: 'eva:code-outline', name: 'Custom · unverified' };
    return { icon: 'eva:shield-outline', name: 'Validity · SP1' };
  }
  function countdownText(it) {
    var d = it.exp - Date.now();
    if (d <= 0) return 'expired';
    var m = Math.floor(d / 60000), s = Math.floor((d % 60000) / 1000);
    if (m >= 60) { var h = Math.floor(m / 60); return h + 'h ' + (m % 60) + 'm'; }
    return m + 'm ' + (s < 10 ? '0' + s : s) + 's';
  }

  // role-aware primary action — returns {label, kind, enabled, note}
  function actionFor(it) {
    var expired = isExpired(it);
    if (it.status === 'Active' && !expired && it.receiver === ME.pk) {
      return { label: 'Fulfill', kind: 'fulfill', enabled: true };
    }
    if (it.status === 'Active' && expired && it.refund === ME.pk) {
      return { label: 'Refund', kind: 'refund', enabled: true };
    }
    if ((it.status === 'Fulfilled' || it.status === 'Refunded') && it.maker === ME.pk) {
      return { label: 'Close', kind: 'close', enabled: true };
    }
    if (it.status === 'Active' && it.maker === ME.pk && !expired) {
      return { label: it.criterion === 'hashlock' ? 'Awaiting reveal' : (it.criterion === 'validity' ? 'Awaiting proof' : 'Awaiting fulfillment'), kind: 'none', enabled: false };
    }
    if (it.status === 'Closed') return { label: 'Closed', kind: 'none', enabled: false };
    if (it.status === 'Active' && expired) return { label: 'Expired', kind: 'none', enabled: false };
    return { label: 'No action', kind: 'none', enabled: false };
  }

  // ---- state ----
  var roleFilter = 'all';
  var statusFilter = 'All';
  var currentView = 'dashboard';
  var detailId = null;

  // ---- DOM refs ----
  var els = {};
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  // ---- view switching ----
  function showView(name) {
    currentView = name;
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.dataset.view === name); });
    document.querySelectorAll('.app-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.go === name); });
    window.scrollTo(0, 0);
    if (name === 'dashboard') renderDashboard();
    if (name === 'manual') renderManual();
  }

  // ---- dashboard ----
  function filtered() {
    return INTENTS.filter(function (it) {
      if (roleFilter === 'mine' && it.maker !== ME.pk) return false;
      if (roleFilter === 'tome' && it.receiver !== ME.pk) return false;
      if (roleFilter === 'refundable' && !(it.refund === ME.pk && it.maker !== ME.pk)) return false;
      if (statusFilter !== 'All') {
        var es = effStatus(it);
        if (statusFilter === 'Active' && es !== 'Active') return false;
        if (statusFilter === 'Expiring soon' && es !== 'Expiring soon') return false;
        if (statusFilter === 'Fulfilled' && es !== 'Fulfilled') return false;
        if (statusFilter === 'Refunded' && es !== 'Refunded') return false;
        if (statusFilter === 'Closed' && es !== 'Closed') return false;
      }
      return true;
    });
  }

  function renderStats() {
    var strip = $('#statstrip'); if (!strip) return;
    var active = 0, fulfilled = 0, refunded = 0, sol = 0, usdc = 0;
    INTENTS.forEach(function (it) {
      var es = effStatus(it);
      if (es === 'Active' || es === 'Expiring soon') { active++; if (it.asset === 'SOL') sol += it.amount; else usdc += it.amount; }
      if (es === 'Fulfilled') fulfilled++;
      if (es === 'Refunded') refunded++;
    });
    strip.innerHTML =
      stat('Active intents', active) +
      stat('Fulfilled', fulfilled) +
      stat('Refunded', refunded) +
      '<div class="stat"><div class="k">Escrowed · active</div><div class="v">' + fmtAmt(sol) + '<small>SOL</small> · ' + fmtAmt(usdc) + '<small>USDC</small></div></div>';
  }
  function stat(k, v) { return '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'; }

  function intentCard(it) {
    var c = critMeta(it.criterion);
    var es = effStatus(it);
    var sb = statusBadge(es);
    var act = actionFor(it);
    var cd = it.status === 'Active'
      ? '<span class="countdown' + (isExpired(it) ? ' past' : (es === 'Expiring soon' ? ' urgent' : '')) + '" data-exp="' + it.id + '">' + countdownText(it) + '</span>'
      : '<span class="countdown past">—</span>';
    var actBtn = act.enabled
      ? '<button class="act-btn ' + (act.kind === 'close' ? 'neutral' : (act.kind === 'refund' ? 'ghost' : '')) + '" data-act="' + it.id + '">' + act.label + '</button>'
      : '<span class="act-note">' + act.label + '</span>';
    var card = el('div', 'icard');
    card.dataset.id = it.id;
    card.innerHTML =
      '<div class="icard__top">' +
        '<div class="icard__amt">' + fmtAmt(it.amount) + '<span class="asset">' + it.asset + '</span></div>' +
        sb +
      '</div>' +
      '<div class="icard__crit"><iconify-icon icon="' + c.icon + '"></iconify-icon>' + c.name + '</div>' +
      '<div class="icard__row"><span class="lbl">' + (it.receiver === ME.pk ? 'From' : 'To') + '</span>' +
        '<span class="val">' + (it.receiver === ME.pk ? partyLabel(it.maker) : partyLabel(it.receiver)) + '</span></div>' +
      '<div class="icard__row"><span class="lbl">' + (it.status === 'Active' ? 'Expires in' : 'Intent') + '</span>' +
        (it.status === 'Active' ? cd : '<span class="val">' + it.id + '</span>') + '</div>' +
      '<div class="icard__foot">' + actBtn + '<span class="act-note">' + it.id + '</span></div>';
    return card;
  }
  function statusBadge(es) {
    var map = { 'Active': 'active', 'Expiring soon': 'expiring', 'Fulfilled': 'fulfilled', 'Refunded': 'refunded', 'Closed': 'closed' };
    return '<span class="sbadge ' + map[es] + '"><span class="sd"></span>' + es + '</span>';
  }

  function renderDashboard() {
    renderStats();
    var grid = $('#intentGrid'); if (!grid) return;
    var list = filtered();
    grid.innerHTML = '';
    if (!list.length) {
      grid.style.display = 'block';
      grid.innerHTML = '<div class="empty"><iconify-icon icon="eva:cube-outline"></iconify-icon><h3>No intents here</h3><p>Nothing matches this filter. Create one to get started.</p><button class="btn btn--accent" data-go="create" style="margin:0 auto;">Create intent</button></div>';
      return;
    }
    grid.style.display = 'grid';
    list.forEach(function (it) { grid.appendChild(intentCard(it)); });
  }

  // ---- detail ----
  function renderDetail(id) {
    detailId = id;
    var it = INTENTS.find(function (x) { return x.id === id; });
    if (!it) return;
    var c = critMeta(it.criterion);
    var es = effStatus(it);
    var act = actionFor(it);
    var v = $('#detailBody');

    var parties = [
      ['maker', it.maker], ['receiver', it.receiver], ['refund recipient', it.refund]
    ].map(function (p) {
      var you = p[1] === ME.pk ? '<span class="you">YOU</span>' : '';
      return '<div class="party"><span class="role">' + p[0] + '</span><span class="addr">' + partyLabel(p[1]) + ' ' + you + '</span></div>';
    }).join('');

    // timeline
    var term = it.status === 'Fulfilled' ? 'Fulfilled' : (it.status === 'Refunded' ? 'Refunded' : (it.status === 'Closed' ? 'Closed' : null));
    var tl =
      '<div class="tl-item done"><div class="tlt">Created</div><div class="tls">slot ' + tsToSlot(it.created) + '</div></div>' +
      '<div class="tl-item ' + (isExpired(it) ? 'done' : 'future') + '"><div class="tlt">Expiry</div><div class="tls">slot ' + tsToSlot(it.exp) + (it.status === 'Active' ? ' · ' + countdownText(it) : '') + '</div></div>' +
      (term ? '<div class="tl-item done"><div class="tlt">' + term + '</div><div class="tls">terminal state</div></div>'
            : '<div class="tl-item future"><div class="tlt">Settlement</div><div class="tls">awaiting ' + (it.criterion === 'hashlock' ? 'preimage reveal' : 'validity proof') + '</div></div>');

    // action panel
    var panel = actionPanelHtml(it, act);

    var shareUrl = 'laplace.so/app/i/' + it.id + '?cluster=devnet';

    v.innerHTML =
      '<button class="back-link" id="backBtn"><iconify-icon icon="eva:arrow-back-outline"></iconify-icon> Back to console</button>' +
      '<div class="detail-grid">' +
        '<div>' +
          '<div class="panel">' +
            '<div class="detail-top">' +
              '<div><div class="detail-amt">' + fmtAmt(it.amount) + '<span class="asset">' + it.asset + '</span></div>' +
                '<div class="icard__crit" style="margin-top:4px;"><iconify-icon icon="' + c.icon + '"></iconify-icon>' + c.name + '</div></div>' +
              statusBadge(es) +
            '</div>' +
            '<div style="font-family:var(--font-mono);font-size:12px;color:var(--text-secondary);word-break:break-all;">intent ' + it.id + '… · program Bkb7…8ACG</div>' +
          '</div>' +
          '<div class="panel"><h2>Parties</h2>' + parties + '</div>' +
          '<div class="panel"><h2>Timeline</h2><div class="timeline">' + tl + '</div></div>' +
        '</div>' +
        '<div>' +
          '<div class="panel action-panel">' + panel + '</div>' +
          '<div class="panel"><h2>Share</h2><div class="share-row"><input readonly value="' + shareUrl + '" /><button class="act-btn neutral" data-copy="' + shareUrl + '"><iconify-icon icon="eva:copy-outline"></iconify-icon></button></div><div class="hint" style="margin-top:10px;">Links carry only the intent address + cluster. Secrets never travel in a URL.</div></div>' +
        '</div>' +
      '</div>';

    showView('detail');
    $('#backBtn').addEventListener('click', function () { showView('dashboard'); });
  }

  function actionPanelHtml(it, act) {
    if (act.kind === 'fulfill' && it.criterion === 'hashlock') {
      return '<h2>Fulfill · reveal preimage</h2>' +
        '<div class="warn-box"><iconify-icon icon="eva:alert-triangle-outline"></iconify-icon><p>Revealing the preimage is <strong>public and irreversible</strong> — it lands in transaction calldata on-chain.</p></div>' +
        '<div class="field"><label>Preimage (secret)</label><textarea placeholder="paste 32-byte secret (hex)"></textarea></div>' +
        '<button class="act-btn big-btn" data-do="fulfill" data-id="' + it.id + '">Reveal & fulfill</button>' +
        '<div class="hint">Releases ' + fmtAmt(it.amount) + ' ' + it.asset + ' to ' + partyLabel(it.receiver) + ' atomically if SHA256(secret) matches the hashlock.</div>';
    }
    if (act.kind === 'fulfill' && it.criterion === 'validity') {
      return '<h2>Fulfill · validity proof</h2>' +
        '<div class="field"><label>Groth16 proof</label><textarea placeholder="proof bytes (hex) — generated off-app"></textarea></div>' +
        '<div class="field"><label>Public-input suffix</label><input placeholder="0x…" /></div>' +
        '<button class="act-btn big-btn" data-do="fulfill" data-id="' + it.id + '">Submit proof & fulfill</button>' +
        '<div class="hint">The ValidityConfig PDA is passed as the single criterion account (criterion_account_count = 1).</div>';
    }
    if (act.kind === 'refund') {
      return '<h2>Refund · expired intent</h2>' +
        '<div class="warn-box"><iconify-icon icon="eva:clock-outline"></iconify-icon><p>This intent passed its expiry slot unfulfilled. Refund is a permissionless crank — funds return to the refund recipient.</p></div>' +
        '<button class="act-btn big-btn ghost" data-do="refund" data-id="' + it.id + '">Refund to ' + partyLabel(it.refund) + '</button>';
    }
    if (act.kind === 'close') {
      return '<h2>Close · reclaim rent</h2>' +
        '<p style="font-size:13.5px;color:var(--text-secondary);line-height:1.55;margin:0 0 16px;">This intent is ' + it.status.toLowerCase() + '. As maker you can close the account to reclaim rent' + (it.asset !== 'SOL' ? ' and close the SPL vault' : '') + '.</p>' +
        '<button class="act-btn big-btn neutral" data-do="close" data-id="' + it.id + '">Close intent</button>';
    }
    return '<h2>Status</h2><p style="font-size:13.5px;color:var(--text-secondary);line-height:1.55;margin:0;">' +
      (it.maker === ME.pk && it.status === 'Active'
        ? 'You are the maker. ' + (it.criterion === 'hashlock' ? 'The receiver fulfills by revealing the preimage' : 'The receiver fulfills by submitting a validity proof') + ' before expiry, or you can refund after it.'
        : 'No action is available to your wallet for this intent right now.') + '</p>';
  }

  // ---- action execution (mock) ----
  function doAction(kind, id) {
    var it = INTENTS.find(function (x) { return x.id === id; });
    if (!it) return;
    if (kind === 'fulfill') { it.status = 'Fulfilled'; toast('Intent fulfilled — escrow released'); }
    if (kind === 'refund') { it.status = 'Refunded'; toast('Intent refunded to ' + partyLabel(it.refund)); }
    if (kind === 'close') { it.status = 'Closed'; toast('Intent closed — rent reclaimed'); }
    renderDetail(id);
  }

  // ---- create flow ----
  var cstep = 1;
  var cstate = { asset: 'SOL', amount: '', receiver: '', refund: '', expiry: 60, criterion: null, hashMode: 'generate', secret: '', hash: '', customPid: '', customAck: '' };

  function genSecret() {
    var hex = '';
    for (var i = 0; i < 64; i++) hex += '0123456789abcdef'[Math.floor(Math.random() * 16)];
    return hex;
  }
  function fakeHash(s) {
    var hex = '';
    for (var i = 0; i < 64; i++) hex += '0123456789abcdef'[(s.charCodeAt(i % s.length) + i * 7) % 16];
    return hex;
  }

  function gotoStep(n) {
    cstep = n;
    document.querySelectorAll('.create-step').forEach(function (s) { s.classList.toggle('active', +s.dataset.step === n); });
    document.querySelectorAll('.stepdot').forEach(function (d) {
      var dn = +d.dataset.s;
      d.classList.toggle('active', dn === n);
      d.classList.toggle('done', dn < n);
    });
    document.querySelectorAll('.stepline').forEach(function (l, i) { l.classList.toggle('done', i < n - 1); });
    if (n === 3) renderReview();
  }

  function renderReview() {
    var box = $('#reviewTable');
    var crit = cstate.criterion === 'hashlock' ? 'Hashlock · official' : cstate.criterion === 'validity' ? 'Validity · SP1 · official' : 'Custom · unverified';
    var commitRow = cstate.criterion === 'custom'
      ? ['Program ID', (cstate.customPid || '—')]
      : [cstate.criterion === 'hashlock' ? 'Hashlock' : 'Config hash', '0x' + (cstate.hash || fakeHash(cstate.secret || 'x')).slice(0, 24) + '…'];
    var rows = [
      ['Asset', cstate.asset],
      ['Amount', (cstate.amount || '0') + ' ' + cstate.asset],
      ['Receiver', cstate.receiver || '—'],
      ['Refund recipient', cstate.refund || partyLabel(ME.pk)],
      ['Expiry', '+' + cstate.expiry + ' min · slot ' + (SLOT0 + Math.round(cstate.expiry * 60 / 0.4))],
      ['Criterion', crit],
      commitRow,
      ['Intent PDA', 'GhPA…' + Math.random().toString(36).slice(2, 6) + ' (derived)']
    ];
    box.innerHTML = rows.map(function (r) {
      return '<div class="review-row"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
    }).join('');
  }

  function submitCreate() {
    var id = (Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 8)).replace(/[^a-z0-9]/gi, '').slice(0, 10);
    INTENTS.unshift({
      id: id.charAt(0).toUpperCase() + id.slice(1),
      maker: ME.pk,
      receiver: cstate.receiver || P.bob,
      refund: cstate.refund || ME.pk,
      asset: cstate.asset,
      amount: parseFloat(cstate.amount) || 1,
      criterion: cstate.criterion || 'hashlock',
      status: 'Active',
      exp: Date.now() + cstate.expiry * 60e3,
      created: Date.now()
    });
    toast('Intent created — escrow funded');
    // reset
    cstate = { asset: 'SOL', amount: '', receiver: '', refund: '', expiry: 60, criterion: null, hashMode: 'generate', secret: '', hash: '', customPid: '', customAck: '' };
    syncCreateInputs();
    gotoStep(1);
    showView('dashboard');
  }

  function syncCreateInputs() {
    document.querySelectorAll('.seg-asset button').forEach(function (b) { b.classList.toggle('active', b.dataset.asset === cstate.asset); });
    $('#cAmount').value = cstate.amount;
    $('#cReceiver').value = cstate.receiver;
    $('#cRefund').value = cstate.refund;
    $('#cExpiry').value = cstate.expiry;
    document.querySelectorAll('.recipe').forEach(function (r) { r.classList.toggle('sel', r.dataset.recipe === cstate.criterion); });
    $('#critForms').innerHTML = '';
  }

  function renderCriterionForm() {
    var box = $('#critForms');
    if (cstate.criterion === 'hashlock') {
      box.innerHTML =
        '<div class="submode">' +
          '<button class="' + (cstate.hashMode === 'generate' ? 'active' : '') + '" data-hm="generate">Generate a secret</button>' +
          '<button class="' + (cstate.hashMode === 'have' ? 'active' : '') + '" data-hm="have">I already have a hashlock</button>' +
        '</div>' +
        (cstate.hashMode === 'generate'
          ? '<div class="warn-box"><iconify-icon icon="eva:alert-triangle-outline"></iconify-icon><p>Save this secret now. Losing it means the intent can only be refunded; revealing it later is public and irreversible.</p></div>' +
            '<div class="field"><label>Generated secret (32 bytes)</label><div class="secret-box" id="secretBox">' + cstate.secret + '</div>' +
            '<button class="act-btn neutral" data-copy="' + cstate.secret + '" style="height:32px;"><iconify-icon icon="eva:copy-outline"></iconify-icon> Copy secret</button></div>' +
            '<div class="field"><label>criterion_data_hash = SHA256(secret)</label><div class="serialized">0x' + cstate.hash + '</div></div>'
          : '<div class="field"><label>criterion_data_hash (hashlock h)</label><input id="cHash" placeholder="0x… (counterparty hashlock)" value="' + (cstate.hash || '') + '" /><div class="hint">Paste a counterparty\'s hashlock — e.g. the shared <span class="mono">h</span> for a cross-chain swap. No secret is stored locally.</div></div>');
      if (cstate.hashMode === 'have') {
        $('#cHash').addEventListener('input', function (e) { cstate.hash = e.target.value; });
      }
    } else if (cstate.criterion === 'validity') {
      box.innerHTML =
        '<div class="field"><label>ValidityConfig</label><select id="cConfig"><option>fib-n20 · 0x9a3f… (registry)</option><option>solvency-v1 · 0x7c12… (registry)</option><option>+ Create new ValidityConfig…</option></select>' +
        '<div class="hint">The intent\'s criterion_data_hash = the config\'s config_hash. Fulfillment requires a Groth16 proof + public-input suffix, generated off-app.</div></div>';
    } else if (cstate.criterion === 'custom') {
      var market = [
        { name: 'TWAP Oracle Gate', tier: 'audited', pid: 'TWAPgate7kQ2hN8vRpa3FtL9wXcUe7yD4sZ1mGoJ2x' },
        { name: 'Signature Approval', tier: 'community', pid: 'SiG1nApprov4nW2kT8nQp3vRcL5xZe1yD9sH3bF2jU' },
        { name: 'Merkle Allowlist', tier: 'community', pid: 'Mrk1eA11ow8kP5nR2wQa8vXcL3mZe7yT2sH8bF6jUo' }
      ];
      var marketItems = market.map(function (m) {
        var sel = cstate.customPid === m.pid ? ' sel' : '';
        return '<button type="button" class="market-item' + sel + '" data-pid="' + m.pid + '">' +
          '<span class="mname">' + m.name + '</span>' +
          '<span class="mtier ' + m.tier + '">' + m.tier + '</span>' +
          '<span class="mpid">' + m.pid.slice(0, 4) + '…' + m.pid.slice(-4) + '</span>' +
          '<iconify-icon icon="eva:checkmark-circle-2" class="mcheck"></iconify-icon></button>';
      }).join('');
      box.innerHTML =
        '<div class="warn-box"><iconify-icon icon="eva:alert-triangle-outline"></iconify-icon><p><strong>Unverified by default.</strong> The protocol will escrow against any program you name — if its code is malicious or buggy, your deposit can be released to the wrong party. Pick a listed criterion from the registry, or read the deployed bytecode before proceeding. Flagged programs are blocked.</p></div>' +
        '<div class="field"><label>Browse the criterion registry</label>' +
          '<div class="market">' + marketItems + '</div>' +
          '<div class="hint">Pick a listed criterion, or paste any program ID below. <a href="registry.html#catalog-sec" target="_blank" rel="noopener" style="color:var(--primary-solid);text-decoration:none;font-weight:var(--fw-semibold);">Open the full registry →</a></div></div>' +
        '<div class="field"><label>Criterion program ID</label><input id="cCustomPid" placeholder="program address" value="' + (cstate.customPid || '') + '" /></div>' +
        '<div class="field"><label>Type the program ID again to acknowledge the risk</label><input id="cCustomAck" placeholder="re-type the program ID" value="' + (cstate.customAck || '') + '" /><div class="hint" id="ackHint">You are escrowing against unaudited code. Re-type the program ID exactly to confirm you understand.</div></div>';
      box.querySelectorAll('.market-item').forEach(function (it) {
        it.addEventListener('click', function () {
          cstate.customPid = it.getAttribute('data-pid');
          $('#cCustomPid').value = cstate.customPid;
          box.querySelectorAll('.market-item').forEach(function (x) { x.classList.toggle('sel', x === it); });
          updateAck();
        });
      });
      $('#cCustomPid').addEventListener('input', function (e) { cstate.customPid = e.target.value.trim(); box.querySelectorAll('.market-item').forEach(function (x) { x.classList.toggle('sel', x.getAttribute('data-pid') === cstate.customPid); }); updateAck(); });
      $('#cCustomAck').addEventListener('input', function (e) { cstate.customAck = e.target.value.trim(); updateAck(); });
    }
  }

  function customAckOk() { return cstate.customPid.length > 0 && cstate.customPid === cstate.customAck; }
  function updateAck() {
    var h = $('#ackHint'); if (!h) return;
    h.innerHTML = customAckOk()
      ? '<span class="ack-ok"><iconify-icon icon="eva:checkmark-circle-2"></iconify-icon> Acknowledged — you accept the risk of an unverified criterion.</span>'
      : 'You are escrowing against unaudited code. Re-type the program ID exactly to confirm you understand.';
  }

  // ---- manual ops ----
  var INSTR = {
    'create_intent': { prog: 'laplace', args: 'id, receiver, refund_recipient, asset, amount, expiry_slot, criterion_program, criterion_data_hash', disc: 'e2f1...' },
    'fulfill_with_criterion': { prog: 'laplace', args: 'fulfillment_data: Vec<u8>, criterion_account_count: u8', disc: '8c7b8b85' },
    'refund_expired_intent': { prog: 'laplace', args: '(none)', disc: 'a1b2...' },
    'close_intent': { prog: 'laplace', args: '(none)', disc: 'c3d4...' },
    'create_validity': { prog: 'validity', args: 'guest_elf_hash, sp1_vkey_hash, fixed_public_inputs', disc: 'f5e6...' },
    'verify_criterion': { prog: 'hashlock / validity', args: 'CriterionVerificationRequest', disc: '8c7b8b8567d572ab' },
    'initialize': { prog: 'laplace', args: '(none)', disc: 'afaf...' }
  };
  var manualSel = 'create_intent';
  function renderManual() {
    var list = $('#instrList'); if (!list) return;
    list.innerHTML = Object.keys(INSTR).map(function (k) {
      return '<button class="instr-item ' + (k === manualSel ? 'active' : '') + '" data-instr="' + k + '">' + k + '</button>';
    }).join('');
    var m = INSTR[manualSel];
    $('#instrForm').innerHTML =
      '<div class="detail-top"><div><div style="font-family:var(--font-mono);font-size:18px;font-weight:600;">' + manualSel + '</div>' +
      '<div style="font-family:var(--font-mono);font-size:12px;color:var(--text-secondary);margin-top:4px;">program · ' + m.prog + '</div></div>' +
      '<span class="icard__crit">discriminator ' + m.disc + '</span></div>' +
      '<div class="field"><label>Accounts</label><textarea placeholder="one pubkey per line (signer / writable flags)"></textarea></div>' +
      '<div class="field"><label>Args</label><div class="serialized">' + m.args + '</div></div>' +
      (manualSel === 'fulfill_with_criterion'
        ? '<div class="field"><label>criterion_account_count</label><input value="0" /><div class="hint">Only this prefix of remaining-accounts is forwarded to the criterion; later accounts are reserved for settlement.</div></div>' : '') +
      '<div class="field"><label>Serialized instruction</label><div class="serialized"><span class="k">' + m.disc + '</span> · &lt;borsh args&gt; · ' + m.prog + '</div></div>' +
      '<div style="display:flex;gap:10px;margin-top:6px;"><button class="act-btn neutral" data-toast="Simulated — no errors">Simulate</button><button class="act-btn" data-toast="Instruction sent (mock)">Send</button></div>';
  }

  // ---- toast ----
  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.querySelector('span').textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  // ---- countdown ticker ----
  setInterval(function () {
    var dirty = false;
    document.querySelectorAll('.countdown[data-exp]').forEach(function (n) {
      var it = INTENTS.find(function (x) { return x.id === n.dataset.exp; });
      if (!it) return;
      n.textContent = countdownText(it);
      if (isExpired(it)) { n.classList.add('past'); dirty = true; }
      else if (it.exp - Date.now() < 15*60e3) n.classList.add('urgent');
    });
    // if something just expired while viewing dashboard, refresh actions
    if (dirty && currentView === 'dashboard') renderDashboard();
  }, 1000);

  // ---- global click delegation ----
  document.addEventListener('click', function (e) {
    var go = e.target.closest('[data-go]');
    if (go) { if (go.dataset.go === 'create') { syncCreateInputs(); gotoStep(1); } showView(go.dataset.go); return; }

    var tab = e.target.closest('.app-tab');
    if (tab) { if (tab.dataset.go === 'create') { syncCreateInputs(); gotoStep(1); } showView(tab.dataset.go); return; }

    var actBtn = e.target.closest('[data-act]');
    if (actBtn) { e.stopPropagation(); renderDetail(actBtn.dataset.act); return; }

    var card = e.target.closest('.icard');
    if (card) { renderDetail(card.dataset.id); return; }

    var doBtn = e.target.closest('[data-do]');
    if (doBtn) { doAction(doBtn.dataset.do, doBtn.dataset.id); return; }

    var instr = e.target.closest('[data-instr]');
    if (instr) { manualSel = instr.dataset.instr; renderManual(); return; }

    var tb = e.target.closest('[data-toast]');
    if (tb) { toast(tb.dataset.toast); return; }

    // role tabs
    var seg = e.target.closest('#roleSeg button');
    if (seg) { roleFilter = seg.dataset.role; document.querySelectorAll('#roleSeg button').forEach(function (b) { b.classList.toggle('active', b === seg); }); renderDashboard(); return; }

    var chip = e.target.closest('.chip');
    if (chip) { statusFilter = chip.dataset.status; document.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('active', c === chip); }); renderDashboard(); return; }

    // wallet
    var w = e.target.closest('#walletBtn');
    if (w) {
      connected = !connected;
      w.className = 'wallet-btn' + (connected ? ' connected' : '');
      w.innerHTML = connected
        ? '<span class="wdot"></span><span class="waddr">' + trunc(ME.pk) + '</span><span class="wbal">128.4 SOL</span>'
        : 'Connect wallet';
      toast(connected ? 'Wallet connected · Devnet' : 'Wallet disconnected');
      return;
    }

    // create nav
    var cn = e.target.closest('[data-cstep]');
    if (cn) {
      var target = +cn.dataset.cstep;
      if (target === 99) { submitCreate(); return; }
      if (target > cstep) {
        if (cstep === 1 && !cstate.amount) { toast('Enter an amount'); return; }
        if (cstep === 2 && !cstate.criterion) { toast('Choose a criterion'); return; }
        if (cstep === 2 && cstate.criterion === 'custom' && !customAckOk()) { toast('Type the program ID exactly to acknowledge the risk'); return; }
      }
      gotoStep(target);
      return;
    }

    // asset toggle
    var ab = e.target.closest('.seg-asset button');
    if (ab) { cstate.asset = ab.dataset.asset; document.querySelectorAll('.seg-asset button').forEach(function (b) { b.classList.toggle('active', b === ab); }); return; }

    // recipe pick
    var rc = e.target.closest('.recipe');
    if (rc) {
      cstate.criterion = rc.dataset.recipe;
      document.querySelectorAll('.recipe').forEach(function (r) { r.classList.toggle('sel', r === rc); });
      if (cstate.criterion === 'hashlock' && !cstate.secret) { cstate.secret = genSecret(); cstate.hash = fakeHash(cstate.secret); }
      renderCriterionForm();
      return;
    }

    // hashlock submode
    var hm = e.target.closest('[data-hm]');
    if (hm) { cstate.hashMode = hm.dataset.hm; renderCriterionForm(); return; }
  });

  // create inputs
  document.addEventListener('input', function (e) {
    if (e.target.id === 'cAmount') cstate.amount = e.target.value;
    if (e.target.id === 'cReceiver') cstate.receiver = e.target.value;
    if (e.target.id === 'cRefund') cstate.refund = e.target.value;
    if (e.target.id === 'cExpiry') cstate.expiry = +e.target.value || 0;
  });

  // ---- init ----
  function init() { renderDashboard(); showView('dashboard'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
