/* Mẫu "Điện ảnh": ảnh tràn khung, lia máy chậm, chuyển cảnh bằng shader WebGL. */
(() => {
  const VERT = `attribute vec2 pos; varying vec2 uv; void main(){ uv = pos * .5 + .5; gl_Position = vec4(pos, 0., 1.); }`;
  const FRAG = `
  precision highp float;
  varying vec2 uv;
  uniform sampler2D A, B;
  uniform float p, seed, fade;
  uniform int fx;
  uniform vec3 ka, kb;        // zoom, panX, panY
  uniform vec2 res;
  const float PI = 3.14159265;

  float hash(vec2 q){ return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 q){
    vec2 i = floor(q), f = fract(q); f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
  }
  float fbm(vec2 q){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a * noise(q); q *= 2.03; a *= .5; } return v; }
  vec3 ta(vec2 u){ return texture2D(A, (u - .5) / ka.x + .5 + ka.yz).rgb; }
  vec3 tb(vec2 u){ return texture2D(B, (u - .5) / kb.x + .5 + kb.yz).rgb; }

  void main(){
    vec3 col;
    float bell = sin(p * PI);
    if (fx == 0) {                                   // dòng chảy: hai ảnh tan vào nhau như chất lỏng
      vec2 d = vec2(fbm(uv * 3. + seed), fbm(uv * 3. + seed + 7.3)) - .5;
      float m = smoothstep(.15, .85, p + d.x * .7 * bell);
      col = mix(ta(uv + d * p * .32), tb(uv - d * (1. - p) * .32), m);
    } else if (fx == 1) {                            // cháy sáng: vệt nắng quét chéo
      float s = uv.x * .7 + (1. - uv.y) * .3 + (fbm(uv * 2.5 + seed) - .5) * .45;
      float edge = p * 1.7 - .35;
      col = mix(tb(uv), ta(uv), smoothstep(edge - .14, edge + .14, s));
      float glow = exp(-pow((s - edge) / .2, 2.));
      col += vec3(1., .58, .22) * glow * .85 * bell;
    } else if (fx == 2) {                            // lao ống kính: nhòe hướng tâm
      vec2 c = uv - .5; vec3 acc = vec3(0.);
      float m = smoothstep(.3, .7, p);
      for (int i = 0; i < 14; i++) {
        float sc = 1. - bell * .34 * float(i) / 13.;
        acc += mix(ta(.5 + c * sc), tb(.5 + c * sc), m);
      }
      col = acc / 14. * (1. + bell * .45);
    } else if (fx == 3) {                            // gợn nước lan từ tâm
      vec2 c = (uv - .5) * vec2(res.x / res.y, 1.);
      float d = length(c);
      vec2 o = normalize(c + 1e-5) * sin(d * 30. - p * 16.) * .018 * bell;
      float front = p * 1.5 - .2;
      col = mix(tb(uv + o), ta(uv + o), smoothstep(front - .22, front, d));
    } else if (fx == 4) {                            // loang mực
      float n = fbm(uv * 3.5 + seed) * .75 + fbm(uv * 13. + seed) * .25;
      float t = p * 1.3 - .15;
      float m = smoothstep(t - .05, t + .05, n);
      col = mix(tb(uv), ta(uv), m);
      col *= 1. - .5 * (1. - abs(m * 2. - 1.)) * bell;
    } else {                                         // lăng kính: tách ba màu rồi nhập lại
      float e = smoothstep(0., 1., p);
      vec2 sh = vec2(bell * .045, 0.);
      vec2 u = uv + vec2((fbm(vec2(uv.y * 6., seed)) - .5) * .05 * bell, 0.);
      col.r = mix(ta(u + sh).r, tb(u + sh).r, e);
      col.g = mix(ta(u).g, tb(u).g, e);
      col.b = mix(ta(u - sh).b, tb(u - sh).b, e);
    }
    float v = length((uv - .5) * 1.25);
    col *= 1. - .42 * pow(v, 2.6);                   // tối góc
    gl_FragColor = vec4(col * fade, 1.);
  }`;

  const TR = 1900;                                   // thời lượng chuyển cảnh (ms)

  /** Bộ vẽ WebGL. Trả về null nếu trình duyệt chặn (mở bằng file:// thì ảnh bị coi là khác nguồn). */
  function glRenderer(cv, first) {
    const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'pos');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(prog, n);
    const u = { p: U('p'), seed: U('seed'), fade: U('fade'), fx: U('fx'), ka: U('ka'), kb: U('kb') };
    gl.uniform1i(U('A'), 0); gl.uniform1i(U('B'), 1); gl.uniform2f(U('res'), cv.width, cv.height);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.viewport(0, 0, cv.width, cv.height);
    const R = {
      kinds: 6,
      upload(s) {
        s.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, s.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, s.c);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        s.c = null;
      },
      draw(a, b, p, fx, seed, fade, ka, kb) {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, a.tex);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, b.tex);
        gl.uniform1f(u.p, p); gl.uniform1i(u.fx, fx); gl.uniform1f(u.seed, seed); gl.uniform1f(u.fade, fade);
        gl.uniform3fv(u.ka, ka); gl.uniform3fv(u.kb, kb);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      free(s) { gl.deleteTexture(s.tex); },
      dispose() { setTimeout(() => gl.getExtension('WEBGL_lose_context')?.loseContext(), 1500); },
    };
    try { R.upload(first); } catch (e) { return null; }
    return R;
  }

  /** Bộ vẽ Canvas 2D: dùng khi WebGL bị chặn. Năm kiểu chuyển cảnh dựng bằng mặt nạ và phối màu. */
  function c2dRenderer(cv) {
    const x = cv.getContext('2d'), W = cv.width, H = cv.height;
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
    const t = tmp.getContext('2d');
    const put = (g, s, k, extra = 1) => {
      const z = k[0] * extra, w = W * z, h = H * z;
      g.drawImage(s.c, (W - w) / 2 - k[1] * w, (H - h) / 2 + k[2] * h, w, h);
    };
    const masked = (b, kb, grad) => {                 // vẽ ảnh mới qua mặt nạ chuyển sắc
      t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, W, H); put(t, b, kb);
      t.globalCompositeOperation = 'destination-in'; t.fillStyle = grad; t.fillRect(0, 0, W, H);
      x.drawImage(tmp, 0, 0);
    };
    return {
      kinds: 5,
      upload() {},
      draw(a, b, p, fx, seed, fade, ka, kb) {
        const bell = Math.sin(p * Math.PI);
        x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
        put(x, a, ka);
        if (p > 0) {
          if (fx === 0) {                             // tan chồng kèm nhún ống kính
            x.globalAlpha = p; put(x, b, kb, 1 + (1 - p) * .08); x.globalAlpha = 1;
          } else if (fx === 1) {                      // cháy sáng quét chéo
            const e = p * 1.5 - .25, g = t.createLinearGradient(0, H, W, 0);
            g.addColorStop(SL.clamp(e - .2, 0, 1), '#000'); g.addColorStop(SL.clamp(e + .05, 0, 1), 'transparent');
            masked(b, kb, g);
            const l = x.createLinearGradient(0, H, W, 0);
            l.addColorStop(SL.clamp(e - .3, 0, 1), 'rgba(255,150,60,0)');
            l.addColorStop(SL.clamp(e - .05, 0, 1), `rgba(255,150,60,${.75 * bell})`);
            l.addColorStop(SL.clamp(e + .2, 0, 1), 'rgba(255,150,60,0)');
            x.globalCompositeOperation = 'lighter'; x.fillStyle = l; x.fillRect(0, 0, W, H);
          } else if (fx === 2) {                      // lao ống kính
            for (let i = 1; i <= 7; i++) { x.globalAlpha = 1 / (i + 1); put(x, a, ka, 1 + bell * .3 * i / 7); }
            const m = SL.clamp((p - .3) / .4, 0, 1);
            for (let i = 0; i <= 7; i++) { x.globalAlpha = m / (i + 1); put(x, b, kb, 1 + bell * .3 * i / 7); }
            x.globalAlpha = 1;
          } else if (fx === 3) {                      // mở tròn từ tâm
            const r = Math.hypot(W, H) * .62 * p * 1.25, g = t.createRadialGradient(W / 2, H / 2, r * .7, W / 2, H / 2, r + 1);
            g.addColorStop(0, '#000'); g.addColorStop(1, 'transparent');
            masked(b, kb, g);
          } else {                                    // lá chớp so le
            const n = 6;
            for (let i = 0; i < n; i++) {
              const q = SL.clamp(p * 1.6 - i * .12, 0, 1), e = 1 - Math.pow(1 - q, 3);
              x.save(); x.beginPath(); x.rect(Math.round(i * W / n), 0, Math.ceil(W / n), H); x.clip();
              x.translate(0, (1 - e) * H * (i % 2 ? 1 : -1)); put(x, b, kb); x.restore();
            }
          }
        }
        const v = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) * .6);
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.42)');
        x.globalCompositeOperation = 'source-over'; x.fillStyle = v; x.fillRect(0, 0, W, H);
        if (fade < 1) { x.fillStyle = `rgba(0,0,0,${1 - fade})`; x.fillRect(0, 0, W, H); }
      },
      free() {}, dispose() {},
    };
  }

  SL.register({
    id: 'cine', name: 'Điện ảnh',
    desc: 'Ảnh tràn khung, máy lia chậm, chuyển cảnh kiểu dòng chảy, cháy sáng, lao ống kính',
    async run(ctx) {
      const { W, H } = ctx;
      const k = Math.min(Math.min(devicePixelRatio || 1, 2), 2560 / Math.max(W, H));
      const cw = Math.round(W * k), ch = Math.round(H * k);
      const mk = () => {
        const c = SL.el('canvas', '', ctx.root, { position: 'absolute', inset: 0, width: '100%', height: '100%' });
        c.width = cw; c.height = ch; return c;
      };

      /** Dựng một cảnh (1-3 ảnh) lên canvas riêng. */
      async function scene() {
        const g = SL.group(ctx.ar);
        const imgs = await Promise.all(g.photos.map(p => ctx.load(p)));
        const c = document.createElement('canvas'); c.width = cw; c.height = ch;
        const x = c.getContext('2d', { alpha: false });
        x.fillStyle = '#000'; x.fillRect(0, 0, cw, ch);
        if (g.dir === 'fit') {
          const p = g.photos[0], b = SL.cover(p, cw, ch, 1.2), f = SL.contain(p.a, cw, ch);
          x.filter = `blur(${Math.round(cw * .03)}px) brightness(.42) saturate(1.25)`;
          x.drawImage(imgs[0], b.x, b.y, b.w, b.h);
          x.filter = 'none';
          x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = cw * .035;
          x.drawImage(imgs[0], (cw - f.w) / 2, (ch - f.h) / 2, f.w, f.h);
        } else {
          const n = g.photos.length, gap = n > 1 ? Math.round(cw * .0035) : 0, cols = g.dir !== 'rows';
          const w = cols ? (cw - gap * (n - 1)) / n : cw, h = cols ? ch : (ch - gap * (n - 1)) / n;
          g.photos.forEach((p, i) => {
            const rx = cols ? i * (w + gap) : 0, ry = cols ? 0 : i * (h + gap), r = SL.cover(p, w, h);
            x.save(); x.beginPath(); x.rect(rx, ry, w, h); x.clip();
            x.drawImage(imgs[i], rx + r.x, ry + r.y, r.w, r.h);
            x.restore();
          });
        }
        const zin = Math.random() < .55, a = SL.rnd(Math.PI * 2);
        return { c, t0: 0, z0: zin ? 1.05 : 1.17, z1: zin ? 1.17 : 1.05, dx: Math.cos(a), dy: Math.sin(a) };
      }
      const life = ctx.dur + TR * 2;
      const kb = (s, now) => {
        const q = SL.clamp((now - s.t0) / life, 0, 1), z = s.z0 + (s.z1 - s.z0) * q, m = (1 - 1 / z) / 2 * .85 * (q * 2 - 1);
        return [z * (1 + kick), s.dx * m, s.dy * m];
      };

      // Nhún ống kính theo phách: mạnh ở đầu ô nhịp, nhẹ ở các phách còn lại
      let kick = 0;
      ctx.onBeat((n, e) => { kick = Math.max(kick, n === 0 ? .006 + .018 * e : .006 * e); });
      const cap = SL.el('div', 'cap-b');

      let cur = await scene(), nxt = null, tr = null;
      let cv = mk(), R = glRenderer(cv, cur);
      if (!R) { cv.remove(); cv = mk(); R = c2dRenderer(cv); }
      ctx.onKill(() => R.dispose());
      const born = performance.now();
      cur.t0 = born;
      ctx.raf((t, dt) => {
        kick *= Math.exp(-dt * 6);
        const now = performance.now();
        const p = tr ? SL.clamp((now - tr.t) / TR, 0, 1) : 0;
        R.draw(cur, nxt || cur, p * p * (3 - 2 * p), tr ? tr.fx : 0, tr ? tr.seed : 0,
          Math.min(1, (now - born) / 1200), kb(cur, now), kb(nxt || cur, now));
      });

      ctx.root.appendChild(cap);
      ctx.caption(SL.word(), cap, 900);
      let fx = (Math.random() * 6) | 0;
      for (;;) {
        const t = performance.now();
        const b = await scene();
        R.upload(b);
        await ctx.hold(Math.max(300, ctx.dur - (performance.now() - t)), TR * .5);
        b.t0 = performance.now() - TR * .2;
        nxt = b; tr = { t: performance.now(), fx: fx++ % R.kinds, seed: SL.rnd(50) };
        cap.animate({ opacity: [1, 0] }, { duration: TR * .4, fill: 'forwards' });
        await ctx.wait(TR * .5);
        ctx.caption(SL.word(), cap, TR * .25);          // chữ của cảnh mới: mỗi phách một từ
        await ctx.wait(TR * .5);
        R.free(cur);
        cur = b; nxt = null; tr = null;
      }
    },
  });
})();
