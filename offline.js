/* Dùng không cần mạng: đăng ký sw.js và (trên trang chọn, nơi có <section id="offline">) hiện nút tải trọn bộ
   ảnh, nhạc về máy. File nằm trong Cache Storage của trình duyệt, không tự hết hạn. */
(() => {
  'use strict';
  const ROOT = new URL('.', document.currentScript.src).href;
  const abs = p => new URL(p, ROOT).href;
  const SHELL = 'wd-shell', MEDIA = 'wd-media', KEY = 'wd-offline-v1';
  const IS_MEDIA = /\.(jpe?g|png|webp|mp3|m4a|aac|wav|ogg|flac|opus|woff2)$/i;
  const ok = 'serviceWorker' in navigator && 'caches' in window && location.protocol !== 'file:';
  if (ok) navigator.serviceWorker.register(abs('sw.js')).catch(() => {});

  const box = document.getElementById('offline');
  if (!box) return;
  const el = (tag, cls, parent, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  el('h2', '', box, 'Dùng khi không có mạng');
  if (!ok) {
    el('p', 'lead', box, location.protocol === 'file:'
      ? 'Bạn đang mở trang từ file trên máy: mọi thứ đã nằm sẵn trên máy, không cần mạng.'
      : 'Trình duyệt này không hỗ trợ lưu để dùng không cần mạng (hoặc đang ở chế độ ẩn danh). Hãy mở bằng Chrome, Edge hoặc Safari thường.');
    return;
  }
  el('p', 'lead', box, 'Tải trọn bộ về máy này khi còn mạng (nên dùng Wi-Fi). Sau đó trang, ảnh và nhạc chạy được cả khi mất mạng. '
    + 'Mỗi máy, mỗi trình duyệt phải tải riêng; đừng dùng tab ẩn danh và đừng xoá dữ liệu trình duyệt.');

  const script = src => new Promise(res => {
    const s = document.createElement('script'); s.src = abs(src); s.onload = s.onerror = res; document.head.appendChild(s);
  });
  const enc = encodeURIComponent;
  const SLIDE_JS = ['core', 'music', 's-cine', 's-mag', 's-film', 's-pola', 's-wall', 's-grid', 's-galaxy', 's-split'];

  /** Trang, mã, danh sách và font: luôn tải lại bản mới mỗi lần bấm tải. */
  async function shellList() {
    const list = ['./', 'index.html', 'offline.js', 'manifest.webmanifest', 'nhac-le/board.css', 'nhac-le/board.js', 'nhac-le/list.js',
      'sao-roi/', 'sao-roi/index.html', 'doi-man/', 'doi-man/index.html', 'sao-roi/fonts/fonts.css',
      'slide-anh/', 'slide-anh/index.html', 'slide-anh/app.css', 'slide-anh/photos.js', 'slide-anh/skip.js', 'slide-anh/music.js',
      'slide-anh/fonts/fonts.css', ...SLIDE_JS.map(n => `slide-anh/js/${n}.js`)].map(abs);
    for (const css of ['sao-roi/fonts/fonts.css', 'slide-anh/fonts/fonts.css']) {
      try {
        const t = await (await fetch(abs(css))).text();
        for (const m of t.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) list.push(new URL(m[1], abs(css)).href);
      } catch (e) {}
    }
    return [...new Set(list)];
  }
  async function slideList() {
    if (!window.MUSIC) await script('slide-anh/music.js');
    const out = [];
    for (const p of window.PHOTOS || []) out.push(abs(`slide-anh/photos/l/${enc(p.f)}`), abs(`slide-anh/photos/s/${enc(p.f)}`));
    for (const f of window.MUSIC || []) out.push(abs(`slide-anh/music/${enc(f)}`));
    return out;
  }
  const leList = async () => (window.CEREMONY || []).flatMap(p => p.songs.map(s => abs(`nhac-le/${p.id}/${enc(s.f)}`)));

  const PACKS = [
    { id: 'slide', name: 'Slide ảnh cưới và màn sao rơi', note: 'ảnh và nhạc nền của slide', list: slideList },
    { id: 'le', name: 'Nhạc buổi lễ', note: 'nhạc của 15 hạng mục, dung lượng lớn', list: leList },
  ];
  const memo = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const mb = n => n >= 1e9 ? (n / 1e9).toFixed(2).replace('.', ',') + ' GB' : Math.round(n / 1e6) + ' MB';
  const cacheFor = u => IS_MEDIA.test(new URL(u).pathname) ? MEDIA : SHELL;
  const savedSet = async () => {
    const set = new Set();
    for (const n of [SHELL, MEDIA]) for (const r of await (await caches.open(n)).keys()) set.add(r.url);
    return set;
  };

  let busy = false;
  const rows = PACKS.map(p => {
    const row = el('div', 'off-row', box);
    const txt = el('div', 'off-txt', row);
    el('b', '', txt, p.name);
    p.stat = el('span', '', txt, 'Đang kiểm tra…');
    p.bar = el('i', '', el('div', 'off-bar', txt));
    p.btn = el('button', 'off-go', row, 'Tải về máy này');
    p.btn.addEventListener('click', () => download(p));
    return p;
  });
  const foot = el('p', 'off-foot', box);
  const wipe = el('button', 'off-wipe', box, 'Xoá bản đã lưu trên máy này');
  wipe.addEventListener('click', async () => {
    if (busy || !confirm('Xoá toàn bộ ảnh và nhạc đã lưu trên máy này? Muốn dùng không cần mạng sẽ phải tải lại.')) return;
    await caches.delete(MEDIA); await caches.delete(SHELL); localStorage.removeItem(KEY); refresh();
  });

  async function refresh() {
    const set = await savedSet(), m = memo();
    for (const p of rows) {
      p.urls = p.urls || await p.list();
      const have = p.urls.filter(u => set.has(u)).length, all = p.urls.length;
      p.bar.style.width = (all ? have / all * 100 : 0) + '%';
      p.done = all > 0 && have === all;
      p.stat.textContent = p.done
        ? `Đã lưu đủ ${all} file${m[p.id] ? ' ngày ' + new Date(m[p.id]).toLocaleDateString('vi-VN') : ''}. Dùng được khi không có mạng.`
        : have ? `Mới lưu ${have}/${all} file. Bấm tải để lưu nốt.` : `Chưa lưu (${all} file, ${p.note}).`;
      p.stat.className = p.done ? 'ok' : '';
      p.btn.textContent = p.done ? 'Kiểm tra và cập nhật' : have ? 'Tải tiếp' : 'Tải về máy này';
    }
    try {
      const e = await navigator.storage.estimate(), keep = await navigator.storage.persisted();
      foot.textContent = `Đang dùng ${mb(e.usage || 0)} bộ nhớ trình duyệt, còn được phép khoảng ${mb(Math.max(0, (e.quota || 0) - (e.usage || 0)))}. `
        + (keep ? 'Trình duyệt đã cam kết giữ dữ liệu này.' : 'Trình duyệt chưa cam kết giữ lâu dài: hãy mở lại trang này một ngày trước lễ để kiểm tra.')
        + ' iPhone, iPad: bấm Chia sẻ, chọn "Thêm vào Màn hình chính", mở trang từ biểu tượng đó rồi mới tải, nếu không Safari có thể xoá sau 7 ngày không mở.';
    } catch (e) { foot.textContent = ''; }
  }

  /** Tải một file thẳng từ mạng (?dl để sw.js không chen vào) rồi lưu dưới đường dẫn gốc. */
  async function grab(u) {
    for (let k = 0; ; k++) {
      try {
        const res = await fetch(u + '?dl=1', { cache: 'no-cache' });
        if (res.status !== 200) throw new Error(res.status);
        await (await caches.open(cacheFor(u))).put(u, res);
        return true;
      } catch (e) {
        if (e && e.name === 'QuotaExceededError') throw e;
        if (k >= 2) return false;
        await new Promise(r => setTimeout(r, 800 * (k + 1)));
      }
    }
  }
  async function download(p) {
    if (busy) return;
    busy = true; rows.forEach(r => { r.btn.disabled = true; }); wipe.disabled = true;
    try { await navigator.storage.persist(); } catch (e) {}
    let failed = 0, full = false;
    try {
      const shell = await shellList(), set = await savedSet();
      // file ảnh, nhạc đã lưu thì giữ; trang và mã thì luôn lấy bản mới
      const todo = [...shell, ...p.urls.filter(u => !set.has(u))];
      const all = shell.length + p.urls.length, base = all - todo.length;
      let n = 0, at = 0;
      const tick = () => {
        p.stat.className = '';
        p.stat.textContent = `Đang tải ${base + n}/${all} file… Giữ trang này mở, đừng tắt màn hình.`;
        p.bar.style.width = ((base + n) / all * 100) + '%';
      };
      tick();
      const worker = async () => {
        while (at < todo.length && !full) {
          const u = todo[at++];
          try { if (!await grab(u)) failed++; } catch (e) { full = true; }
          n++; tick();
        }
      };
      await Promise.all(Array.from({ length: 4 }, worker));
    } catch (e) { failed++; }
    busy = false; rows.forEach(r => { r.btn.disabled = false; }); wipe.disabled = false;
    await refresh();
    if (full) { p.stat.textContent = 'Máy hết chỗ lưu cho trình duyệt. Hãy giải phóng bộ nhớ rồi bấm tải tiếp.'; p.stat.className = 'bad'; }
    else if (failed || !p.done) { p.stat.textContent = `Còn ${failed || 'một số'} file chưa tải được (mạng yếu?). Bấm "Tải tiếp" để lưu nốt.`; p.stat.className = 'bad'; }
    else { const m = memo(); m[p.id] = Date.now(); localStorage.setItem(KEY, JSON.stringify(m)); refresh(); }
  }

  refresh();
})();
