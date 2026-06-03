/* ============================================================
   Laplace — ambient animated background (shared)
   A flow-field of hairline segments (a nod to the Laplace
   operator on a field) + two slow drifting brand glows, with a
   magnetic cursor: nearby segments bend radially around the
   pointer, brighten, and lengthen with a smooth falloff.
   Reduced-motion aware; pauses when the tab is hidden.
   Inject once per page: <script src="styles/bg.js"></script>
   ============================================================ */
(function () {
  'use strict';
  if (document.getElementById('lp-bg-canvas')) return;

  // ---- styles (glows + canvas) ----
  var style = document.createElement('style');
  style.textContent =
    '#lp-bg-glows{position:fixed;inset:0;z-index:-3;pointer-events:none;overflow:hidden;}' +
    '#lp-bg-glows .g{position:absolute;border-radius:50%;filter:blur(90px);opacity:.62;}' +
    '#lp-bg-glows .g1{width:46vw;height:46vw;background:radial-gradient(closest-side,var(--primary-20),transparent 70%);left:-8vw;top:-10vw;animation:lpDrift1 34s ease-in-out infinite;}' +
    '#lp-bg-glows .g2{width:40vw;height:40vw;background:radial-gradient(closest-side,var(--secondary-20),transparent 70%);right:-6vw;top:14vh;animation:lpDrift2 42s ease-in-out infinite;}' +
    '[data-theme="dark"] #lp-bg-glows .g{opacity:.52;}' +
    '#lp-bg-canvas{position:fixed;inset:0;z-index:-2;pointer-events:none;filter:blur(0.7px);}' +
    '@keyframes lpDrift1{0%,100%{transform:translate(0,0)}50%{transform:translate(8vw,6vh)}}' +
    '@keyframes lpDrift2{0%,100%{transform:translate(0,0)}50%{transform:translate(-7vw,9vh)}}' +
    '@media (prefers-reduced-motion: reduce){#lp-bg-glows .g{animation:none;}}';
  document.head.appendChild(style);

  function mount() {
    if (document.getElementById('lp-bg-canvas')) return;
    var glows = document.createElement('div');
    glows.id = 'lp-bg-glows';
    glows.setAttribute('aria-hidden', 'true');
    glows.innerHTML = '<div class="g g1"></div><div class="g g2"></div>';
    var canvas = document.createElement('canvas');
    canvas.id = 'lp-bg-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);
    document.body.insertBefore(glows, document.body.firstChild);

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // grid + look
    var SP = 38;          // grid spacing
    var LEN = 12;         // base half-length of a segment
    var R = 230;          // magnetic radius (px)
    var rgb = '80,120,200';
    var baseA = 0.15, lineW = 1.4;

    // magnetic pointer state (viewport coords; canvas is fixed)
    var mTX = -9999, mTY = -9999;  // target
    var mX = -9999, mY = -9999;    // smoothed
    var strength = 0;              // eases 0..1 with presence
    var present = 0;               // 1 while pointer over page

    function readColor() {
      var cs = getComputedStyle(document.documentElement);
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      rgb = toRgb((cs.getPropertyValue('--primary-solid') || '#2f7ce0').trim());
      baseA = dark ? 0.22 : 0.15;
    }
    function toRgb(c) {
      if (c.indexOf('rgb') === 0) { var m = c.match(/[\d.]+/g); return m ? (Math.round(m[0]) + ',' + Math.round(m[1]) + ',' + Math.round(m[2])) : '80,120,200'; }
      var h = c.replace('#', '');
      if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      var n = parseInt(h, 16);
      return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
    }

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      readColor();
      if (reduce) draw(0);
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = lineW;
      ctx.lineCap = 'round';

      // ease pointer follow + presence
      strength += ((present ? 1 : 0) - strength) * 0.07;
      if (present) { mX += (mTX - mX) * 0.16; mY += (mTY - mY) * 0.16; }
      var active = strength > 0.01;
      var R2 = R * R;

      // base pass — single batched path; the cursor only bends direction (no brightness/length change)
      ctx.strokeStyle = 'rgba(' + rgb + ',' + baseA + ')';
      ctx.beginPath();
      for (var x = SP / 2; x < W; x += SP) {
        for (var y = SP / 2; y < H; y += SP) {
          var fa = Math.sin(x * 0.0016 + t * 0.00018)
                 + Math.cos(y * 0.0018 - t * 0.00015)
                 + Math.sin((x + y) * 0.0011 + t * 0.00012);
          fa *= 1.7;
          var ang = fa;

          if (active) {
            var dxm = x - mX, dym = y - mY, d2 = dxm * dxm + dym * dym;
            var w = Math.exp(-d2 / R2) * strength;
            if (w > 0.01) {
              var mag = Math.atan2(dym, dxm);   // pure radial pole — points at the cursor, no swirl
              var bx = Math.cos(fa) * (1 - w) + Math.cos(mag) * w;
              var by = Math.sin(fa) * (1 - w) + Math.sin(mag) * w;
              ang = Math.atan2(by, bx);
            }
          }

          var ex = Math.cos(ang) * LEN, ey = Math.sin(ang) * LEN;
          ctx.moveTo(x - ex, y - ey);
          ctx.lineTo(x + ex, y + ey);
        }
      }
      ctx.stroke();
    }

    var raf = null, running = true;
    function loop(now) { if (!running) return; draw(now); raf = requestAnimationFrame(loop); }
    function start() { if (reduce) { draw(0); return; } if (raf) return; running = true; raf = requestAnimationFrame(loop); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

    // pointer (mouse / pen / touch) — covers magnetic interaction
    if (!reduce) {
      window.addEventListener('pointermove', function (e) { mTX = e.clientX; mTY = e.clientY; present = 1; if (mX < -9000) { mX = mTX; mY = mTY; } }, { passive: true });
      window.addEventListener('pointerdown', function (e) { mTX = e.clientX; mTY = e.clientY; present = 1; }, { passive: true });
      // relax the field back to ambient when the pointer leaves the window/tab
      var leave = function () { present = 0; };
      document.addEventListener('mouseleave', leave);
      document.addEventListener('pointerleave', leave);
      document.addEventListener('pointercancel', leave);
      window.addEventListener('blur', leave);
      document.addEventListener('mouseout', function (e) { if (!e.relatedTarget && !e.toElement) leave(); });
    }

    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 150); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    new MutationObserver(readColor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    resize();
    start();

    // inspection hook (harmless): drive a fully-eased magnetic frame for verification
    window.__lpbg = {
      set: function (x, y) { mTX = mX = x; mTY = mY = y; present = 1; strength = 1; },
      clear: function () { present = 0; strength = 0; },
      step: function (t) { draw(t || performance.now()); }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
