/* Mẫu "Ngân hà ký ức": ảnh bay ra từ sâu trong trời sao, dừng lại bên tên cô dâu chú rể rồi lướt qua. */
(() => {
  SL.css(`
  .s-galaxy { perspective: 130cqmin; }
  .s-galaxy canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
  .s-galaxy .title { position: absolute; display: grid; place-content: center; justify-items: center; text-align: center; color: #dfe4ff; }
  .s-galaxy .title small { font: 500 1.9cqmin/1 "Cormorant Garamond", serif; letter-spacing: .5em; text-indent: .5em; text-transform: uppercase; }
  .s-galaxy .title b { font: 400 1em/1.2 "Pinyon Script", cursive; white-space: nowrap; padding: 0 .2em;
    filter: drop-shadow(0 0 .08em rgba(196,208,255,.6)) drop-shadow(0 0 .35em rgba(110,130,255,.35)); }
  .s-galaxy .title i { font: italic 500 .42em/1 "Cormorant Garamond", serif; opacity: .8; }
  .s-galaxy .card { position: absolute; will-change: transform, opacity; border: .35cqmin solid rgba(255,255,255,.92);
    box-shadow: 0 0 5cqmin rgba(150,170,255,.35), 0 2cqmin 5cqmin rgba(0,0,0,.6); background: #111; }
  .s-galaxy .card img { width: 100%; height: 100%; }
  `);

  SL.register({
    id: 'galaxy', name: 'Ngân hà ký ức', sig: false, grain: false,
    desc: 'Ảnh bay ra từ trời sao, dừng bên tên hai bạn rồi lướt qua',
    async run(ctx) {
      const { W, H, v, land, root } = ctx;

      // Trời sao lao chậm về phía người xem
      const cv = SL.el('canvas', '', root), dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = W * dpr; cv.height = H * dpr;
      const g = cv.getContext('2d');
      const stars = Array.from({ length: 700 }, () => ({ x: SL.rnd(-1, 1), y: SL.rnd(-1, 1), z: SL.rnd(.05, 1), s: SL.rnd(.6, 1.8), ph: SL.rnd(6.28), tw: SL.rnd(.5, 2.5) }));
      ctx.raf((t, dt) => {
        g.clearRect(0, 0, cv.width, cv.height);
        g.fillStyle = '#dfe6ff';
        const R = Math.max(cv.width, cv.height) * .62;
        for (const s of stars) {
          s.z -= dt * .022; if (s.z < .05) { s.z = 1; s.x = SL.rnd(-1, 1); s.y = SL.rnd(-1, 1); }
          const x = cv.width / 2 + s.x / s.z * R * .5, y = cv.height / 2 + s.y / s.z * R * .5;
          if (x < 0 || x > cv.width || y < 0 || y > cv.height) { s.z = 1; continue; }
          const px = s.s * dpr * (1.6 - s.z) * (W / 1300 + .5);
          g.globalAlpha = Math.min(1, (1 - s.z) * 3) * (.55 + .45 * Math.sin(t * s.tw + s.ph));
          g.fillRect(x - px / 2, y - px / 2, px, px);
        }
      });

      const title = SL.el('div', 'title', root, land
        ? { left: '34%', width: '32%', top: 0, bottom: 0, fontSize: Math.min(7.4 * v, W * .058) + 'px' }
        : { left: 0, right: 0, top: '41%', height: '18%', fontSize: Math.min(9 * v, H * .05) + 'px' });
      title.innerHTML = land ? '<small>Lễ Thành Hôn</small><b></b><i>&amp;</i><b></b><small></small>' : '<b></b><small></small>';
      const bs = title.querySelectorAll('b');
      if (land) { bs[0].textContent = SL.cfg.n1; bs[1].textContent = SL.cfg.n2; bs[0].style.marginTop = '.5em'; bs[1].style.marginBottom = '.4em'; }
      else bs[0].textContent = SL.names();
      title.querySelector('small:last-child').textContent = SL.cfg.date;
      title.animate({ opacity: [0, 1] }, { duration: 2500, fill: 'both' });
      // tên hai bạn sáng lên theo đầu mỗi ô nhịp
      ctx.onBeat((n, e) => { if (n === 0) title.animate({ filter: [`brightness(${1.25 + e * .5})`, 'brightness(1)'], scale: [1 + .02 * e, 1] }, { duration: ctx.beatMs() * 2, easing: 'ease-out' }); });

      // Hai vị trí dừng: trái/phải (màn ngang) hoặc trên/dưới (màn dọc)
      const slots = land
        ? [{ x: W * .175, y: H * .5, mw: W * .3, mh: H * .78 }, { x: W * .825, y: H * .5, mw: W * .3, mh: H * .78 }]
        : [{ x: W * .5, y: H * .215, mw: W * .86, mh: H * .36 }, { x: W * .5, y: H * .785, mw: W * .86, mh: H * .36 }];
      const life = ctx.dur * 1.9;
      for (let i = 0; ; i++) {
        const sl = slots[i % 2];
        const t0 = performance.now();
        const p = SL.next(q => SL.loss(q.a, sl.mw / sl.mh) < .5);
        const img = await ctx.load(p);
        if (i) await ctx.hold(Math.max(300, life / 2 - (performance.now() - t0)), life * .2);   // ảnh tới nơi đúng đầu ô nhịp
        const s = SL.contain(p.a, sl.mw, sl.mh);
        const card = SL.el('div', 'card', root, { left: sl.x - s.w / 2 + 'px', top: sl.y - s.h / 2 + 'px', width: s.w + 'px', height: s.h + 'px', boxSizing: 'content-box' });
        card.appendChild(img);
        const dx = (sl.x - W / 2) * 1.4, dy = (sl.y - H / 2) * 1.4, r = SL.rnd(-3, 3), tilt = land ? (i % 2 ? -1 : 1) * 9 : 0;
        card.animate([
          { transform: `translate3d(${-dx * .9}px,${-dy * .9}px,${-320 * v}px) rotateY(${tilt * 3}deg) rotate(${r * 4}deg)`, opacity: 0, easing: 'cubic-bezier(.1,.7,.2,1)' },
          { transform: `translate3d(0,0,${-4 * v}px) rotateY(${tilt}deg) rotate(${r}deg)`, opacity: 1, offset: .2, easing: 'linear' },
          { transform: `translate3d(0,0,${6 * v}px) rotateY(${tilt * .4}deg) rotate(${r * .5}deg)`, opacity: 1, offset: .82, easing: 'cubic-bezier(.6,0,.9,.4)' },
          { transform: `translate3d(${dx}px,${dy}px,${95 * v}px) rotateY(${-tilt}deg) rotate(${-r * 2}deg)`, opacity: 0 },
        ], { duration: life, fill: 'both' }).finished.then(() => card.remove(), () => {});
      }
    },
  });
})();
