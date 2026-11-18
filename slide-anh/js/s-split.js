/* Mẫu "Chia khung": màn hình chia nhiều dải, mỗi dải trượt vào so le có chiều sâu. */
(() => {
  SL.css(`
  .s-split .sc { position: absolute; inset: 0; will-change: transform; }
  .s-split .pn { position: absolute; overflow: hidden; will-change: transform; }
  .s-split .pn > div { position: absolute; inset: 0; will-change: transform; }
  .s-split .bd { position: absolute; inset: -6%; filter: blur(3cqmin) brightness(.4) saturate(1.2); }
  .s-split .bd img { width: 100%; height: 100%; object-fit: cover; }
  `);

  SL.register({
    id: 'split', name: 'Chia khung',
    desc: 'Màn hình chia nhiều dải, mỗi dải trượt vào so le có chiều sâu',
    async run(ctx) {
      const { W, H, v, land, root } = ctx;
      let prev = null, n = 0;
      const cap = SL.el('div', 'cap-b', root, { zIndex: 50 });

      async function build() {
        const g = SL.group(ctx.ar), imgs = await Promise.all(g.photos.map(p => ctx.load(p)));
        const sc = SL.el('div', 'sc'), panels = [];
        const vertical = g.dir === 'rows' || (g.dir !== 'cols' && !land);      // các dải xếp chồng theo chiều dọc
        const panel = (rect, img, ir) => {
          const pn = SL.el('div', 'pn', sc, { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' });
          const inner = SL.el('div', '', pn);
          inner.appendChild(SL.place(img, ir));
          panels.push({ pn, inner });
        };
        if (g.dir === 'full' || g.dir === 'fit') {
          const p = g.photos[0];
          let area = { x: 0, y: 0, w: W, h: H };
          if (g.dir === 'fit') {
            const bd = SL.el('div', 'bd', sc); bd.appendChild(await ctx.load(p, 's'));
            bd.firstChild.style.objectPosition = `${p.fx * 100}% ${p.fy * 100}%`;
            sc.bd = bd;
            const c = SL.contain(p.a, W * .94, H * .94);
            area = { x: (W - c.w) / 2, y: (H - c.h) / 2, ...c };
          }
          const k = g.dir === 'fit' ? 3 : (vertical ? 4 : 5), r = SL.cover(p, area.w, area.h);
          for (let i = 0; i < k; i++) {                        // cùng một ảnh, cắt thành k dải
            const rect = vertical
              ? { x: area.x, y: area.y + Math.round(i * area.h / k), w: area.w, h: Math.round((i + 1) * area.h / k) - Math.round(i * area.h / k) }
              : { x: area.x + Math.round(i * area.w / k), y: area.y, w: Math.round((i + 1) * area.w / k) - Math.round(i * area.w / k), h: area.h };
            const im = i ? imgs[0].cloneNode() : imgs[0];
            panel(rect, im, { ...r, x: r.x - (rect.x - area.x), y: r.y - (rect.y - area.y) });
          }
        } else {
          const k = g.photos.length, gap = .45 * v;
          g.photos.forEach((p, i) => {
            const rect = vertical
              ? { x: 0, y: i * (H + gap) / k, w: W, h: (H + gap) / k - gap }
              : { x: i * (W + gap) / k, y: 0, w: (W + gap) / k - gap, h: H };
            panel(rect, imgs[i], SL.cover(p, rect.w, rect.h, 1.06));
          });
        }
        return { sc, panels, vertical };
      }

      let nextScene = build();
      for (;;) {
        const { sc, panels, vertical } = await nextScene;
        root.insertBefore(sc, cap);
        const ax = vertical ? 'X' : 'Y', flipAll = n++ % 2 ? -1 : 1;
        if (sc.bd) sc.bd.animate({ opacity: [0, 1] }, { duration: 1200, fill: 'both' });
        const done = panels.map(({ pn, inner }, i) => {
          const s = (i % 2 ? -1 : 1) * flipAll, o = { duration: 1350, delay: i * 120, easing: 'cubic-bezier(.75,0,.2,1)' };
          inner.animate({ transform: [`translate${ax}(${-62 * s}%) scale(1.25)`, 'none'] }, { ...o, fill: 'both' });
          return ctx.anim(pn, { transform: [`translate${ax}(${101 * s}%)`, 'none'] }, o);
        });
        sc.animate({ transform: ['scale(1)', 'scale(1.045)'] }, { duration: ctx.dur + 4000, fill: 'both', easing: 'linear' });
        cap.animate({ opacity: [1, 0] }, { duration: 500, fill: 'forwards' });
        ctx.wait(750).then(() => ctx.caption(SL.word(), cap), () => {});
        await Promise.all(done);
        if (prev) prev.remove();
        prev = sc;
        const t = performance.now();
        nextScene = build();
        await nextScene;
        await ctx.hold(Math.max(400, ctx.dur - (performance.now() - t)), 750);   // dải ảnh khép đúng đầu ô nhịp
      }
    },
  });
})();
