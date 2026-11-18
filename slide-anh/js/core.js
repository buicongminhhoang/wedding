/* Lõi: cấu hình, khung trình chiếu, hàng đợi ảnh, vòng đời của từng mẫu, bảng cài đặt. */
window.SL = (() => {
  'use strict';

  const DEFAULTS = {
    ratio: 'auto', mode: 'auto', style: '', order: 'shuffle',
    dur: 7, rotate: 3, sig: true, grain: true,
    n1: 'Minh Hoàng', n2: 'Kim Ngân', date: '29 . 11 . 2026', off: [], skip: [],
    vol: .8, mshuffle: 'no', mplay: true, mstate: {}, sync: true,
  };
  const RATIOS = { 'auto': 0, '3:2': 3 / 2, '2:3': 2 / 3, '4:3': 4 / 3, '16:9': 16 / 9, '3:4': 3 / 4 };
  const KEY = 'slide-anh-v1';
  // Tham số URL: ?ratio=3x2&mau=film&giay=7&doi=3&thutu=seq
  const URLMAP = { ratio: 'ratio', mau: 'style', giay: 'dur', doi: 'rotate', thutu: 'order', che: 'mode' };

  const cfg = { ...DEFAULTS };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  for (const [p, v] of new URLSearchParams(location.search)) {
    const k = URLMAP[p]; if (!k) continue;
    cfg[k] = typeof DEFAULTS[k] === 'number' ? (parseFloat(v) || DEFAULTS[k]) : v;
  }
  cfg.ratio = String(cfg.ratio).replace(/[x×]/i, ':');
  if (!(cfg.ratio in RATIOS)) cfg.ratio = 'auto';
  if (!Array.isArray(cfg.off)) cfg.off = [];
  if (!Array.isArray(cfg.skip)) cfg.skip = [];
  if (cfg.mode !== 'one') cfg.mode = 'auto';
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const stage = $('#stage'), layer = $('#layer'), panel = $('#panel');
  const photos = window.PHOTOS || [];
  const styles = [];
  const DEAD = Symbol('dead');

  /* ---------- Tiện ích dùng chung cho các mẫu ---------- */
  const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = arr => {
    for (let i = arr.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  };
  function el(tag, cls, parent, css) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (css) Object.assign(e.style, css);
    if (parent) parent.appendChild(e);
    return e;
  }
  function css(text) { el('style', '', document.head).textContent = text; }

  const orient = p => p.a < .9 ? 'p' : p.a > 1.1 ? 'l' : 's';
  const loss = (pa, ba) => 1 - Math.min(pa / ba, ba / pa);            // phần ảnh bị cắt khi phủ kín khung
  /** Vị trí và cỡ ảnh để phủ kín khung w×h, giữ khuôn mặt trong khung. */
  function cover(p, w, h, zoom = 1) {
    const iw = Math.max(w, h * p.a) * zoom, ih = iw / p.a;
    return {
      w: iw, h: ih,
      x: clamp(w / 2 - p.fx * iw, w - iw, 0),
      y: clamp(h * .46 - p.fy * ih, h - ih, 0),
    };
  }
  /** Cỡ lớn nhất giữ nguyên tỉ lệ a trong khung maxW×maxH (không cắt ảnh). */
  function contain(a, maxW, maxH) {
    const w = Math.min(maxW, maxH * a);
    return { w, h: w / a };
  }
  function place(img, r) {
    Object.assign(img.style, { position: 'absolute', left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    return img;
  }
  function load(p, size = 'l') {
    // màn nhỏ (điện thoại): bản 900 px là đủ nét, tải nhanh và đỡ tốn dữ liệu
    if (size === 'l' && Math.max(stage.clientWidth, stage.clientHeight) * Math.min(devicePixelRatio || 1, 2) <= 1100) size = 's';
    return new Promise(res => {
      const img = new Image();
      img.decoding = 'async'; img.draggable = false;
      img.src = `photos/${size}/${encodeURIComponent(p.f)}`;
      const done = () => res(img);
      (img.decode ? img.decode() : Promise.reject()).then(done, () => {
        if (img.complete) done(); else { img.onload = img.onerror = done; }
      });
    });
  }

  /* ---------- Hàng đợi ảnh: chạy hết bộ ảnh rồi mới lặp lại ---------- */
  let queue = [];
  /** Các ảnh đang được chọn đưa vào slide. */
  function pool() { const s = new Set(cfg.skip), a = photos.filter(p => !s.has(p.f)); return a.length ? a : photos; }
  function refill() {
    const skip = new Set(cfg.skip);
    let idx = photos.map((_, i) => i).filter(i => !skip.has(photos[i].f));
    if (!idx.length) idx = photos.map((_, i) => i);
    queue = queue.concat(cfg.order === 'seq' ? idx : shuffle(idx));
  }
  function next(pred, look = 16) {
    if (queue.length < look + 4) refill();
    let k = 0;
    if (pred) { k = queue.slice(0, look).findIndex(i => pred(photos[i])); if (k < 0) k = 0; }
    return photos[queue.splice(k, 1)[0]];
  }
  /**
   * Chọn nhóm ảnh lấp kín khung có tỉ lệ ar mà ít bị cắt nhất:
   * 1 ảnh phủ kín, hoặc 2-3 ảnh dọc xếp cột / ảnh ngang xếp hàng, hoặc 1 ảnh đặt trọn trong khung (mode 'fit').
   */
  function group(ar, maxN = 3) {
    const first = next();
    let best = { n: 1, loss: loss(first.a, ar), dir: 'full' };
    for (let n = 2; n <= maxN; n++) {
      const c = loss(first.a, ar / n), r = loss(first.a, ar * n);
      if (c < best.loss - .04) best = { n, loss: c, dir: 'cols' };
      if (r < best.loss - .04) best = { n, loss: r, dir: 'rows' };
    }
    if (best.loss > .24) return { photos: [first], dir: 'fit' };
    const list = [first], o = orient(first);
    while (list.length < best.n) {
      if (queue.length < 20) refill();
      const k = queue.slice(0, 16).findIndex(i => orient(photos[i]) === o);
      if (k < 0) break;
      list.push(photos[queue.splice(k, 1)[0]]);
    }
    if (list.length < best.n) {                         // không đủ ảnh cùng chiều: trả lại hàng đợi
      queue.unshift(...list.slice(1).map(p => photos.indexOf(p)));
      return { photos: [first], dir: loss(first.a, ar) > .24 ? 'fit' : 'full' };
    }
    return { photos: list, dir: best.dir };
  }

  const WORDS = [
    'Ngày chung đôi', 'Thương một đời', 'Mình về chung một nhà', 'Trăm năm hạnh phúc',
    'Từ hôm nay và mãi mãi', 'Nắm tay nhau thật chặt', 'Yêu là cùng nhìn về một hướng',
    'Có nhau là đủ', 'Một nhà hai trái tim', 'Bình yên bên nhau', 'Lời hẹn ước trọn đời', 'Em là nhà',
  ];
  let wordAt = (Math.random() * WORDS.length) | 0;
  const word = () => WORDS[wordAt++ % WORDS.length];
  const names = () => `${cfg.n1} & ${cfg.n2}`;

  /* ---------- Vòng đời một mẫu ---------- */
  let cur = null, rotateTimer = 0, counter = 0;

  function makeCtx(root) {
    const r = stage.getBoundingClientRect();
    const pending = new Set(), kills = [];
    let dead = false, rafId = 0;
    const loops = [];
    const tick = t => {
      if (dead) return;
      rafId = requestAnimationFrame(tick);
      for (const l of loops) { const dt = clamp((t - l.t) / 1000, 0, .05); l.t = t; l.fn(t / 1000, dt); }
    };
    const ctx = {
      root, W: r.width, H: r.height, ar: r.width / r.height, land: r.width >= r.height,
      v: Math.min(r.width, r.height) / 100, dur: cfg.dur * 1000,
      get dead() { return dead; },
      check() { if (dead) throw DEAD; },
      wait(ms) {
        return new Promise((res, rej) => {
          const o = { rej, t: setTimeout(() => { pending.delete(o); res(); }, ms) };
          pending.add(o);
        });
      },
      async load(p, size) { const i = await load(p, size); ctx.check(); return i; },
      /* ---- Nhịp nhạc ---- */
      beatMs: () => window.SL.beat ? window.SL.beat.beatMs() : 600,
      energy: () => window.SL.beat ? window.SL.beat.energy() : .5,
      synced: () => !!(window.SL.beat && window.SL.beat.active()),
      /**
       * Chờ tới lúc đổi ảnh. Có nhạc: rơi đúng đầu ô nhịp gần mốc target nhất (div = 4: đúng phách),
       * đoạn cao trào đổi nhanh hơn, đoạn lắng giữ lâu hơn. lead: thức dậy sớm bấy nhiêu ms
       * để điểm nhấn của hiệu ứng rơi trúng nhịp. Không có nhạc: chờ đúng target.
       */
      hold(target, lead = 0, div = 1) {
        const b = window.SL.beat;
        if (b && b.active()) {
          const ms = b.until(target * (1.3 - .65 * b.energy()) + lead, lead + 250, div);
          if (ms !== null) return ctx.wait(Math.max(0, ms - lead));
        }
        return ctx.wait(target);
      },
      onBeat(fn) { if (window.SL.beat) kills.push(window.SL.beat.on(fn)); },
      /**
       * Chữ chạy ra từng từ, mỗi phách một từ. Kiểu vào theo năng lượng nhạc:
       * lắng: hiện mờ dần; vừa: trồi lên sau mặt nạ; cao trào: bật nảy. Trả về tổng thời gian (ms).
       */
      caption(text, box, start = 0) {
        const bm = ctx.beatMs(), e = ctx.energy();
        const mode = e > .68 ? 'pop' : e > .36 ? 'rise' : 'soft';
        const first = start + (ctx.synced() ? (window.SL.beat.until(0, 80, 4) ?? 0) : 0);
        box.textContent = ''; box.getAnimations().forEach(a => a.cancel());
        const words = text.split(/\s+/).filter(Boolean);
        words.forEach((w, i) => {
          const o = el('span', 'w', box), s = el('span', '', o);
          s.textContent = w; o.dataset.mode = mode;
          const delay = first + i * bm;
          if (mode === 'soft')
            s.animate({ opacity: [0, 1], transform: ['translateY(.35em)', 'none'], filter: ['blur(.18em)', 'blur(0)'] },
              { duration: bm * 1.6, delay, fill: 'both', easing: 'ease-out' });
          else if (mode === 'rise')
            s.animate({ transform: ['translateY(115%)', 'none'] },
              { duration: bm * .9, delay, fill: 'both', easing: 'cubic-bezier(.2,.8,.2,1)' });
          else
            s.animate({ opacity: [0, 1, 1], transform: ['scale(1.7)', 'scale(.96)', 'none'], offset: [0, .7, 1] },
              { duration: Math.max(180, bm * .5), delay, fill: 'both', easing: 'cubic-bezier(.2,1.2,.4,1)' });
        });
        return first + words.length * bm;
      },
      /** Web Animations API, giữ trạng thái cuối; trả về Promise xong khi chạy hết. */
      anim(node, frames, opts) {
        const a = node.animate(frames, { fill: 'both', easing: 'cubic-bezier(.2,.7,.2,1)', ...opts });
        return a.finished.then(() => { ctx.check(); return a; }, () => { throw DEAD; });
      },
      raf(fn) { loops.push({ fn, t: performance.now() }); if (!rafId) rafId = requestAnimationFrame(tick); },
      onKill(fn) { kills.push(fn); },
      kill() {
        if (dead) return;
        dead = true; cancelAnimationFrame(rafId);
        for (const o of pending) { clearTimeout(o.t); o.rej(DEAD); }
        pending.clear();
        for (const k of kills) try { k(); } catch (e) {}
      },
    };
    return ctx;
  }

  const active = () => { const a = styles.filter(s => !cfg.off.includes(s.id)); return a.length ? a : styles; };

  function armRotate() {
    clearTimeout(rotateTimer);
    if (cfg.mode === 'auto' && active().length > 1) rotateTimer = setTimeout(() => step(1, true), cfg.rotate * 60000);
  }
  function show(id) {
    const def = styles.find(s => s.id === id) || active()[0];
    if (!def) return;
    if (cur) {
      const old = cur;
      old.ctx.kill();
      old.root.style.zIndex = 2;
      old.root.animate({ opacity: [1, 0] }, { duration: 900, fill: 'both' }).finished.then(() => old.root.remove());
    }
    const root = el('div', 'style s-' + def.id, layer);
    root.style.background = def.bg || '#000';
    const ctx = makeCtx(root);
    cur = { def, root, ctx };
    cfg.style = def.id; save();
    root.animate({ opacity: [0, 1] }, { duration: 900, fill: 'both' });
    $('#sig').classList.toggle('off', !cfg.sig || def.sig === false);
    $('#grain').hidden = !cfg.grain || def.grain === false;
    const me = cur;
    Promise.resolve().then(() => def.run(ctx)).catch(e => {
      if (e === DEAD) return;
      console.error(`[${def.id}]`, e);
      if (cur === me) setTimeout(() => { if (cur === me) step(1, true); }, 1500);   // mẫu lỗi: bỏ qua sang mẫu kế
    });
    syncPanel(); armRotate();
  }
  /** Sang mẫu kế/trước. auto = do hẹn giờ gọi: chỉ đi trong các mẫu đang bật. */
  function step(d, auto) {
    const a = auto || cfg.mode === 'auto' ? active() : styles;
    const i = cur ? a.indexOf(cur.def) : -1;
    show(a[(i + d + a.length) % a.length].id);
  }

  /* ---------- Giao diện ---------- */
  const board = $('#board'), syncers = [];
  let dirty = false, thumbsBuilt = false, toastTimer = 0;

  function toast(msg, ms = 3500) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms);
  }
  function applyLook() {
    const ar = RATIOS[cfg.ratio];
    stage.classList.toggle('auto', !ar);
    if (ar) stage.style.setProperty('--ar', ar);
    $('#sig b').textContent = names();
    $('#sig span').textContent = cfg.date;
    document.title = `Ảnh cưới ${names()}`;
  }
  function syncPanel() {
    for (const seg of $$('[data-seg]'))
      for (const b of $$('button', seg)) b.setAttribute('aria-pressed', b.dataset.v === String(cfg[seg.dataset.seg]));
    for (const i of $$('[data-k]')) {
      if (i.type === 'checkbox') i.checked = !!cfg[i.dataset.k];
      else if (i !== document.activeElement) i.value = cfg[i.dataset.k];
    }
    for (const o of $$('[data-o]')) o.textContent = cfg[o.dataset.o];
    $('#optRotate').classList.toggle('dim', cfg.mode !== 'auto');
    for (const c of $$('#styleList .card-s')) {
      c.classList.toggle('cur', cur?.def.id === c.dataset.id);
      c.classList.toggle('out', cfg.off.includes(c.dataset.id));
      $('input', c).checked = !cfg.off.includes(c.dataset.id);
    }
    $('#barStyle').textContent = cur ? cur.def.name : '';
    const n = pool().length;
    $('#barPhotos').textContent = `${n}/${photos.length}`;
    $('#photoCount').textContent = `Đang chọn ${n} trên ${photos.length} ảnh`;
    if (thumbsBuilt) { const s = new Set(cfg.skip); for (const t of $$('#thumbs .th')) t.classList.toggle('off', s.has(t.dataset.f)); }
    for (const f of syncers) f();
  }
  function buildStyleList() {
    const box = $('#styleList');
    styles.forEach((s, i) => {
      const c = el('div', 'card-s', box); c.dataset.id = s.id;
      el('span', 'num', c).textContent = i + 1;
      const t = el('div', 'txt', c);
      el('b', '', t).textContent = s.name; el('span', '', t).textContent = s.desc || '';
      const sw = el('label', 'sw', c); sw.title = 'Bật: mẫu này nằm trong vòng tự đổi';
      const inp = el('input', '', sw); inp.type = 'checkbox'; el('i', '', sw);
    });
    box.addEventListener('click', e => {
      if (e.target.closest('.sw')) return;
      const c = e.target.closest('.card-s'); if (c) show(c.dataset.id);
    });
    box.addEventListener('change', e => {
      const id = e.target.closest('.card-s')?.dataset.id; if (!id) return;
      cfg.off = e.target.checked ? cfg.off.filter(x => x !== id) : [...cfg.off, id];
      save(); syncPanel(); armRotate();
    });
  }
  function buildThumbs() {
    if (thumbsBuilt) return; thumbsBuilt = true;
    const box = $('#thumbs');
    for (const p of photos) {
      const t = el('div', 'th', box); t.dataset.f = p.f; t.title = p.f;
      const i = el('img', '', t); i.loading = 'lazy'; i.decoding = 'async'; i.src = `photos/s/${encodeURIComponent(p.f)}`;
      i.style.objectPosition = `${p.fx * 100}% ${p.fy * 100}%`;
    }
    box.addEventListener('click', e => {
      const t = e.target.closest('.th'); if (!t) return;
      const f = t.dataset.f;
      cfg.skip = cfg.skip.includes(f) ? cfg.skip.filter(x => x !== f) : [...cfg.skip, f];
      dirty = true; save(); syncPanel();
    });
    const groups = [...new Set(photos.map(p => p.g))];
    if (groups.length > 1) for (const g of groups) {
      const mine = photos.filter(p => p.g === g).map(p => p.f);
      const b = el('button', '', $('#photoGroups')); b.textContent = `${g} (${mine.length})`; b.title = 'Bấm để chọn hoặc bỏ cả bộ ảnh này';
      b.addEventListener('click', () => {
        const allOn = mine.every(f => !cfg.skip.includes(f));
        cfg.skip = allOn ? [...new Set([...cfg.skip, ...mine])] : cfg.skip.filter(f => !mine.includes(f));
        dirty = true; save(); syncPanel();
      });
    }
  }
  function openBoard(tab) {
    if (tab === 'photos') buildThumbs();
    for (const b of $$('#tabs button')) b.setAttribute('aria-selected', b.dataset.tab === tab);
    for (const s of $$('.sheet section')) s.classList.toggle('on', s.dataset.pane === tab);
    document.body.classList.add('board-open'); syncPanel();
  }
  function closeBoard() {
    document.body.classList.remove('board-open');
    if (dirty) { dirty = false; queue = []; restart(); }
  }
  const boardOpen = () => document.body.classList.contains('board-open');

  function set(k, v) {
    cfg[k] = v; save(); applyLook(); syncPanel();
    if (k === 'order') queue = [];
    if (k === 'rotate' || k === 'mode') armRotate();
    if (k === 'vol' || k === 'sync' || k === 'mshuffle') return;
    if (['sig', 'grain', 'dur', 'order', 'n1', 'n2', 'date'].includes(k)) restart();
  }
  let restartTimer = 0;
  function restart() { clearTimeout(restartTimer); restartTimer = setTimeout(() => cur && show(cur.def.id), 400); }
  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  function start() {
    if (!photos.length) {
      el('p', '', stage, { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', font: '20px system-ui' })
        .textContent = 'Chưa có ảnh. Hãy chạy: python prep.py';
      return;
    }
    // Hạt phim: một ô nhiễu 256px lát kín, dịch chuyển theo từng bước
    const n = document.createElement('canvas'); n.width = n.height = 256;
    const g = n.getContext('2d'), d = g.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.random() * 255; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    $('#grain').style.backgroundImage = `url(${n.toDataURL()})`;

    buildStyleList(); applyLook();
    for (const seg of $$('[data-seg]'))
      seg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) set(seg.dataset.seg, b.dataset.v); });
    for (const i of $$('[data-k]'))
      i.addEventListener('input', () => set(i.dataset.k, i.type === 'checkbox' ? i.checked : i.type === 'range' ? +i.value : i.value));
    $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) openBoard(b.dataset.tab); });
    board.addEventListener('pointerdown', e => { if (e.target === board) closeBoard(); });
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-act]')?.dataset.act; if (!a) return;
      if (a.startsWith('tab:')) openBoard(a.slice(4));
      else if (a === 'close') closeBoard();
      else if (a === 'prev') step(-1);
      else if (a === 'next') step(1);
      else if (a === 'fs') { closeBoard(); fullscreen(); }
      else if (a === 'pall') { cfg.skip = []; dirty = true; save(); syncPanel(); }
      else if (a === 'pnone') { cfg.skip = photos.map(p => p.f); dirty = true; save(); syncPanel(); }
      else if (a === 'reset') {
        for (const k of ['ratio', 'n1', 'n2', 'date', 'sig', 'grain']) cfg[k] = DEFAULTS[k];
        save(); applyLook(); syncPanel(); restart();
      }
    });
    stage.addEventListener('dblclick', fullscreen);
    addEventListener('keydown', e => {
      if (e.target.matches('input') || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'f') fullscreen();
      else if (k === 'h') boardOpen() ? closeBoard() : openBoard('styles');
      else if (k === 'escape') closeBoard();
      else if (k === 'arrowright') step(1);
      else if (k === 'arrowleft') step(-1);
      else if (k === '0') set('ratio', 'auto');
      else if (k === '1') set('ratio', '3:2');
      else if (k === '2') set('ratio', '2:3');
      else if (k === '3') set('ratio', '4:3');
      else if (k === '4') set('ratio', '16:9');
    });

    let idleTimer;
    const wake = () => {
      document.body.classList.remove('idle');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { if (!boardOpen()) document.body.classList.add('idle'); }, 3000);
    };
    addEventListener('pointermove', wake); addEventListener('pointerdown', wake); wake();

    let lock;
    const keepAwake = async () => { try { if (!lock || lock.released) lock = await navigator.wakeLock?.request('screen'); } catch (e) {} };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) keepAwake(); });
    addEventListener('pointerdown', keepAwake, { once: true }); keepAwake();

    // Đổi kích thước khung: dựng lại mẫu đang chạy cho đúng bố cục
    let w0 = 0, h0 = 0;
    new ResizeObserver(() => {
      const r = stage.getBoundingClientRect();
      if (Math.abs(r.width - w0) < 2 && Math.abs(r.height - h0) < 2) return;
      const first = !w0; w0 = r.width; h0 = r.height;
      if (!first) restart();
    }).observe(stage);

    (document.fonts?.ready || Promise.resolve()).then(() => {
      show(styles.some(s => s.id === cfg.style) ? cfg.style : active()[0].id);
      const tab = new URLSearchParams(location.search).get('bang');      // ?bang=music mở sẵn một thẻ
      if (tab) openBoard(tab);
    });
  }

  return {
    cfg, photos, DEAD, start, save, set, toast, pool,
    onSync: f => syncers.push(f), sync: () => syncPanel(),
    register: def => styles.push(def),
    el, css, rnd, pick, clamp, shuffle, orient, loss, cover, contain, place, load, next, group, word, names,
  };
})();
