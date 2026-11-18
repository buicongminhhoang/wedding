/* Mẫu "Polaroid": ảnh lấy liền thả từng tấm lên mặt bàn, có băng dính và chữ viết tay. */
(() => {
  SL.css(`
  .s-pola { background: radial-gradient(ellipse at 50% 40%, #3a2f26, #17120e 75%) !important; }
  .s-pola .p { position: absolute; background: #f7f2e8; box-shadow: 0 2.4cqmin 5cqmin rgba(0,0,0,.55), 0 .3cqmin .8cqmin rgba(0,0,0,.4); will-change: transform; }
  .s-pola .p img { position: absolute; background: #ccc; }
  .s-pola .p .cap { position: absolute; left: 0; right: 0; text-align: center; font-family: "Dancing Script", cursive; font-weight: 600; color: #3b332c; white-space: nowrap; overflow: hidden; }
  .s-pola .p::before { content: ""; position: absolute; left: 50%; top: -3.5%; width: 26%; height: 7%; translate: -50% 0; rotate: var(--tape);
    background: rgba(240, 222, 170, .62); box-shadow: 0 .2cqmin .5cqmin rgba(0,0,0,.2); }
  `);

  SL.register({
    id: 'pola', name: 'Polaroid',
    desc: 'Ảnh lấy liền thả từng tấm lên bàn, băng dính, chữ viết tay',
    async run(ctx) {
      const { W, H, root } = ctx;
      const cols = ctx.ar > 1.15 ? 3 : 2, rows = ctx.ar > 1.15 ? 2 : (ctx.ar > .85 ? 2 : 3);
      const top = H * .02, cw = W / cols, chh = (H * .9 - top) / rows;
      const slots = SL.shuffle([...Array(cols * rows).keys()]).map(i => ({ c: i % cols, r: (i / cols) | 0, node: null }));
      let z = 1, k = 0;

      const pre = async () => { const p = SL.next(); return { p, img: await ctx.load(p, 's') }; };
      async function drop(slot, quick, job) {
        const { p, img } = job || await pre();
        const pad = Math.min(cw, chh) * .04, foot = pad * 3.4;
        const s = SL.contain(p.a, cw * .84 - pad * 2, chh * .92 - pad - foot);
        const w = s.w + pad * 2, h = s.h + pad + foot;
        const x = slot.c * cw + (cw - w) / 2 + SL.rnd(-.05, .05) * cw;
        const y = top + slot.r * chh + (chh - h) / 2 + SL.rnd(-.03, .03) * chh;
        const rot = SL.rnd(-7, 7);
        if (slot.node) {                                      // tấm cũ trượt khỏi bàn
          const old = slot.node, side = slot.c < cols / 2 ? -1 : 1;
          old.animate({ transform: [old.style.transform, `translate(${side * W * .12}px, ${H * .25}px) rotate(${rot + side * 25}deg)`], opacity: [1, 0] },
            { duration: 700, fill: 'both', easing: 'cubic-bezier(.5,0,.9,.4)' }).finished.then(() => old.remove());
          await ctx.wait(350);
        }
        const n = SL.el('div', 'p', root, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', zIndex: ++z });
        n.style.setProperty('--tape', SL.rnd(-8, 8) + 'deg');
        Object.assign(img.style, { left: pad + 'px', top: pad + 'px', width: s.w + 'px', height: s.h + 'px' });
        n.appendChild(img);
        const cap = SL.el('div', 'cap', n, { bottom: foot * .14 + 'px', fontSize: foot * .5 + 'px', lineHeight: foot * .72 + 'px' });
        cap.textContent = k++ % 3 === 2 ? SL.cfg.date.replace(/\s/g, '') : SL.word();
        cap.style.fontSize = Math.min(foot * .5, w * 1.9 / cap.textContent.length) + 'px';
        n.style.transform = `rotate(${rot}deg)`;
        n.animate([
          { transform: `translate(${SL.rnd(-.1, .1) * W}px, ${-H * .35}px) scale(1.7) rotate(${rot + SL.rnd(-30, 30)}deg)`, opacity: 0 },
          { opacity: 1, offset: .35 },
          { transform: `rotate(${rot}deg)`, opacity: 1 },
        ], { duration: quick ? 800 : 1100, fill: 'both', easing: 'cubic-bezier(.2,1.25,.35,1)' });
        slot.node = n;
        // chữ viết tay hiện dần từ trái sang trong hai phách sau khi ảnh chạm bàn
        cap.animate({ clipPath: ['inset(0 100% 0 0)', 'inset(0 0 0 0)'] }, { duration: ctx.beatMs() * 2, delay: quick ? 700 : 1000, fill: 'both', easing: 'ease-in-out' });
      }

      for (const s of slots) { await drop(s, true); await ctx.wait(350); }
      const gap = Math.max(1600, ctx.dur / 2.2);
      for (let i = 0; ; i++) {
        const t = performance.now(), slot = slots[i % slots.length], job = await pre();
        await ctx.hold(Math.max(600, gap - (performance.now() - t)), (slot.node ? 350 : 0) + 950);   // ảnh chạm bàn đúng nhịp
        await drop(slot, false, job);
      }
    },
  });
})();
