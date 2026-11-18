/* Mẫu "Tạp chí": bố cục biên tập, ảnh không bị cắt, chữ serif lớn, mở ảnh bằng mặt nạ trượt. */
(() => {
  SL.css(`
  .s-mag { color: #1c1815; }
  .s-mag .ghost { position: absolute; font: 900 62cqmin/.8 "Playfair Display", serif; color: rgba(28,24,21,.055); letter-spacing: -.04em; }
  .s-mag .ph { position: absolute; overflow: hidden; background: #d9d1c4; }
  .s-mag .ph img { width: 100%; height: 100%; }
  .s-mag .tx { position: absolute; display: flex; flex-direction: column; justify-content: center; gap: 2.2cqmin; }
  .s-mag .ln { overflow: hidden; }
  .s-mag .ln > * { display: block; }
  .s-mag .no { font: 500 2cqmin/1 "Cormorant Garamond", serif; letter-spacing: .5em; text-transform: uppercase; display: flex; align-items: center; gap: 2cqmin; }
  .s-mag .no::after { content: ""; flex: 1; height: 1px; background: currentColor; opacity: .5; }
  .s-mag .hd { font: italic 500 1em/1.08 "Playfair Display", serif; letter-spacing: -.01em; padding-bottom: .12em; }
  .s-mag .nm { font: 400 5.4cqmin/1.15 "Pinyon Script", cursive; padding: .1em .1em .2em 0; color: #7a2a2a; }
  .s-mag .dt { font: 500 1.9cqmin/1 "Cormorant Garamond", serif; letter-spacing: .5em; text-transform: uppercase; opacity: .8; }
  `);

  SL.register({
    id: 'mag', name: 'Tạp chí', bg: '#efe9df', sig: false,
    desc: 'Bố cục tạp chí trên nền giấy ngà, ảnh giữ nguyên khung, chữ serif lớn',
    async run(ctx) {
      const { W, H, v, land, root } = ctx;
      const m = 6 * v;
      let n = 0, prev = null;
      let pending = SL.next(), img = await ctx.load(pending);

      for (;;) {
        const p = pending, flip = n % 2 === 1;
        const box = SL.el('div', '', root, { position: 'absolute', inset: 0 });
        const num = String(++n).padStart(2, '0');
        let pr, tr;                                                   // khung ảnh, khung chữ
        if (land) {
          const s = SL.contain(p.a, W * (p.a < 1 ? .5 : .62) - m, H - 2 * m);
          pr = { x: flip ? W - m - s.w : m, y: (H - s.h) / 2, ...s };
          tr = { x: flip ? m : pr.x + s.w + m, y: m, w: W - s.w - 3 * m, h: H - 2 * m };
        } else {
          const s = SL.contain(p.a, W - 2 * m, H * .6);
          pr = { x: (W - s.w) / 2, y: flip ? H - m - s.h : m, ...s };
          tr = { x: m, y: flip ? m : pr.y + s.h + m * .6, w: W - 2 * m, h: H - s.h - 2.6 * m };
        }
        const ghost = SL.el('div', 'ghost', box); ghost.textContent = num;
        Object.assign(ghost.style, land
          ? { [flip ? 'left' : 'right']: '-2cqmin', bottom: '-6cqmin' }
          : { right: '-2cqmin', [flip ? 'top' : 'bottom']: '-4cqmin' });
        const ph = SL.el('div', 'ph', box, { left: pr.x + 'px', top: pr.y + 'px', width: pr.w + 'px', height: pr.h + 'px' });
        ph.appendChild(img);
        const tx = SL.el('div', 'tx', box, { left: tr.x + 'px', top: tr.y + 'px', width: tr.w + 'px', height: tr.h + 'px' });
        const line = (cls, text) => { const l = SL.el('div', 'ln', tx); const s = SL.el('span', cls, l); s.textContent = text; return s; };
        const lines = [line('no', `No. ${num}`)];
        const hd = line('hd', ''), headline = SL.word();
        hd.parentNode.style.overflow = 'visible';
        hd.style.fontSize = Math.min(tr.w * .17, (land ? 11 : 8.5) * v) + 'px';
        const nm = line('nm', SL.names());
        nm.style.whiteSpace = 'nowrap';
        nm.style.fontSize = Math.min(5.4 * v, tr.w / (SL.names().length * .48)) + 'px';
        lines.push(hd, nm, line('dt', SL.cfg.date));

        // Vào: ảnh mở bằng mặt nạ trượt, hình bên trong thu dần; chữ trồi lên từng dòng
        const from = land ? (flip ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)') : (flip ? 'inset(100% 0 0 0)' : 'inset(0 0 100% 0)');
        ctx.anim(ph, { clipPath: [from, 'inset(0 0 0 0)'] }, { duration: 1500, easing: 'cubic-bezier(.7,0,.15,1)' });
        img.animate({ transform: ['scale(1.35)', 'scale(1.06)', 'scale(1)'], offset: [0, .25, 1] }, { duration: ctx.dur + 2500, fill: 'both', easing: 'cubic-bezier(.2,.6,.2,1)' });
        ghost.animate({ opacity: [0, 1], transform: [`translateX(${flip ? -4 : 4}%)`, 'none'] }, { duration: 2000, fill: 'both', easing: 'ease-out' });
        // Chữ vào theo phách: số thứ tự ở phách 1, câu đề mỗi phách một từ, rồi tên và ngày
        const bm = ctx.beatMs(), after = ctx.caption(headline, hd, bm);
        [lines[0], lines[2], lines[3]].forEach((l, i) => l.animate({ transform: ['translateY(115%)', 'none'] },
          { duration: Math.max(500, bm * 1.6), delay: i ? after + (i - 1) * bm : 0, fill: 'both', easing: 'cubic-bezier(.2,.8,.2,1)' }));
        if (prev) { const old = prev; ctx.wait(100).then(() => old.remove(), () => {}); }

        const t = performance.now();
        pending = SL.next(); img = await ctx.load(pending);
        await ctx.hold(Math.max(500, ctx.dur - (performance.now() - t)), 900);   // ảnh mới mở đúng đầu ô nhịp

        // Ra: mặt nạ khép về phía đối diện, chữ lặn xuống
        const to = land ? (flip ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)') : (flip ? 'inset(0 0 100% 0)' : 'inset(100% 0 0 0)');
        lines.forEach((l, i) => l.animate({ transform: ['none', 'translateY(-115%)'] }, { duration: 600, delay: i * 60, fill: 'both', easing: 'cubic-bezier(.6,0,.8,.2)' }));
        ghost.animate({ opacity: [1, 0] }, { duration: 800, fill: 'both' });
        await ctx.anim(ph, { clipPath: ['inset(0 0 0 0)', to] }, { duration: 900, easing: 'cubic-bezier(.7,0,.2,1)' });
        prev = box;
      }
    },
  });
})();
