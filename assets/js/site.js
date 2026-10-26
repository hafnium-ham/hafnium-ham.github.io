(() => {
  'use strict';

  const CONFIG = {
    clickSound:   'assets/audio/click.mp3',
    clickVolume:  0.07,

    // .hover-imgs is scaled to 0.2, so 100 here is about 20px on screen
    groupDrift:   50,
    groupTilt:    1.5,
    ownDrift:     20,
    ownTilt:      0.7,
    groupPeriod:  [22, 26],
    ownPeriod:    [20, 23],
    easeInSecs:   3,

    statusTimeout: 6000
  };

  const rand = (a, b) => a + Math.random() * (b - a);

  /* Click sound */
  const click = new Audio(CONFIG.clickSound);
  click.preload = 'auto';
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const s = click.cloneNode();
    s.volume = CONFIG.clickVolume;
    s.play().catch(() => {});
  });

  /* Drifting hover images */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const imgs = [...document.querySelectorAll('.hover-imgs img')];
  if (!reduceMotion && imgs.length) {
    const TAU = Math.PI * 2;
    const between = ([lo, hi]) => rand(lo, hi);

    const makeDrift = (range) => {
      const p1 = between(range), p2 = between(range) * 0.55;
      const f1 = rand(0, TAU), f2 = rand(0, TAU);
      return (t) => 0.7 * Math.sin(TAU * t / p1 + f1) + 0.3 * Math.sin(TAU * t / p2 + f2);
    };

    const group = { x: makeDrift(CONFIG.groupPeriod), y: makeDrift(CONFIG.groupPeriod), r: makeDrift(CONFIG.groupPeriod) };
    const own = imgs.map(() => ({ x: makeDrift(CONFIG.ownPeriod), y: makeDrift(CONFIG.ownPeriod), r: makeDrift(CONFIG.ownPeriod) }));

    const start = performance.now();
    const frame = (now) => {
      const t = (now - start) / 1000;
      const k = Math.min(1, t / CONFIG.easeInSecs);
      const ease = k * k * (3 - 2 * k);
      const gx = group.x(t) * CONFIG.groupDrift;
      const gy = group.y(t) * CONFIG.groupDrift;
      const gr = group.r(t) * CONFIG.groupTilt;

      imgs.forEach((img, i) => {
        const o = own[i];
        const x = (gx + o.x(t) * CONFIG.ownDrift) * ease;
        const y = (gy + o.y(t) * CONFIG.ownDrift) * ease;
        const r = (gr + o.r(t) * CONFIG.ownTilt) * ease;
        img.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${r.toFixed(3)}deg)`;
      });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* Cursor tooltip: any element with data-tip="text" */
  const tip = document.createElement('div');
  tip.style.cssText =
    'position:fixed;z-index:1000;display:none;max-width:260px;padding:3px 6px;' +
    'background:#ffffe1;color:#000;border:1px solid #000;font:12px Tahoma,Verdana,sans-serif;' +
    'line-height:1.35;pointer-events:none;white-space:normal;';
  tip.setAttribute('role', 'tooltip');

  const place = (e) => {
    const pad = 14;
    let x = e.clientX + pad, y = e.clientY + pad + 4;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    if (x + w > innerWidth - 4)  x = e.clientX - w - pad;
    if (y + h > innerHeight - 4) y = e.clientY - h - pad;
    tip.style.left = Math.max(4, x) + 'px';
    tip.style.top  = Math.max(4, y) + 'px';
  };

  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(tip));
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (!el) return;
    tip.textContent = el.dataset.tip;
    tip.style.display = 'block';
    place(e);
  });
  document.addEventListener('mousemove', (e) => {
    if (tip.style.display === 'block') place(e);
  });
  document.addEventListener('mouseout', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el && !el.contains(e.relatedTarget)) tip.style.display = 'none';
  });

  /* Server status: any link with data-check-url, checked once per page load */
  async function ping(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CONFIG.statusTimeout);
    try {
      try {
        const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
        return r.ok;
      } catch (err) {
        if (ctrl.signal.aborted) return false;
        await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
        return true;
      }
    } catch (err) {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  const STATES = {
    checking: ['#999', 'checking…'],
    up:       ['#2e9e4f', 'online'],
    down:     ['#c0392b', 'offline']
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-check-url]').forEach((link) => {
      const badge = document.createElement('span');
      badge.style.cssText = 'margin-left:6px;font-size:0.75em;white-space:nowrap;';
      const dot = document.createElement('span');
      dot.style.cssText = 'display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:3px;';
      const label = document.createElement('span');
      badge.append(dot, label);
      link.after(badge);

      const set = (k) => { dot.style.background = STATES[k][0]; label.textContent = STATES[k][1]; };
      set('checking');
      ping(link.dataset.checkUrl).then((ok) => set(ok ? 'up' : 'down'));
    });
  });
})();