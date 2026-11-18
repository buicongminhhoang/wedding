/* Mẫu "Khảm lưới": bức tường ảnh nhiều cỡ ô, từng ô tự lật hoặc quét sang ảnh mới. */
(() => {
  SL.css(`
  .s-grid { perspective: 220cqmin; }
  .s-grid .t { position: absolute; overflow: hidden; background: #111; will-change: transform; backface-visibility: hidden; }
  .s-grid .t > div { position: absolute; inset: 0; overflow: hidden; }
  `);
  // Ô: [cột, hàng, rộng, cao] trên lưới 4x4 (cho màn ngang; màn dọc thì hoán vị cột/hàng)
  const LAYOUTS = [
    [[0, 0, 2, 2], [2, 0, 1, 2], [3, 0, 1, 1], [3, 1, 1, 1], [0, 2, 1, 2], [1, 2, 1, 1], [1, 3, 1, 1], [2, 2, 2, 2]],
    [[0, 0, 1, 2], [1, 0, 2, 2], [3, 0, 1, 1], [3, 1, 1, 2], [0, 2, 1, 1], [0, 3, 1, 1], [1, 2, 1, 1], [2, 2, 1, 1], [1, 3, 1, 1], [2, 3, 1, 1], [3, 3, 1, 1]],
    [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 2, 2], [0, 1, 1, 2], [1, 1, 1, 1], [1, 2, 1, 2], [0, 3, 1, 1], [2, 2, 1, 2], [3, 2, 1, 1], [3, 3, 1, 1]],
  ];

  SL.register({
    id: 'grid', name: 'Khảm lưới',
    desc: 'Tường ảnh nhiều cỡ ô, từng ô tự lật hoặc quét sang ảnh mới',
    async run(ctx) {
      const { W, H, v, land, root } = ctx;
      const g = .7 * v, cw = (W - g * 5) / 4, chh = (H - g * 5) / 4, mirror = Math.random() < .5;
      const tiles = SL.pick(LAYOUTS).map(([c, r, w, h]) => {
        if (!land) [c, r, w, h] = [r, c, h, w];
        if (mirror) c = 4 - c - w;
        const rect = { x: g + c * (cw + g), y: g + r * (chh + g), w: w * cw + (w - 1) * g, h: h * chh + (h - 1) * g };
        const node = SL.el('div', 't', root, { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' });
        return { ...rect, node, big: w * h >= 4, ar: rect.w / rect.h };
      });

      const pre = async t => { const p = SL.next(q => SL.loss(q.a, t.ar) < .2); return { p, img: await ctx.load(p, t.big ? 'l' : 's') }; };
      async function fill(t, mode, job) {
        const { p, img } = job || await pre(t);
        const layer = SL.el('div', '');
        layer.appendChild(SL.place(img, SL.cover(p, t.w, t.h, 1.1)));
        img.animate({ transform: ['scale(1)', 'scale(.92)'] }, { duration: 22000, fill: 'both', easing: 'linear' });
        const old = [...t.node.children];
        if (mode === 'flip') {
          const ax = Math.random() < .5 ? 'Y' : 'X';
          await ctx.anim(t.node, { transform: ['none', `rotate${ax}(90deg)`] }, { duration: 480, easing: 'cubic-bezier(.6,0,1,.6)' });
          old.forEach(o => o.remove()); t.node.appendChild(layer);
          await ctx.anim(t.node, { transform: [`rotate${ax}(-90deg)`, 'none'] }, { duration: 560, easing: 'cubic-bezier(0,.4,.3,1)' });
        } else {
          t.node.appendChild(layer);
          const from = mode === 'fade' ? 'inset(0 0 0 0)' : SL.pick(['inset(0 100% 0 0)', 'inset(0 0 0 100%)', 'inset(100% 0 0 0)', 'inset(0 0 100% 0)']);
          img.animate({ scale: [1.25, 1] }, { duration: 1500, easing: 'cubic-bezier(.2,.7,.2,1)' });
          await ctx.anim(layer, { clipPath: [from, 'inset(0 0 0 0)'], opacity: [mode === 'fade' ? 0 : 1, 1] }, { duration: 1100, easing: 'cubic-bezier(.7,0,.2,1)' });
          old.forEach(o => o.remove());
        }
      }

      await Promise.all(tiles.map((t, i) => ctx.wait(i * 110).then(() => fill(t, 'fade'))));
      const gap = Math.max(1300, ctx.dur / 3);
      let order = [];
      for (let n = 0; ; n++) {
        const t0 = performance.now();
        if (!order.length) order = SL.shuffle([...tiles]);
        const t = order.pop(), mode = !t.big && n % 3 === 1 ? 'flip' : 'wipe', job = await pre(t);
        await ctx.hold(Math.max(400, gap - (performance.now() - t0)), mode === 'flip' ? 480 : 0, 4);   // mỗi ô đổi đúng một phách
        fill(t, mode, job).catch(() => {});
      }
    },
  });
})();
