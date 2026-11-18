/* Nhạc nền: phát các file trong thư mục music/ (danh sách do prep.py ghi vào music.js). */
(() => {
  'use strict';
  const { cfg, el } = SL;
  const $ = s => document.querySelector(s);
  const audio = new Audio();
  audio.preload = 'auto';
  const state = () => (cfg.mstate && typeof cfg.mstate === 'object') ? cfg.mstate : (cfg.mstate = {});
  // Mỗi lần mở hoặc tải lại trang, thứ tự bài được trộn ngẫu nhiên; chỉ nhớ bài nào đang được tick
  let tracks = SL.shuffle((window.MUSIC || []).map(f => ({
    id: f, name: f.replace(/\.[^.]+$/, ''), url: 'music/' + encodeURIComponent(f),
    on: state()[f]?.on ?? true,
  })));
  let cur = null, wanted = false, blocked = false, fadeT = 0;

  function persist() {
    cfg.mstate = {};
    tracks.forEach(t => { cfg.mstate[t.id] = { on: t.on }; });
    SL.save();
  }

  /* ----- Phát ----- */
  const enabled = () => tracks.filter(t => t.on);
  function fadeTo(v, ms = 900) {
    cancelAnimationFrame(fadeT);
    const from = audio.volume, t0 = performance.now();
    const stepFn = now => {
      const q = Math.min(1, (now - t0) / ms);
      audio.volume = Math.max(0, Math.min(1, from + (v - from) * q));
      if (q < 1) fadeT = requestAnimationFrame(stepFn);
    };
    fadeT = requestAnimationFrame(stepFn);
  }
  function play(t) {
    const list = enabled();
    if (!list.length) {
      SL.toast(tracks.length ? 'Chưa tick bài nhạc nào. Mở thẻ Nhạc nền để chọn.' : 'Chưa có nhạc trong thư mục music.');
      wanted = false; render(); return;
    }
    t = t || (cur && cur.on ? cur : list[0]);
    wanted = true; cfg.mplay = true; SL.save();
    if (t !== cur || !audio.src) { cur = t; audio.src = t.url; audio.volume = 0; }
    audio.play().then(() => { blocked = false; fadeTo(cfg.vol); render(); }, () => {
      blocked = true; render();
      SL.toast('Bấm vào màn hình một lần để trình duyệt cho phép phát nhạc', 6000);
    });
    render();
  }
  function pause() { wanted = false; cfg.mplay = false; SL.save(); audio.pause(); render(); }
  function next() {
    const list = enabled();
    if (!list.length) return pause();
    let t;
    if (cfg.mshuffle === 'yes' && list.length > 1) { do t = SL.pick(list); while (t === cur); }
    else t = list[(list.indexOf(cur) + 1) % list.length];
    cur = null; play(t);
  }
  audio.addEventListener('ended', next);
  audio.addEventListener('error', () => {
    if (!wanted || !cur) return;
    SL.toast(`Không phát được: ${cur.name}`);
    cur.on = false; persist(); next();
  });
  const unblock = () => { if (blocked && wanted) play(); };
  addEventListener('pointerdown', unblock); addEventListener('keydown', unblock);

  /* ----- Nhịp: vạch ô nhịp và năng lượng của bài đang phát (window.BEATS do prep.py ghi) ----- */
  const BEATS = window.BEATS || {};
  const grid = () => (cfg.sync && wanted && !audio.paused && cur) ? BEATS[cur.id] : null;
  const barAt = (b, t) => {                     // chỉ số ô nhịp chứa thời điểm t (có thể vượt quá cuối bài)
    let lo = 0, hi = b.bars.length - 1;
    if (t >= b.bars[hi]) return hi + Math.floor((t - b.bars[hi]) / (b.bars[hi] - b.bars[hi - 1]));
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (b.bars[mid] <= t) lo = mid; else hi = mid - 1; }
    return lo;
  };
  const barTime = (b, i) => {
    const n = b.bars.length - 1;
    return i <= n ? b.bars[Math.max(0, i)] : b.bars[n] + (i - n) * (b.bars[n] - b.bars[n - 1]);
  };
  const subs = new Set();
  SL.beat = {
    active: () => !!grid(),
    bpm: () => (cur && BEATS[cur.id]) ? BEATS[cur.id].bpm : 0,
    /** Độ dài một phách (ms). Không có nhạc thì coi như 100 BPM. */
    beatMs() {
      const b = grid(); if (!b) return 600;
      const i = barAt(b, audio.currentTime);
      return (barTime(b, i + 1) - barTime(b, i)) * 250;
    },
    /** Năng lượng đoạn nhạc hiện tại, 0 (lắng) đến 1 (cao trào); điệp khúc được cộng thêm. */
    energy() {
      const b = grid(); if (!b) return .5;
      const t = audio.currentTime, e = b.e[Math.min(b.e.length - 1, barAt(b, t))] ?? .5;
      return Math.min(1, e + (b.ch.some(c => t >= c[0] && t < c[1]) ? .2 : 0));
    },
    /** Số ms tới vạch chia gần mốc (bây giờ + target) nhất, cách ít nhất min. div = 1: đầu ô nhịp, 4: từng phách. */
    until(target, min = 0, div = 1) {
      const b = grid(); if (!b) return null;
      const t = audio.currentTime, want = t + target / 1000, i0 = barAt(b, want);
      let best = null;
      for (let i = i0 - 1; i <= i0 + 2; i++) for (let k = 0; k < div; k++) {
        const bt = barTime(b, i) + (barTime(b, i + 1) - barTime(b, i)) * k / div;
        if (bt < t + min / 1000) continue;
        if (best === null || Math.abs(bt - want) < Math.abs(best - want)) best = bt;
      }
      if (best === null || best > audio.duration - .3) return null;      // sát cuối bài: để mẫu tự đếm giây
      return (best - t) * 1000;
    },
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
  let lastBeat = -1;
  (function tick() {
    requestAnimationFrame(tick);
    const b = grid(); if (!b) { lastBeat = -1; return; }
    const t = audio.currentTime, i = barAt(b, t), len = barTime(b, i + 1) - barTime(b, i);
    const n = i * 4 + Math.min(3, Math.floor((t - barTime(b, i)) / len * 4));
    if (n === lastBeat || t < b.bars[0]) return;
    lastBeat = n;
    const e = SL.beat.energy();
    for (const f of subs) try { f(n % 4, e); } catch (err) {}
  })();

  /* ----- Giao diện ----- */
  function render() {
    const playing = wanted && !audio.paused;
    $('#mPlay').textContent = wanted ? '⏸ Tạm dừng nhạc' : '▶ Phát nhạc';
    $('#barPlay').textContent = wanted ? '♪ Tắt nhạc' : '♪ Bật nhạc';
    $('#barMusic').textContent = tracks.length ? `${enabled().length}/${tracks.length} bài` : 'chưa có';
    $('#nowPlay').textContent = blocked ? 'Đang chờ: bấm vào màn hình một lần để bắt đầu phát'
      : cur && wanted ? `Đang phát: ${cur.name}` + (BEATS[cur.id]
        ? ` · ${Math.round(BEATS[cur.id].bpm)} BPM` + (cfg.sync ? ' · slide đang chạy theo nhịp' : '')
        : ' · bài này chưa có dữ liệu nhịp, slide đếm theo giây') : '';
    const box = $('#trackList'); box.textContent = '';
    if (!tracks.length) { el('div', 'empty', box).textContent = 'Chưa có bài nào trong thư mục music.'; return; }
    tracks.forEach((t, i) => {
      const r = el('label', 'tr' + (t === cur && wanted ? ' cur' : ''), box);
      const c = el('input', '', r); c.type = 'checkbox'; c.checked = t.on; c.title = 'Đưa bài này vào danh sách phát';
      c.onchange = () => { t.on = c.checked; persist(); if (!t.on && t === cur && wanted) next(); else render(); };
      const nm = el('span', 'nm', r); nm.textContent = t.name;
      el('small', '', nm).textContent = BEATS[t.id] ? `${Math.round(BEATS[t.id].bpm)} BPM` : 'chưa có nhịp';
      const btn = (txt, title, fn) => {
        const b = el('button', '', r); b.textContent = txt; b.title = title;
        b.onclick = e => { e.preventDefault(); fn(); };
      };
      btn(t === cur && playing ? '⏸ Dừng' : '▶ Nghe', 'Phát bài này', () => (t === cur && playing) ? pause() : (t.on = true, persist(), play(t)));
    });
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'mtoggle') wanted ? pause() : play();
    if (a === 'mnext') next();
    if (a === 'mall' || a === 'mnone') { tracks.forEach(t => t.on = a === 'mall'); persist(); if (a === 'mnone' && wanted) pause(); else render(); }
  });
  addEventListener('keydown', e => {
    if (e.target.matches('input') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.toLowerCase() === 'm') wanted ? pause() : play();
    if (e.key.toLowerCase() === 'n') next();
  });
  let lastVol = cfg.vol;
  SL.onSync(() => { if (cfg.vol !== lastVol) { lastVol = cfg.vol; if (wanted) { cancelAnimationFrame(fadeT); audio.volume = cfg.vol; } } });

  render();
  if (cfg.mplay && enabled().length) play();
})();
