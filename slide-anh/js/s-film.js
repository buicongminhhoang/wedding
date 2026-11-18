/* Mẫu "Cuộn phim": dải phim 35mm trôi liên tục, hai dải mờ chạy ngược phía sau, vệt cháy sáng. */
(() => {
  SL.css(`
  .s-film .strip { position: absolute; background: #14100c; will-change: transform; }
  .s-film .cell { position: absolute; }
  .s-film .cell img { position: absolute; filter: sepia(.16) saturate(1.08) contrast(1.04); border-radius: .3cqmin; }
  .s-film .holes { position: absolute; background-color: #14100c; }
  .s-film .h .holes { left: 0; right: 0; height: var(--band);
    background-image: repeating-linear-gradient(90deg, transparent 0 calc(var(--u) * .9), #2e2419 calc(var(--u) * .9) calc(var(--u) * 2.1), transparent calc(var(--u) * 2.1) calc(var(--u) * 3));
    background-size: auto 46%; background-repeat: repeat-x; background-position: 0 50%; }
  .s-film .v .holes { top: 0; bottom: 0; width: var(--band);
    background-image: repeating-linear-gradient(180deg, transparent 0 calc(var(--u) * .9), #2e2419 calc(var(--u) * .9) calc(var(--u) * 2.1), transparent calc(var(--u) * 2.1) calc(var(--u) * 3));
    background-size: 46% auto; background-repeat: repeat-y; background-position: 50% 0; }
  .s-film .mark { position: absolute; font: 600 calc(var(--u) * .62)/1 Consolas, "Courier New", monospace; color: #e8a33d; letter-spacing: .12em; white-space: nowrap; opacity: .85; }
  .s-film .back { opacity: .3; filter: blur(.35cqmin); }
  .s-film .shade { position: absolute; inset: 0; pointer-events: none; }
  .s-film .leak { position: absolute; inset: -30%; pointer-events: none; mix-blend-mode: screen;
    background: radial-gradient(ellipse 30% 45% at 30% 40%, rgba(255,140,40,.5), transparent 70%), radial-gradient(ellipse 22% 50% at 72% 65%, rgba(255,70,50,.28), transparent 70%); }
  `);

  SL.register({
    id: 'film', name: 'Cuộn phim', bg: '#090705',
    desc: 'Dải phim 35mm trôi liên tục, tông ấm, vệt cháy sáng',
    async run(ctx) {
      const { W, H, land, root } = ctx;

      /** Một dải phim. size: bề dày dải, pos: vị trí theo trục ngang dải, dir: ±1, speed: px/giây. */
      function strip({ size, pos, dir, speed, cls, hero }) {
        const len = land ? W : H;                         // chiều dài nhìn thấy
        const band = size * .13, u = size * .052, gap = size * .035, inner = size - band * 2;
        const s = SL.el('div', `strip ${land ? 'h' : 'v'} ${cls || ''}`, root);
        s.style.setProperty('--band', band + 'px'); s.style.setProperty('--u', u + 'px');
        Object.assign(s.style, land ? { left: 0, top: pos + 'px', height: size + 'px', width: '1px' } : { top: 0, left: pos + 'px', width: size + 'px', height: '1px' });
        const cells = []; let off = dir < 0 ? 0 : len, end = 0, count = 0, busy = false;   // end: mép xa nhất đã lát

        async function add() {
          busy = true;
          const p = hero ? SL.next() : SL.pick(SL.pool());
          const img = await ctx.load(p, hero ? 'l' : 's');
          const L = (land ? inner * p.a : inner / p.a) + gap;
          const c = SL.el('div', 'cell', s);
          const at = dir < 0 ? end : -end - L;
          Object.assign(c.style, land ? { left: at + 'px', top: 0, width: L + 'px', height: size + 'px' } : { top: at + 'px', left: 0, height: L + 'px', width: size + 'px' });
          const h1 = SL.el('div', 'holes', c), h2 = SL.el('div', 'holes', c);
          Object.assign(h1.style, land ? { top: 0 } : { left: 0 }); Object.assign(h2.style, land ? { bottom: 0 } : { right: 0 });
          Object.assign(img.style, land ? { left: gap / 2 + 'px', top: band + 'px', height: inner + 'px', width: L - gap + 'px' } : { top: gap / 2 + 'px', left: band + 'px', width: inner + 'px', height: L - gap + 'px' });
          c.appendChild(img);
          if (hero) {
            const n = ++count, mk = (t, st) => { const e = SL.el('div', 'mark', c); e.textContent = t; Object.assign(e.style, st); };
            if (land) {
              mk(`${n}`, { left: gap + 'px', bottom: band * .08 + 'px' });
              mk(`▸ ${n}A`, { left: L * .5 + 'px', bottom: band * .08 + 'px' });
              mk('MH ♥ KN  400', { left: gap + 'px', top: band * .08 + 'px' });
            } else {
              mk(`${n}`, { top: gap + 'px', left: band * .1 + 'px', writingMode: 'vertical-rl' });
              mk('MH ♥ KN 400', { top: gap + 'px', right: band * .1 + 'px', writingMode: 'vertical-rl' });
            }
          }
          cells.push({ c, at, L }); end += L; busy = false;
        }
        ctx.raf((t, dt) => {
          off += dir * speed * rate * dt;
          s.style.transform = land ? `translate3d(${off}px,0,0)` : `translate3d(0,${off}px,0)`;
          const shown = dir < 0 ? -off : off - len;         // quãng đã trôi qua mép vào
          if (!busy && end - shown < len * 1.6) add().catch(() => {});
          const f = cells[0];
          if (f && (dir < 0 ? f.at + f.L + off < -len * .2 : f.at + off > len * 1.2)) { f.c.remove(); cells.shift(); }
        });
      }

      // Tốc độ trôi theo tempo: mỗi khung hình lướt qua trong một số nguyên ô nhịp
      let rate = 1;
      const base = ctx.dur / 1000 / 1.1;
      ctx.raf(() => {
        let want = 1;
        if (ctx.synced()) { const bar = ctx.beatMs() * 4 / 1000; want = base / (Math.max(1, Math.round(base * (1.3 - .65 * ctx.energy()) / bar)) * bar); }
        rate += (want - rate) * .02;
      });
      const main = (land ? H : W) * (land ? .56 : .6);
      const avg = land ? main * .74 * 1.15 : main * .74 / .85;
      const speed = avg / (ctx.dur / 1000) * 1.1;
      const side = (land ? H : W), small = side * .2;
      strip({ size: small, pos: side * .02, dir: 1, speed: speed * .45, cls: 'back' });
      strip({ size: small, pos: side * .78, dir: 1, speed: speed * .6, cls: 'back' });
      const wrap = SL.el('div', '', root, { position: 'absolute', inset: 0 });
      root.appendChild(wrap);
      strip({ size: main, pos: (side - main) / 2, dir: -1, speed, hero: true });
      root.style.transform = land ? 'rotate(-2.2deg) scale(1.08)' : 'rotate(1.6deg) scale(1.06)';

      const shade = SL.el('div', 'shade', root);
      shade.style.background = `linear-gradient(${land ? 90 : 180}deg, rgba(0,0,0,.8), transparent 22% 78%, rgba(0,0,0,.8))`;
      const leak = SL.el('div', 'leak', root);
      leak.animate([
        { transform: 'translate(-30%, 5%) rotate(0deg)', opacity: 0 }, { opacity: .9, offset: .3 },
        { opacity: .5, offset: .6 }, { transform: 'translate(35%, -8%) rotate(25deg)', opacity: 0 },
      ], { duration: 19000, iterations: Infinity, easing: 'ease-in-out' });
      await new Promise(() => {});
    },
  });
})();
