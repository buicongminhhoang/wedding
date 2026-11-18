/* Bảng nhạc buổi lễ: chọn hạng mục, bài ưa thích, điểm bắt đầu; phát có nối mượt giữa các bài. */
(() => {
  'use strict';
  const PHASES = (window.CEREMONY || []).filter(p => p.songs.length);
  const root = document.getElementById('music');
  if (!root || !PHASES.length) { if (root) root.hidden = true; return; }

  const KEY = 'le-cuoi-nhac-v1';
  const st = { fav: {}, start: {}, vol: .9, done: {} };
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

  const id = (p, s) => p.id + '/' + s.f;
  const isFav = (p, s) => st.fav[id(p, s)] ?? s.fav;
  const startOf = (p, s) => st.start[id(p, s)] ?? s.lead ?? 0;
  const url = (p, s) => `nhac-le/${p.id}/${encodeURIComponent(s.f)}`;
  const mmss = t => { t = Math.max(0, t || 0); return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; };
  const el = (tag, cls, parent, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ---------- Phát nhạc: hai kênh để bài cũ nhỏ dần trong lúc bài mới vào ---------- */
  const decks = [new Audio(), new Audio()];
  decks.forEach(a => { a.preload = 'auto'; });
  let live = 0;                         // kênh đang phát
  let now = null;                       // { p, s, queue, at }
  let stopping = false;
  const fades = new Map();
  function fade(a, to, ms, then) {
    cancelAnimationFrame(fades.get(a));
    const from = a.volume, t0 = performance.now();
    const step = t => {
      const q = Math.min(1, (t - t0) / ms);
      a.volume = Math.max(0, Math.min(1, from + (to - from) * q));
      if (q < 1) fades.set(a, requestAnimationFrame(step)); else if (then) then();
    };
    fades.set(a, requestAnimationFrame(step));
  }
  const level = s => Math.max(0, Math.min(1, st.vol * (s.gain ?? 1)));

  /** Danh sách phát của một hạng mục: bài ưa thích trước; nhạc nền thì thêm các bài còn lại (trộn). */
  function queueOf(p, first) {
    const favs = p.songs.filter(s => isFav(p, s)), rest = p.songs.filter(s => !isFav(p, s));
    let q = favs.length ? [...(p.kind === 'nen' ? shuffle(favs) : favs)] : [];
    if (p.kind === 'nen' || !q.length) q = q.concat(p.kind === 'nen' ? shuffle(rest) : rest.slice(0, 1));
    if (first) q = [first, ...q.filter(s => s !== first)];
    return q;
  }
  function start(p, s, queue) {
    const old = decks[live]; live = 1 - live;
    const a = decks[live];
    if (!old.paused) fade(old, 0, 1500, () => old.pause());
    if (now && now.p !== p) st.done[now.p.id] = true;
    delete st.done[p.id]; save();
    now = { p, s, queue }; stopping = false;
    a.src = url(p, s); a.volume = 0;
    const seek = () => { try { a.currentTime = startOf(p, s); } catch (e) {} };
    a.addEventListener('loadedmetadata', seek, { once: true });
    a.play().then(() => { fade(a, level(s), 700); keepAwake(); }, () => toast('Trình duyệt chặn phát nhạc. Bấm lại nút Phát một lần nữa.'));
    render();
  }
  const playPhase = p => { const q = queueOf(p); if (q.length) start(p, q[0], q); };
  const playSong = (p, s) => start(p, s, queueOf(p, s));
  function nextSong() {
    if (!now) return;
    const q = now.queue, i = q.indexOf(now.s);
    start(now.p, q[(i + 1) % q.length], q);
  }
  function nextPhase() {
    const i = now ? PHASES.indexOf(now.p) : -1, p = PHASES[i + 1];
    if (p) { playPhase(p); document.querySelector(`[data-ph="${p.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }
  /** Nhỏ dần rồi dừng (3 giây). Bấm lần nữa để phát tiếp. */
  function fadeStop() {
    const a = decks[live];
    if (!now) return;
    if (a.paused || stopping) { stopping = false; a.play().then(() => fade(a, level(now.s), 500)); render(); return; }
    stopping = true; fade(a, 0, 3000, () => { a.pause(); render(); });
    render();
  }
  decks.forEach(a => a.addEventListener('ended', () => { if (a === decks[live]) nextSong(); }));

  let lock;
  async function keepAwake() { try { if (!lock || lock.released) lock = await navigator.wakeLock?.request('screen'); } catch (e) {} }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && now) keepAwake(); });

  /* ---------- Giao diện ---------- */
  root.innerHTML = `
    <h2>Nhạc buổi lễ</h2>
    <p class="lead">Bấm <b>Phát</b> ở hạng mục đang diễn ra: bài ưa thích (★) vang lên từ đúng điểm bắt đầu đã đặt, bài cũ tự nhỏ dần.
      Mở một hạng mục để đổi bài ưa thích hoặc chỉnh điểm bắt đầu. Khi nhạc đang phát, màn sao rơi và slide sẽ mở ở thẻ mới để nhạc không bị ngắt.</p>
    <div class="tools">
      <button data-a="openall">Mở tất cả hạng mục</button>
      <button data-a="closeall">Thu gọn</button>
      <button data-a="export">Sao chép cấu hình</button>
      <button data-a="reset">Về gợi ý ban đầu</button>
    </div>
    <div id="phList" style="display:grid;gap:10px"></div>`;
  const list = root.querySelector('#phList');
  const open = new Set();
  let editing = null;                   // id bài đang mở ô chỉnh điểm bắt đầu

  const pl = el('div', 'pl', document.body); pl.hidden = true;
  pl.innerHTML = `
    <div class="what"><small></small><b></b></div>
    <div class="ctl">
      <button data-a="song" title="Bài kế trong hạng mục này">Bài kế ⏭</button>
      <button data-a="stop" class="stop" title="Phím cách">Nhỏ dần rồi dừng</button>
      <button data-a="phase" class="nextp" title="Phím →"></button>
    </div>
    <div class="seek"><span class="t"></span><input type="range" class="pos" min="0" max="1" step="0.1" value="0" aria-label="Vị trí trong bài">
      <span class="d"></span><span class="v">Âm lượng</span><input type="range" class="vol" min="0" max="1" step="0.02" aria-label="Âm lượng"></div>`;
  const $ = s => pl.querySelector(s);
  $('.vol').value = st.vol;
  let toastT = 0;
  function toast(msg) {
    let t = document.getElementById('mToast');
    if (!t) { t = el('div', '', document.body); t.id = 'mToast'; t.style.cssText = 'position:fixed;left:50%;top:18px;translate:-50% 0;z-index:30;padding:10px 18px;border-radius:999px;background:rgba(16,18,28,.95);border:1px solid rgba(255,255,255,.2);font:500 14px system-ui;color:#fff;max-width:calc(100vw - 24px);text-align:center'; }
    t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3500);
  }

  function render() {
    list.textContent = '';
    PHASES.forEach((p, i) => {
      const playing = now && now.p === p && !decks[live].paused && !stopping;
      const row = el('div', 'ph-row' + (now && now.p === p ? ' on' : '') + (st.done[p.id] ? ' done' : '') + (open.has(p.id) ? ' open' : ''), list);
      row.dataset.ph = p.id;
      const head = el('div', 'ph-head', row);
      el('div', 'ph-num', head, st.done[p.id] && !(now && now.p === p) ? '✓' : String(i + 1));
      const name = el('div', 'ph-name', head);
      el('b', '', name, p.title);
      const favs = p.songs.filter(s => isFav(p, s));
      el('span', 'favs', name, favs.length ? '★ ' + favs.slice(0, 2).map(s => s.t).join(' · ') + (favs.length > 2 ? ` · +${favs.length - 2} bài` : '') : 'Chưa chọn bài ưa thích');
      el('span', '', name, p.hint);
      el('div', 'ph-count', head, `${p.songs.length} bài`);
      const play = el('button', 'ph-play', head, playing ? 'Đang phát' : '▶ Phát');
      play.onclick = e => { e.stopPropagation(); playPhase(p); };
      head.onclick = () => { open.has(p.id) ? open.delete(p.id) : open.add(p.id); render(); };

      if (!open.has(p.id)) return;
      const body = el('div', 'ph-body', row);
      for (const s of p.songs) {
        const sid = id(p, s), cur = now && now.p === p && now.s === s;
        const g = el('div', 'sg' + (cur ? ' cur' : ''), body);
        const star = el('button', 'star', g, isFav(p, s) ? '★' : '☆');
        star.setAttribute('aria-pressed', isFav(p, s)); star.title = 'Bài ưa thích của hạng mục này';
        star.onclick = () => {
          const v = !isFav(p, s);
          if (v && p.kind === 'diem') for (const o of p.songs) st.fav[id(p, o)] = false;      // khoảnh khắc sân khấu: chỉ một bài
          st.fav[sid] = v; save(); render();
        };
        const ti = el('div', 'ti', g);
        el('b', '', ti, s.t);
        el('small', '', ti, [mmss(s.dur), s.src].filter(Boolean).join(' · '));
        const at = el('button', 'at' + (startOf(p, s) > 0.5 ? ' set' : ''), g, 'Bắt đầu ' + mmss(startOf(p, s)));
        at.title = 'Chỉnh điểm bắt đầu'; at.onclick = () => { editing = editing === sid ? null : sid; render(); };
        const go = el('button', 'go', g, cur && playing ? '❚❚' : '▶'); go.title = 'Phát bài này';
        go.onclick = () => (cur && playing) ? fadeStop() : playSong(p, s);

        if (editing !== sid) continue;
        const ed = el('div', 'ed', g);
        const info = el('p', '', ed);
        info.innerHTML = `Điểm bắt đầu hiện tại: <b>${mmss(startOf(p, s))}</b>. ` +
          (cur ? 'Kéo thanh ở dưới đáy màn hình tới chỗ muốn vào bài rồi bấm nút vàng.' : 'Bấm ▶ để nghe thử, rồi kéo tới chỗ muốn vào bài.');
        const btns = el('div', 'btns', ed);
        const setAt = (t, replay) => { st.start[sid] = Math.max(0, Math.round(t * 10) / 10); save(); if (replay) playSong(p, s); else render(); };
        if (cur) { const b = el('button', 'hot', btns, 'Lấy vị trí đang nghe làm điểm bắt đầu'); b.onclick = () => setAt(decks[live].currentTime, false); }
        el('button', '', btns, `Đầu bài (${mmss(s.lead)})`).onclick = () => setAt(s.lead || 0, cur);
        if (s.hook != null) el('button', '', btns, `Cao trào ≈ ${mmss(s.hook)}`).onclick = () => setAt(s.hook, true);
        el('button', '', btns, '− 1 giây').onclick = () => setAt(startOf(p, s) - 1, cur);
        el('button', '', btns, '+ 1 giây').onclick = () => setAt(startOf(p, s) + 1, cur);
        el('button', '', btns, 'Nghe thử từ điểm bắt đầu').onclick = () => playSong(p, s);
      }
    });

    pl.hidden = !now;
    if (now) {
      const a = decks[live], nxt = PHASES[PHASES.indexOf(now.p) + 1];
      $('.what small').textContent = now.p.title + (stopping ? ' · đang nhỏ dần' : a.paused ? ' · đã dừng' : '');
      $('.what b').textContent = now.s.t;
      $('[data-a=stop]').textContent = a.paused || stopping ? '▶ Phát tiếp' : 'Nhỏ dần rồi dừng';
      $('[data-a=stop]').classList.toggle('stop', !(a.paused || stopping));
      $('[data-a=song]').hidden = now.queue.length < 2;
      $('[data-a=phase]').hidden = !nxt;
      if (nxt) $('[data-a=phase]').textContent = 'Kế tiếp: ' + nxt.title + ' ▶';
    }
  }

  // Thanh thời gian
  let dragging = false;
  $('.pos').addEventListener('input', () => { dragging = true; $('.t').textContent = mmss(+$('.pos').value); });
  $('.pos').addEventListener('change', () => { decks[live].currentTime = +$('.pos').value; dragging = false; });
  $('.vol').addEventListener('input', () => { st.vol = +$('.vol').value; save(); if (now && !stopping) decks[live].volume = level(now.s); });
  setInterval(() => {
    if (!now) return;
    const a = decks[live], d = a.duration || now.s.dur || 0;
    $('.pos').max = d;
    if (!dragging) { $('.pos').value = a.currentTime; $('.t').textContent = mmss(a.currentTime); }
    $('.d').textContent = mmss(d);
  }, 250);

  pl.addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'song') nextSong(); else if (a === 'stop') fadeStop(); else if (a === 'phase') nextPhase();
  });
  root.addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'openall') { PHASES.forEach(p => open.add(p.id)); render(); }
    if (a === 'closeall') { open.clear(); editing = null; render(); }
    if (a === 'reset') { if (confirm('Bỏ mọi bài ưa thích và điểm bắt đầu bạn đã chỉnh, quay về gợi ý ban đầu?')) { st.fav = {}; st.start = {}; st.done = {}; save(); render(); } }
    if (a === 'export') {
      const data = JSON.stringify({ fav: st.fav, start: st.start }, null, 1);
      (navigator.clipboard?.writeText(data) || Promise.reject()).then(() => toast('Đã sao chép cấu hình. Dán và gửi cho người lập trang để ghi cố định.'),
        () => prompt('Sao chép đoạn cấu hình này:', data));
    }
  });
  addEventListener('keydown', e => {
    if (e.target.matches('input, textarea') || e.ctrlKey || e.metaKey || e.altKey || !now) return;
    if (e.code === 'Space') { e.preventDefault(); fadeStop(); }
    else if (e.key === 'ArrowRight') nextPhase();
  });

  // Đang phát nhạc thì mở trang chiếu ở thẻ mới (nhạc không bị ngắt); slide ảnh tắt nhạc riêng của nó
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="sao-roi/"], a[href^="slide-anh/"]');
    if (!a || !now || decks[live].paused) return;
    a.target = '_blank'; a.rel = 'noopener';
    if (a.getAttribute('href').startsWith('slide-anh/') && !/nhac=0/.test(a.href)) a.href += (a.href.includes('?') ? '&' : '?') + 'nhac=0';
  }, true);
  addEventListener('beforeunload', e => { if (now && !decks[live].paused) { e.preventDefault(); e.returnValue = ''; } });

  render();
})();
