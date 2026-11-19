/* Service worker: cho trang chạy khi không có mạng.
   - Ảnh, nhạc, font (kho "wd-media"): lấy từ bản đã lưu trước, không có mới ra mạng. Trả đúng từng khúc (Range) để tua nhạc được.
   - Trang, mã, danh sách (kho "wd-shell"): lấy bản mới trên mạng trước, mất mạng hoặc quá 4 giây thì dùng bản đã lưu.
   Việc tải trọn bộ ảnh và nhạc do offline.js làm (nút "Tải về" trên trang chọn). */
const SHELL = 'wd-shell', MEDIA = 'wd-media';
const IS_MEDIA = /\.(jpe?g|png|webp|mp3|m4a|aac|wav|ogg|flac|opus|woff2)$/i;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.searchParams.has('dl')) return;                       // offline.js tự tải và tự lưu
  e.respondWith(IS_MEDIA.test(url.pathname) ? media(req, url) : shell(req, url));
});

async function media(req, url) {
  const cache = await caches.open(MEDIA);
  const hit = await cache.match(url.origin + url.pathname);
  const range = req.headers.get('range');
  if (hit) return range ? slice(hit, range) : hit;
  const res = await fetch(req);
  if (!range && res.status === 200) cache.put(url.origin + url.pathname, res.clone()).catch(() => {});
  return res;
}

/** Cắt một khúc từ file đã lưu theo yêu cầu Range của thẻ audio (Safari bắt buộc phải có). */
async function slice(res, range) {
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  const blob = await res.blob(), size = blob.size;
  if (!m || (m[1] === '' && m[2] === '')) return new Response(blob, { status: 200, headers: res.headers });
  let a, b;
  if (m[1] === '') { a = Math.max(0, size - +m[2]); b = size - 1; }
  else { a = +m[1]; b = m[2] === '' ? size - 1 : Math.min(+m[2], size - 1); }
  if (a >= size || a > b) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(blob.slice(a, b + 1), {
    status: 206, statusText: 'Partial Content',
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': String(b - a + 1), 'Accept-Ranges': 'bytes',
    },
  });
}

async function shell(req, url) {
  const cache = await caches.open(SHELL);
  const key = url.origin + url.pathname;                         // bỏ ?ratio=..., ?mau=...
  const saved = async () => (await cache.match(key))
    || (await cache.match(key.endsWith('/') ? key + 'index.html' : key.replace(/index\.html$/, '')));
  const net = fetch(req).then(res => {
    if (res.status === 200) cache.put(key, res.clone()).catch(() => {});
    return res;
  });
  const old = await saved();
  if (!old) return net;
  net.catch(() => {});
  return Promise.race([
    net.then(res => res.status === 200 ? res : old, () => old),
    new Promise(r => setTimeout(() => r(old), 4000)),
  ]);
}
