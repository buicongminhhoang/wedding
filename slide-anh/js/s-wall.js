/* Mẫu "Phòng tranh": ảnh lồng khung treo tường, máy quay lướt từ bức này sang bức kia. */
(() => {
  SL.css(`
  .s-wall { background: linear-gradient(#35302b 0 78%, #14110f 78% 79%, #221d19 79%) !important; perspective: 160cqmin; }
  .s-wall .cam, .s-wall .track { position: absolute; inset: 0; transform-style: preserve-3d; will-change: transform; }
  .s-wall .fr { position: absolute; background: #f4efe6; border: 1.1cqmin solid #1d1510;
    outline: .18cqmin solid #b9975b; outline-offset: -.5cqmin;
    box-shadow: 0 3cqmin 5cqmin rgba(0,0,0,.6), inset 0 0 1.4cqmin rgba(0,0,0,.25); }
  .s-wall .fr img { position: absolute; box-shadow: inset 0 0 0 1px rgba(0,0,0,.3); }
  .s-wall .lamp { position: absolute; pointer-events: none; background: radial-gradient(ellipse 50% 60% at 50% 0%, rgba(255,232,190,.3), transparent 70%); }
  .s-wall .tag { position: absolute; text-align: center; font: 500 1.7cqmin/1.5 "Cormorant Garamond", serif; letter-spacing: .3em; text-transform: uppercase; color: #cdb98f; white-space: nowrap; }
  .s-wall .tag i { display: block; font: italic 400 2.3cqmin/1.3 "Cormorant Garamond", serif; letter-spacing: .02em; text-transform: none; color: #e9dfcb; }
  `);

  SL.register({
    id: 'wall', name: 'Phòng tranh',
    desc: 'Ảnh lồng khung treo tường, đèn rọi, máy quay lướt qua từng bức',
    async run(ctx) {
      const { W, H, v, root } = ctx;
      const cam = SL.el('div', 'cam', root), track = SL.el('div', 'track', cam);
      const cy = H * .42, mat = 2.6 * v, gap = W * .14;
      let cells = [], edge = 0, n = 0, tx = 0;

      async function add() {
        const p = SL.next();
        const img = await ctx.load(p);
        const s = SL.contain(p.a, W * .66, H * .52), w = s.w + mat * 2, h = s.h + mat * 2;
        const x = edge + gap;
        SL.el('div', 'lamp', track, { left: x - w * .35 + 'px', top: cy - h / 2 - 12 * v + 'px', width: w * 1.7 + 'px', height: h + 30 * v + 'px' });
        const fr = SL.el('div', 'fr', track, { left: x + 'px', top: cy - h / 2 + 'px', width: w + 'px', height: h + 'px', boxSizing: 'content-box' });
        Object.assign(img.style, { left: mat + 'px', top: mat + 'px', width: s.w + 'px', height: s.h + 'px' });
        fr.appendChild(img);
        const tag = SL.el('div', 'tag', track, { left: x - w + 'px', width: w * 3 + 2.2 * v + 'px', top: cy + h / 2 + 4.5 * v + 'px' });
        tag.innerHTML = `No. ${String(++n).padStart(2, '0')}<i></i>`;
        tag.lastChild.innerHTML = '&nbsp;';
        const full = w + 2.2 * v;
        cells.push({ x, w: full, mid: x + full / 2, nodes: [...track.children].slice(-3), tag: tag.lastChild });
        edge = x + full;
      }
      const target = c => W / 2 - c.mid;

      await add(); await add(); await add();
      let i = 0;
      tx = target(cells[0]);
      track.style.transform = `translate3d(${tx}px,0,0)`;
      ctx.caption(SL.word(), cells[0].tag, 900);
      for (;;) {
        const t = performance.now();
        if (cells.length - i < 3) await add();
        await ctx.hold(Math.max(400, ctx.dur - (performance.now() - t)), 1500);  // máy quay dừng trước bức mới đúng đầu ô nhịp
        i++;
        const to = target(cells[i]), dir = 1;
        cam.animate({ transform: ['none', `translate3d(0,0,-${14 * v}px) rotateY(${-5 * dir}deg)`, 'none'] }, { duration: 2400, easing: 'cubic-bezier(.5,0,.3,1)' });
        await ctx.anim(track, { transform: [`translate3d(${tx}px,0,0)`, `translate3d(${to}px,0,0)`] }, { duration: 2400, easing: 'cubic-bezier(.6,0,.2,1)' });
        tx = to;
        ctx.caption(SL.word(), cells[i].tag);
        while (i > 1) {                                   // dọn các bức đã đi qua và dời gốc tọa độ
          const old = cells.shift(); old.nodes.forEach(nd => nd.remove()); i--;
        }
        const base = cells[0].x - gap;
        if (base > W * 4) {
          for (const c of cells) { c.x -= base; c.mid -= base; }
          for (const nd of track.children) nd.style.left = parseFloat(nd.style.left) - base + 'px';
          edge -= base; tx += base;
          track.getAnimations().forEach(a => a.cancel());
          track.style.transform = `translate3d(${tx}px,0,0)`;
        }
      }
    },
  });
})();
