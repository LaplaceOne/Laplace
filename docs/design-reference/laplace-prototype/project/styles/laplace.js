// Laplace — shared site behavior: theme toggle (persists across pages) + scroll reveal
(function () {
  var root = document.documentElement;
  var KEY = 'laplace-theme';
  var btn = document.getElementById('themeBtn');
  function setIcon(t) {
    if (!btn) return;
    var ic = btn.querySelector('iconify-icon');
    if (ic) ic.setAttribute('icon', t === 'dark' ? 'eva:sun-outline' : 'eva:moon-outline');
  }
  function apply(t) { root.setAttribute('data-theme', t); setIcon(t); }
  apply(localStorage.getItem(KEY) || 'light');
  if (btn) {
    btn.addEventListener('click', function () {
      var t = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      localStorage.setItem(KEY, t);
      apply(t);
    });
  }

  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
    setTimeout(function () {
      document.querySelectorAll('.reveal:not(.in)').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < innerHeight * 0.95 && r.bottom > 0) el.classList.add('in');
      });
    }, 1400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initReveal);
  else initReveal();

  // copy buttons: [data-copy="text"]
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (!b) return;
    var txt = b.getAttribute('data-copy');
    if (navigator.clipboard) navigator.clipboard.writeText(txt);
    var prev = b.innerHTML;
    b.innerHTML = '<iconify-icon icon="eva:checkmark-outline"></iconify-icon> copied';
    setTimeout(function () { b.innerHTML = prev; }, 1500);
  });

  // ---- accent-ring cursor (site-wide; real cursor stays for hit accuracy) ----
  function initCursor() {
    // only for fine pointers (mouse/pen) — skip touch
    if (!window.matchMedia || !window.matchMedia('(pointer: fine)').matches) return;
    if (document.getElementById('lp-cursor')) return;

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var st = document.createElement('style');
    st.textContent =
      '#lp-cursor{position:fixed;top:0;left:0;width:26px;height:26px;border-radius:50%;' +
      'border:1.5px solid var(--primary-solid);pointer-events:none;z-index:9998;opacity:0;' +
      'transform:translate3d(-50px,-50px,0) translate(-50%,-50%);will-change:transform,opacity;' +
      'transition:opacity .25s ease' + (reduce ? '' : ',width .18s ease,height .18s ease,background-color .18s ease,border-color .18s ease') + ';}' +
      '#lp-cursor.hot{width:40px;height:40px;background:var(--primary-08);border-color:var(--primary-70);}' +
      '#lp-cursor.tap{width:18px;height:18px;background:var(--primary-12);}' +
      '#lp-cursor-dot{position:fixed;top:0;left:0;width:5px;height:5px;border-radius:50%;' +
      'background:var(--primary-solid);pointer-events:none;z-index:9999;opacity:0;' +
      'transform:translate3d(-50px,-50px,0) translate(-50%,-50%);will-change:transform,opacity;transition:opacity .25s ease;}';
    document.head.appendChild(st);

    var ring = document.createElement('div'); ring.id = 'lp-cursor'; ring.setAttribute('aria-hidden', 'true');
    var dot = document.createElement('div'); dot.id = 'lp-cursor-dot'; dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ring); document.body.appendChild(dot);

    var tx = -50, ty = -50, rx = -50, ry = -50, shown = false;
    var hot = 'a,button,input,select,textarea,label,[role="button"],[data-copy],[data-toggle],[data-tab],[data-go],.icard,.rcard__head,.recipe,.chip,.tfilter,.app-tab,.theme-toggle,.tier,summary';

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      tx = e.clientX; ty = e.clientY;
      dot.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0) translate(-50%,-50%)';
      if (!shown) { shown = true; ring.style.opacity = '1'; dot.style.opacity = '1'; }
      if (reduce) { ring.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0) translate(-50%,-50%)'; }
      var over = e.target && e.target.closest && e.target.closest(hot);
      ring.classList.toggle('hot', !!over);
    }, { passive: true });

    window.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'touch') ring.classList.add('tap'); }, { passive: true });
    window.addEventListener('pointerup', function () { ring.classList.remove('tap'); }, { passive: true });

    var hide = function () { ring.style.opacity = '0'; dot.style.opacity = '0'; shown = false; };
    document.addEventListener('mouseleave', hide);
    document.addEventListener('mouseout', function (e) { if (!e.relatedTarget && !e.toElement) hide(); });
    window.addEventListener('blur', hide);

    if (!reduce) {
      (function loop() {
        rx += (tx - rx) * 0.18; ry += (ty - ry) * 0.18;
        ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0) translate(-50%,-50%)';
        requestAnimationFrame(loop);
      })();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCursor);
  else initCursor();
})();
