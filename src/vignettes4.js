// 第四稿的插画布景（每个布景的 update(lt) 用的是“本段自己的时间” lt，从 0 开始）。
// 全部原创示意：荔枝三日、长安的一盘荔枝、《新唐书》的一页（朱笔圈点）、天亮前后的荔枝园和剪枝、封竹筒、驿站交接、日夜奔跑、倒下的马、剥开的荔枝。
import * as THREE from "three";
import { tex, Stage, basic, revealMaterial } from "./engine.js";
import { SW, SH, RES, peeledScene } from "./scenes2d.js";
import { mk, rng, clamp, lerp, silk, smooth, stroke, fillPath, brushText, seal, lycheeArt, lychee, riderArt, figureArt, INK, VERM } from "./art.js";

const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const canvasOf = (draw, w = SW, h = SH, res = w === SW && h === SH ? RES : 1) => { const c = mk(Math.round(w * res), Math.round(h * res)), g = c.getContext("2d"); g.scale(res, res); draw(g, c); return c; };
const T = (c) => tex(c, { mip: false, free: true });
const TM = (c) => tex(c, { mip: true });
/** 一张贴图片：画布像素宽高 w×h（插画坐标系），anchor 是锚点在图里的比例位置 */
function sprite(st, map, w, h, { anchor = [0.5, 0.5], opacity = 1, z = 5, margin = 1.12 } = {}) {
  const s = st.pxScale(z, margin), g = new THREE.PlaneGeometry(w * s, h * s); g.translate((0.5 - anchor[0]) * w * s, (anchor[1] - 0.5) * h * s, 0);
  const m = new THREE.Mesh(g, basic(map, opacity)); m.userData.z = z; m.userData.margin = margin; st.scene.add(m);
  m.at = (x, y) => { m.position.copy(st.px(x, y, z, margin)); return m; };
  return m;
}
function sheetOf(n, size, draw) { const c = mk(size * n, size), g = c.getContext("2d"); for (let i = 0; i < n; i++) { g.save(); g.translate(i * size, 0); g.beginPath(); g.rect(0, 0, size, size); g.clip(); draw(g, i / n, size); g.restore(); } const t = tex(c); t.repeat.set(1 / n, 1); return { t, n }; }
const cam = (st, x, y, z, lx = x, ly = y) => { st.camera.position.set(x, y, z); st.camera.lookAt(lx, ly, 0); };

// ───────────── 1 荔枝一离枝，一日色变，二日香变，三日味变（4.6 秒）─────────────
export function buildDecay4() {
  const st = new Stage(30);
  const bg = canvasOf((g) => {
    silk(g, SW, SH, { tone: [228, 210, 168], seed: 71, vign: 0.42 });
    const gr = g.createRadialGradient(SW * 0.5, SH * 0.55, 50, SW * 0.5, SH * 0.55, SW * 0.5); gr.addColorStop(0, "rgba(255,246,222,.4)"); gr.addColorStop(1, "rgba(255,246,222,0)"); g.fillStyle = gr; g.fillRect(0, 0, SW, SH);
    stroke(g, smooth([[SW * 0.12, 40], [SW * 0.35, 100], [SW * 0.5, 150], [SW * 0.64, 128], [SW * 0.9, 50]], 8), 34, 14, "#4a3420");
    stroke(g, smooth([[SW * 0.5, 150], [SW * 0.5 + 6, 210], [SW * 0.5 - 4, 262]], 6), 9, 6, "#4a3420");   // 剪下来的那一小段果柄
    for (let i = 0; i < 11; i++) { const x = SW * (0.18 + i * 0.065); g.save(); g.translate(x, 100 + Math.sin(i * 1.7) * 26); g.rotate(-0.7 + (i % 3) * 0.55); g.fillStyle = i % 2 ? "#4f6e38" : "#5d7d42"; g.beginPath(); g.ellipse(0, 54, 22, 74, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = "rgba(30,40,20,.6)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -18); g.lineTo(0, 124); g.stroke(); g.restore(); }
  });
  st.layer(basic(T(bg)), -80, 1.14);
  const states = [0, 1, 2, 3].map((a) => T(lychee(768, { ripe: 1, age: a, seed: 21 })));
  const lyMat = new THREE.ShaderMaterial({ uniforms: { t0: { value: states[0] }, t1: { value: states[1] }, t2: { value: states[2] }, t3: { value: states[3] }, uAge: { value: 0 } }, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D t0, t1, t2, t3; uniform float uAge; varying vec2 vUv; void main(){ vec4 a = texture2D(t0, vUv), b = texture2D(t1, vUv), c = texture2D(t2, vUv), d = texture2D(t3, vUv); gl_FragColor = uAge < 1.0 ? mix(a, b, uAge) : uAge < 2.0 ? mix(b, c, uAge - 1.0) : mix(c, d, uAge - 2.0); }`, transparent: true, depthWrite: false });
  const s = st.pxScale(0, 1.12), ly = new THREE.Mesh(new THREE.PlaneGeometry(1100 * s, 1100 * s), lyMat); st.scene.add(ly);
  const slash = sprite(st, T(canvasOf((g) => stroke(g, smooth([[40, 200], [300, 120], [560, 40]], 8), 4, 26, "rgba(255,250,236,1)"), 600, 240)), 600, 240, { z: 8, opacity: 0 }).at(SW * 0.5, 230);
  const words = [["色变", 1.3], ["香变", 2.4], ["味变", 3.4]].map(([w, t0], i) => { const m = sprite(st, T(canvasOf((g) => brushText(g, w, 120, 260, 180, { vertical: true, color: i === 0 ? VERM : INK }), 240, 560)), 240, 560, { z: 10, opacity: 0 }); m.at(i === 1 ? 1880 : i === 0 ? 700 : 2120, 700 + (i === 2 ? 60 : 0)); m.userData.t0 = t0; return m; });
  const days = ["第一日", "第二日", "第三日"].map((d, i) => { const m = sprite(st, T(canvasOf((g) => { g.fillStyle = "rgba(178,40,32,.9)"; g.fillRect(8, 8, 164, 484); brushText(g, d, 90, 92, 120, { vertical: true, color: "#f3e6c8" }); }, 180, 500)), 144, 400, { z: 12, opacity: 0 }); m.at(2300, 420); m.userData.t0 = [1.1, 2.2, 3.2][i]; return m; });
  st.update = (t) => {
    const drop = easeOut(seg(t, 0.35, 0.95)), bounce = Math.sin(seg(t, 0.95, 1.4) * Math.PI) * 0.03;
    ly.position.copy(st.px(SW * 0.5, lerp(520, 760, drop) - bounce * 400, 4)); ly.rotation.z = drop * 0.14;
    lyMat.uniforms.uAge.value = clamp(seg(t, 1.1, 1.8) + seg(t, 2.2, 2.9) + seg(t, 3.2, 3.9), 0, 3);
    ly.scale.setScalar(1 - seg(t, 3.2, 3.9) * 0.05);
    slash.material.opacity = Math.sin(seg(t, 0.2, 0.55) * Math.PI);
    words.forEach((m) => (m.material.opacity = easeOut(seg(t, m.userData.t0, m.userData.t0 + 0.45))));
    days.forEach((m, i) => { const t0 = m.userData.t0, t1 = i < 2 ? days[i + 1].userData.t0 : 99; m.material.opacity = seg(t, t0, t0 + 0.25) * (1 - seg(t, t1, t1 + 0.15)); m.scale.setScalar(lerp(1.4, 1, easeOut(seg(t, t0, t0 + 0.25)))); });
    const u = seg(t, 0, 4.6); cam(st, lerp(-30, 30, u), lerp(10, -20, u), lerp(st.D, st.D * 0.86, ease(u)), 0, -40 * u);
    st.look = { blur: 0.0045, focus: 0.52, band: 0.2 };
  };
  return st;
}

// ───────────── 4 可长安城里，年年吃得上岭南的鲜荔枝：一盘青瓷盘里的鲜荔枝（3.2 秒）─────────────
function plateArt(g) {
  const bg = g.createLinearGradient(0, 0, 0, SH); bg.addColorStop(0, "#2b1c12"); bg.addColorStop(0.55, "#3a2617"); bg.addColorStop(1, "#24170e"); g.fillStyle = bg; g.fillRect(0, 0, SW, SH);
  // 背后一扇淡淡的屏风（远山几笔）
  g.fillStyle = "rgba(214,190,140,.10)"; g.fillRect(260, 60, SW - 520, 560);
  g.strokeStyle = "rgba(214,190,140,.22)"; g.lineWidth = 6; g.strokeRect(260, 60, SW - 520, 560); for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(260 + ((SW - 520) * k) / 4, 60); g.lineTo(260 + ((SW - 520) * k) / 4, 620); g.stroke(); }
  g.strokeStyle = "rgba(214,190,140,.16)"; g.lineWidth = 3; for (let k = 0; k < 3; k++) { g.beginPath(); for (let i = 0; i <= 60; i++) { const x = 300 + i * ((SW - 600) / 60), y = 430 - k * 60 - Math.abs(Math.sin(i * 0.23 + k * 2)) * (90 - k * 18); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  // 桌面（漆面反光）
  const tb = g.createLinearGradient(0, 640, 0, SH); tb.addColorStop(0, "#4a2a18"); tb.addColorStop(1, "#1d110a"); g.fillStyle = tb; g.fillRect(0, 640, SW, SH - 640);
  const spot = g.createRadialGradient(SW * 0.5, 860, 60, SW * 0.5, 860, 1000); spot.addColorStop(0, "rgba(255,214,150,.30)"); spot.addColorStop(1, "rgba(255,214,150,0)"); g.fillStyle = spot; g.fillRect(0, 0, SW, SH);
  // 盘子：影子 → 外沿 → 盘心（青瓷，带开片纹）
  const cx = SW * 0.5, cy = 900, rx = 640, ry = 230;
  g.fillStyle = "rgba(10,5,2,.5)"; g.beginPath(); g.ellipse(cx + 30, cy + 70, rx * 1.02, ry * 0.95, 0, 0, Math.PI * 2); g.fill();
  const rim = g.createLinearGradient(0, cy - ry, 0, cy + ry); rim.addColorStop(0, "#c7d8c0"); rim.addColorStop(0.5, "#8fae98"); rim.addColorStop(1, "#5f7f6c"); g.fillStyle = rim; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
  const well = g.createRadialGradient(cx - 120, cy - 60, 40, cx, cy, rx * 0.8); well.addColorStop(0, "#d5e2cc"); well.addColorStop(1, "#97b39f"); g.fillStyle = well; g.beginPath(); g.ellipse(cx, cy + 8, rx * 0.8, ry * 0.72, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(70,96,80,.35)"; g.lineWidth = 1.3; const R = rng(5); for (let i = 0; i < 60; i++) { let x = cx + (R() - 0.5) * rx * 1.5, y = cy + (R() - 0.5) * ry * 1.2; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (R() - 0.5) * 70; y += (R() - 0.5) * 26; g.lineTo(x, y); } g.stroke(); }
  g.strokeStyle = "rgba(255,255,255,.45)"; g.lineWidth = 5; g.beginPath(); g.ellipse(cx, cy, rx - 6, ry - 4, 0, Math.PI * 1.08, Math.PI * 1.6); g.stroke();
  // 荔枝堆（从后往前画）+ 几片叶子
  const L = [], RR = rng(9);
  for (let row = 0; row < 5; row++) { const n = 7 - row, y = cy - 30 - row * 62; for (let i = 0; i < n; i++) L.push([cx + (i - (n - 1) / 2) * 118 + (RR() - 0.5) * 30, y + (RR() - 0.5) * 18, 76 - row * 3]); }
  L.sort((a, b) => a[1] - b[1]);
  for (const [i, leaf] of [[0, [cx - 380, cy - 70, -0.6]], [1, [cx + 360, cy - 90, 0.7]], [2, [cx + 40, cy - 330, 0.2]]]) { const [x, y, a] = leaf; g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = i % 2 ? "#4f6e38" : "#3f5e2e"; g.beginPath(); g.ellipse(0, 0, 150, 46, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = "rgba(20,30,14,.6)"; g.lineWidth = 3; g.beginPath(); g.moveTo(-140, 0); g.lineTo(140, 0); g.stroke(); g.restore(); }
  L.forEach(([x, y, r], i) => lycheeArt(g, x, y, r, { ripe: 1, age: 0, seed: 40 + i, leaf: false, stem: i % 5 === 0 }));
  lycheeArt(g, cx + 700, cy + 200, 74, { ripe: 1, seed: 91, leaf: true, stem: true }); lycheeArt(g, cx - 760, cy + 180, 70, { ripe: 1, seed: 92, leaf: false, stem: true });
  silk(g, SW, SH, { tone: null, vign: 0.35, seed: 31, fibers: 0.4 });
}
export function buildPlate() {
  const st = new Stage(30);
  st.layer(basic(T(canvasOf(plateArt))), 0, 1.14);
  const glow = sprite(st, T(canvasOf((g) => { const gr = g.createRadialGradient(300, 300, 10, 300, 300, 300); gr.addColorStop(0, "rgba(255,230,180,.35)"); gr.addColorStop(1, "rgba(255,230,180,0)"); g.fillStyle = gr; g.fillRect(0, 0, 600, 600); }, 600, 600)), 900, 900, { z: 6, opacity: 0.6 }).at(SW * 0.45, 700);
  glow.material.blending = THREE.AdditiveBlending;
  st.update = (t) => { const u = seg(t, 0, 3.2); cam(st, lerp(-60, 20, u), lerp(-40, -60, u), lerp(st.D * 0.96, st.D * 0.82, ease(u)), lerp(-30, 10, u), -70); glow.material.opacity = 0.45 + 0.15 * Math.sin(t * 2); st.look = { blur: 0.004, focus: 0.62, band: 0.16 }; };
  return st;
}

// ───────────── 5–6 史书只写了一句：置骑传送，走数千里，味未变已至京师（6.6 秒）─────────────
// 《新唐书·后妃传上·杨贵妃》原文（刻本没有标点；读者用朱笔在要紧的字旁圈点）
const XTS = "妃每從遊幸乘馬則力士授轡策凡充錦繡官及冶瑑金玉者大抵千人奉須索奇服秘玩變化若神四方爭為怪珍入貢動駭耳目於是嶺南節度使張九章廣陵長史王翼以所獻最進九章銀青階擢翼戶部侍郎天下風靡妃嗜荔支必欲生致之乃置騎傳送走數千里味未變已至京師" +
  "天寶九載妃復得譴還外第國忠謀於吉溫溫因見帝曰婦人過忤當死然何惜宮中一席廣為鈇鑕地更使外辱乎帝感動輟食詔中人張韜光賜之妃因韜光謝帝曰妾有罪當萬誅然膚髮外皆上所賜";
const KEY = "乃置騎傳送走數千里味未變已至京師";
function bookArt(g) {
  // 案头（深色木纹）
  g.fillStyle = "#2a1a10"; g.fillRect(0, 0, SW, SH); const R = rng(3);
  for (let i = 0; i < 160; i++) { const y = R() * SH; g.strokeStyle = `rgba(${70 + R() * 30},${42 + R() * 20},${22},${0.25 + R() * 0.2})`; g.lineWidth = 1 + R() * 3; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= SW; x += 80) g.lineTo(x, y + Math.sin(x * 0.004 + i) * 10); g.stroke(); }
  // 书页
  const px = 330, py = 110, pw = 1900, ph = 1220;
  g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(px + 22, py + 26, pw, ph);
  g.save(); g.beginPath(); g.rect(px, py, pw, ph); g.clip(); silk(g, SW, SH, { tone: [232, 219, 186], seed: 8, vign: 0.25 });
  for (let i = 0; i < 14; i++) { const x = px + R() * pw, y = py + R() * ph, r = 40 + R() * 160, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(150,110,60,${0.06 + R() * 0.08})`); gr.addColorStop(1, "rgba(150,110,60,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  g.restore();
  // 版框（四周双边）、版心、界栏
  const fx = px + 110, fy = py + 90, fw = pw - 220, fh = ph - 180;
  g.strokeStyle = "rgba(30,22,14,.9)"; g.lineWidth = 7; g.strokeRect(fx, fy, fw, fh); g.lineWidth = 2; g.strokeRect(fx + 14, fy + 14, fw - 28, fh - 28);
  const xin = fx + 14, xw = 120;     // 版心在左边（这是一张书叶的右半）
  g.beginPath(); g.moveTo(xin + xw, fy + 14); g.lineTo(xin + xw, fy + fh - 14); g.stroke();
  g.fillStyle = "rgba(30,22,14,.9)"; g.beginPath(); g.moveTo(xin, fy + 190); g.lineTo(xin + xw, fy + 190); g.lineTo(xin + xw / 2, fy + 240); g.closePath(); g.fill();
  g.font = '700 46px "SerifSC"'; g.textAlign = "center"; g.textBaseline = "middle";
  [..."新唐書"].forEach((c, i) => g.fillText(c, xin + xw / 2, fy + 70 + i * 48));
  [..."卷七十六"].forEach((c, i) => g.fillText(c, xin + xw / 2, fy + 300 + i * 50));
  const c0 = xin + xw, cols = 14, cw = (fx + fw - 14 - c0) / cols, rows = 19, rh = (fh - 60) / rows;
  g.lineWidth = 1.6; for (let k = 1; k < cols; k++) { const x = c0 + k * cw; g.beginPath(); g.moveTo(x, fy + 14); g.lineTo(x, fy + fh - 14); g.stroke(); }
  // 文字：从右往左一列列竖排；第一列是篇名
  const pos = {}; const put = (txt, col, row0, size = 60, weight = 700) => { g.font = `${weight} ${size}px "SerifSC"`; [...txt].forEach((ch, i) => { const x = c0 + (cols - 1 - col) * cw + cw / 2, y = fy + 40 + (row0 + i) * rh + rh / 2; g.fillText(ch, x, y); pos[`${col},${row0 + i}`] = [x, y]; }); };
  g.fillStyle = "rgba(24,16,10,.94)";
  put("列傳第一　后妃上", 0, 0);
  const chars = [...XTS], keyAt = XTS.indexOf(KEY), keyPos = [];
  chars.forEach((ch, i) => { const col = 1 + Math.floor(i / rows), row = i % rows; if (col >= cols) return; g.font = '700 60px "SerifSC"'; const x = c0 + (cols - 1 - col) * cw + cw / 2, y = fy + 40 + row * rh + rh / 2; g.fillText(ch, x + (R() - 0.5) * 2, y + (R() - 0.5) * 2); if (i >= keyAt && i < keyAt + KEY.length) keyPos.push([x, y, cw, rh]); });
  return { keyPos };
}
export function buildBook() {
  const st = new Stage(30);
  let info; const c = canvasOf((g) => { info = bookArt(g); });
  const page = st.layer(revealMaterial(T(c)), 0, 1.12);
  const ring = T(canvasOf((g) => { g.strokeStyle = "rgba(196,44,32,.95)"; g.lineWidth = 7; g.beginPath(); g.arc(32, 32, 20, 0, Math.PI * 2); g.stroke(); }, 64, 64, 1));
  const dots = info.keyPos.map(([x, y, cw]) => sprite(st, ring, 38, 38, { z: 4, opacity: 0 }).at(x + cw * 0.36, y));
  const bar = sprite(st, T(canvasOf((g) => { stroke(g, smooth([[20, 10], [26, 300], [18, 600], [24, 900]], 6), 10, 6, "rgba(196,44,32,.85)"); }, 48, 920, 1)), 24, 460, { z: 3, opacity: 0, anchor: [0.5, 0] });
  const [kx, ky] = info.keyPos[0], [ex, ey] = info.keyPos[info.keyPos.length - 1];
  st.update = (t) => {
    page.material.uniforms.uReveal.value = easeOut(seg(t, 0, 1.1));
    // 第 6 句：一个字一个字圈出来
    dots.forEach((d, i) => { const t0 = 2.5 + i * 0.16; d.material.opacity = easeOut(seg(t, t0, t0 + 0.2)); d.scale.setScalar(lerp(1.6, 1, easeOut(seg(t, t0, t0 + 0.2)))); });
    // 镜头：整页 → 推到这一句
    const f = st.px((kx + ex) / 2, (ky + ey) / 2 + 40, 0), k = ease(seg(t, 2.0, 4.6));
    cam(st, lerp(0, f.x, k), lerp(0, f.y, k), lerp(st.D, st.D * 0.42, k), lerp(0, f.x, k), lerp(0, f.y, k));
    void bar;
    st.look = { blur: 0.003 + k * 0.004, focus: 0.5, band: 0.2 };
  };
  return st;
}

// ───────────── 7–8 天刚亮就摘，连枝带叶一起剪：荔枝园，天由暗转亮，一只手持剪剪下一枝（6.0 秒）─────────────
function orchardSky(g, dawn) {
  const gr = g.createLinearGradient(0, 0, 0, SH);
  if (dawn) { gr.addColorStop(0, "#6c7894"); gr.addColorStop(0.45, "#c9a08c"); gr.addColorStop(0.72, "#f1c48c"); gr.addColorStop(1, "#f6d9a6"); }
  else { gr.addColorStop(0, "#252c3a"); gr.addColorStop(0.5, "#4d4f5e"); gr.addColorStop(0.78, "#7f7268"); gr.addColorStop(1, "#8f7e6c"); }
  g.fillStyle = gr; g.fillRect(0, 0, SW, SH);
  if (dawn) { const sx = SW * 0.68, sy = SH * 0.66, h = g.createRadialGradient(sx, sy, 10, sx, sy, 700); h.addColorStop(0, "rgba(255,236,190,.9)"); h.addColorStop(0.25, "rgba(255,200,140,.45)"); h.addColorStop(1, "rgba(255,200,140,0)"); g.fillStyle = h; g.fillRect(0, 0, SW, SH); g.fillStyle = "rgba(255,240,205,.95)"; g.beginPath(); g.arc(sx, sy, 46, 0, Math.PI * 2); g.fill(); }
  else { const R = rng(4); for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,250,235,${0.2 + R() * 0.5})`; g.fillRect(R() * SW, R() * SH * 0.5, 2, 2); } }
  silk(g, SW, SH, { tone: null, vign: 0.3, seed: 12, fibers: 0.5 });
}
function orchardHills(g, dawn) {
  const R = rng(13), row = (y0, amp, col, n, trees, fruit) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, SH); for (let x = 0; x <= SW; x += 20) g.lineTo(x, y0 - Math.abs(Math.sin(x * 0.002 + y0)) * amp - Math.sin(x * 0.011) * amp * 0.12); g.lineTo(SW, SH); g.closePath(); g.fill();
    for (let i = 0; i < n; i++) { const x = (i + R() * 0.6) * (SW / n), y = y0 - Math.abs(Math.sin(x * 0.002 + y0)) * amp, r = trees * (0.8 + R() * 0.4); g.fillStyle = col; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + (R() - 0.5) * r * 1.4, y - r * 0.6 - R() * r * 0.6, r * (0.5 + R() * 0.4), 0, Math.PI * 2); g.fill(); } g.fillRect(x - r * 0.06, y - r * 0.4, r * 0.12, r * 0.5); if (fruit) for (let k = 0; k < 12; k++) { g.fillStyle = `rgba(${dawn ? 200 : 120},${dawn ? 50 : 34},${dawn ? 40 : 30},${dawn ? 0.9 : 0.6})`; g.beginPath(); g.arc(x + (R() - 0.5) * r * 1.3, y - r * 0.5 - R() * r * 0.7, r * 0.05, 0, Math.PI * 2); g.fill(); } }
  };
  row(SH * 0.66, 120, dawn ? "rgba(120,110,120,.55)" : "rgba(40,40,52,.75)", 0, 0, false);
  const mist = g.createLinearGradient(0, SH * 0.6, 0, SH * 0.75); mist.addColorStop(0, "rgba(255,240,220,0)"); mist.addColorStop(0.5, dawn ? "rgba(255,236,210,.55)" : "rgba(150,150,160,.35)"); mist.addColorStop(1, "rgba(255,240,220,0)"); g.fillStyle = mist; g.fillRect(0, SH * 0.58, SW, SH * 0.2);
  row(SH * 0.76, 40, dawn ? "#3b3a34" : "#1d1f24", 9, 120, true);
  row(SH * 0.88, 30, dawn ? "#2a2722" : "#14161a", 6, 190, true);
}
function branchArt(g, cut) {
  // 前景的一枝：cut=false 画留在树上的部分，cut=true 只画被剪下来的那一截（带果）
  const dark = "#1c1a14";
  if (!cut) {
    stroke(g, smooth([[SW + 40, 40], [SW * 0.86, 180], [SW * 0.74, 300], [SW * 0.66, 380]], 8), 48, 20, dark);
    for (let i = 0; i < 9; i++) { const x = SW * (0.7 + i * 0.035), y = 160 + Math.sin(i) * 90 + i * 14; g.save(); g.translate(x, y); g.rotate(-0.9 + (i % 3) * 0.6); g.fillStyle = dark; g.beginPath(); g.ellipse(0, 70, 26, 92, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  } else {
    stroke(g, smooth([[SW * 0.66, 380], [SW * 0.6, 440], [SW * 0.55, 520]], 6), 18, 10, dark);
    for (let i = 0; i < 5; i++) { const x = SW * (0.54 + i * 0.022), y = 470 + Math.sin(i * 2) * 40; g.save(); g.translate(x, y); g.rotate(0.4 - i * 0.35); g.fillStyle = dark; g.beginPath(); g.ellipse(0, 56, 22, 76, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
    for (let i = 0; i < 7; i++) lycheeArt(g, SW * 0.55 + (i % 4) * 46 - 60, 600 + Math.floor(i / 4) * 52 + (i % 2) * 12, 34, { ripe: 1, seed: 60 + i, leaf: false, stem: false });
  }
}
function handArt(g, closed) {
  // 一只手攥着交股剪（唐代常用的弹簧剪：后面一个弯环，前面两片刃），从左下伸进来；剪影
  const c = "#141210";
  fillPath(g, smooth([[0, 600], [120, 520], [214, 452], [252, 488], [150, 590], [30, 680]], 6, true), c);   // 小臂
  fillPath(g, smooth([[206, 450], [250, 404], [312, 388], [360, 404], [370, 448], [334, 482], [268, 494], [222, 480]], 6, true), c);   // 手掌
  for (let i = 0; i < 4; i++) { g.fillStyle = c; g.beginPath(); g.ellipse(352 + i * 3, 404 + i * 21, 27, 13, 0.25, 0, Math.PI * 2); g.fill(); }   // 弯着的四个指头
  fillPath(g, smooth([[284, 392], [328, 360], [380, 360], [392, 376], [350, 386], [306, 404]], 4, true), c);   // 拇指压在上面
  // 逆光的一道暖边：手背、拇指、指节的上沿，一看就是手
  g.strokeStyle = "rgba(255,196,128,.75)"; g.lineWidth = 3.5; g.lineCap = "round";
  g.beginPath(); g.moveTo(40, 590); g.quadraticCurveTo(140, 500, 214, 452); g.quadraticCurveTo(250, 404, 312, 388); g.stroke();
  g.beginPath(); g.moveTo(290, 388); g.quadraticCurveTo(330, 362, 380, 361); g.stroke();
  for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(352 + i * 3, 404 + i * 21, 27, 13, 0.25, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  g.save(); g.translate(372, 408);
  g.strokeStyle = c; g.lineWidth = 10; g.lineCap = "round"; g.beginPath(); g.ellipse(-70, 0, 46, 30, 0, 0.5, Math.PI * 2 - 0.5); g.stroke();   // 后面的弯环
  const a = closed ? 0.015 : 0.2;
  for (const sgn of [-1, 1]) { g.save(); g.rotate(sgn * a); fillPath(g, [[0, -9], [80, -11], [220, -5], [256, 0], [220, 5], [80, 9], [0, 9]], c); g.strokeStyle = "rgba(200,190,170,.5)"; g.lineWidth = 2; g.beginPath(); g.moveTo(90, -sgn * 4); g.lineTo(240, 0); g.stroke(); g.restore(); }
  g.restore();
}
export function buildOrchard4() {
  const st = new Stage(30);
  const skyMat = new THREE.ShaderMaterial({ uniforms: { tA: { value: T(canvasOf((g) => orchardSky(g, false))) }, tB: { value: T(canvasOf((g) => orchardSky(g, true))) }, uMix: { value: 0 } }, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform sampler2D tA, tB; uniform float uMix; varying vec2 vUv; void main(){ gl_FragColor = vec4(mix(texture2D(tA, vUv).rgb, texture2D(tB, vUv).rgb, uMix), 1.0); }` });
  st.layer(skyMat, -900, 1.2);
  const hillsA = st.layer(basic(T(canvasOf((g) => orchardHills(g, false)))), -400, 1.16), hillsB = st.layer(basic(T(canvasOf((g) => orchardHills(g, true)), 0)), -399, 1.16);
  hillsB.material.opacity = 0;
  const branch = st.layer(basic(T(canvasOf((g) => branchArt(g, false)))), 0, 1.12);
  const cutC = canvasOf((g) => branchArt(g, true)), cutPiece = st.layer(basic(T(cutC)), 2, 1.12);
  const handO = TM(canvasOf((g) => handArt(g, false), 660, 700, 1)), handC = TM(canvasOf((g) => handArt(g, true), 660, 700, 1));
  const hand = sprite(st, handO, 760, 806, { z: 30, anchor: [0.95, 0.58] });
  const flash = sprite(st, T(canvasOf((g) => stroke(g, [[20, 60], [220, 20]], 3, 14, "rgba(255,250,230,1)"), 240, 80, 1)), 300, 100, { z: 32, opacity: 0 });
  st.update = (t) => {
    const k = ease(seg(t, 1.6, 3.4)); skyMat.uniforms.uMix.value = k; hillsB.material.opacity = k;
    const handIn = easeOut(seg(t, 3.0, 3.8)), handOut = ease(seg(t, 5.0, 5.8)), snap = t > 4.2;
    hand.material.map = snap ? handC : handO; hand.at(lerp(SW * 0.3, SW * 0.655, handIn) - handOut * 700, lerp(SH * 1.2, 398, handIn) + handOut * 260); hand.visible = t > 2.9;
    flash.at(SW * 0.66, 386); flash.material.opacity = Math.sin(seg(t, 4.2, 4.5) * Math.PI);
    const lift = ease(seg(t, 4.5, 5.6)); cutPiece.position.set(-lift * 260, lift * 160 + (t > 4.2 ? 0 : 0), 2); cutPiece.rotation.z = lift * 0.25;
    const u = seg(t, 0, 6); cam(st, lerp(-40, 40, u), lerp(-10, 10, u), lerp(st.D, st.D * 0.9, ease(u)));
    st.look = { blur: 0.003, focus: 0.45, band: 0.2 };
  };
  return st;
}

// ───────────── 9 封进竹筒，不透风，不见光（3.2 秒）─────────────
function tubeArt(g) {
  silk(g, SW, SH, { tone: [226, 208, 166], seed: 44, vign: 0.45 });
  const sp = g.createRadialGradient(SW * 0.5, SH * 0.5, 80, SW * 0.5, SH * 0.5, SW * 0.55); sp.addColorStop(0, "rgba(255,244,214,.35)"); sp.addColorStop(1, "rgba(255,244,214,0)"); g.fillStyle = sp; g.fillRect(0, 0, SW, SH);
  g.save(); g.translate(SW * 0.47, SH * 0.58); g.rotate(-0.24);
  const L = 1500, r = 170;
  g.fillStyle = "rgba(40,26,12,.35)"; g.beginPath(); g.ellipse(30, r + 40, L * 0.52, 40, 0, 0, Math.PI * 2); g.fill();
  const body = g.createLinearGradient(0, -r, 0, r); body.addColorStop(0, "#c9c27a"); body.addColorStop(0.35, "#a8a35a"); body.addColorStop(0.75, "#7d7c3e"); body.addColorStop(1, "#5b5a2c"); g.fillStyle = body; g.fillRect(-L / 2, -r, L, 2 * r);
  g.strokeStyle = "rgba(255,255,230,.25)"; g.lineWidth = 2; for (let k = 0; k < 40; k++) { const y = -r + (k / 40) * 2 * r; g.beginPath(); g.moveTo(-L / 2, y); g.lineTo(L / 2, y + Math.sin(k) * 3); g.stroke(); }
  for (const nx of [-L / 2 + 40, -40]) { g.fillStyle = "rgba(70,66,30,.85)"; g.fillRect(nx - 12, -r, 24, 2 * r); g.fillStyle = "rgba(230,222,150,.6)"; g.fillRect(nx - 16, -r, 5, 2 * r); }
  // 开口（右端，里面黑洞洞的）
  g.fillStyle = "#c9c27a"; g.beginPath(); g.ellipse(L / 2, 0, 70, r, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#2b220f"; g.beginPath(); g.ellipse(L / 2, 0, 52, r - 22, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  return { mouth: [SW * 0.47 + Math.cos(-0.24) * 750, SH * 0.58 + Math.sin(-0.24) * 750], ang: -0.24 };
}
export function buildTube() {
  const st = new Stage(30);
  let info; st.layer(basic(T(canvasOf((g) => { info = tubeArt(g); }))), 0, 1.12);
  const [mx, my] = info.mouth;
  const branchT = TM(canvasOf((g) => { stroke(g, smooth([[20, 200], [200, 190], [380, 200]], 6), 12, 8, "#4a3420"); for (let i = 0; i < 4; i++) { g.save(); g.translate(120 + i * 60, 170 - (i % 2) * 40); g.rotate(-0.8 + i * 0.5); g.fillStyle = "#4f6e38"; g.beginPath(); g.ellipse(0, -30, 20, 56, 0, 0, Math.PI * 2); g.fill(); g.restore(); } for (let i = 0; i < 6; i++) lycheeArt(g, 260 + (i % 3) * 52, 230 + Math.floor(i / 3) * 50, 30, { ripe: 1, seed: 70 + i, leaf: false, stem: false }); }, 420, 340, 1));
  const branch = sprite(st, branchT, 640, 520, { z: 6, anchor: [0.95, 0.6] });
  const plugT = TM(canvasOf((g) => { const gr = g.createLinearGradient(0, 0, 0, 340); gr.addColorStop(0, "#8a6a44"); gr.addColorStop(1, "#5a4028"); g.fillStyle = gr; g.beginPath(); g.ellipse(60, 170, 52, 150, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = "rgba(30,20,10,.6)"; g.lineWidth = 3; g.stroke(); }, 120, 340, 1));
  const plug = sprite(st, plugT, 120, 340, { z: 8 });
  const mudT = TM(canvasOf((g) => { g.fillStyle = "#7b5a3c"; g.beginPath(); for (let a = 0; a <= 24; a++) { const t = (a / 24) * Math.PI * 2, rr = 1 + Math.sin(a * 2.3) * 0.08; g.lineTo(90 + Math.cos(t) * 80 * rr, 200 + Math.sin(t) * 180 * rr); } g.fill(); }, 180, 400, 1));
  const mud = sprite(st, mudT, 180, 400, { z: 9, opacity: 0 });
  const stampT = TM(seal("封", 220, { white: true }));
  const stamp = sprite(st, stampT, 150, 150, { z: 10, opacity: 0 });
  const w1 = sprite(st, T(canvasOf((g) => brushText(g, "不透风", 70, 60, 120, { vertical: true, color: INK }), 140, 420, 1)), 140, 420, { z: 12, opacity: 0 }).at(mx - 640, my - 250);
  const w2 = sprite(st, T(canvasOf((g) => brushText(g, "不见光", 70, 60, 120, { vertical: true, color: INK }), 140, 420, 1)), 140, 420, { z: 12, opacity: 0 }).at(mx - 450, my - 200);
  st.update = (t) => {
    const slide = ease(seg(t, 0.2, 1.2)), into = seg(t, 0.9, 1.3);
    branch.at(lerp(mx + 700, mx + 40, slide), lerp(my - 180, my - 10, slide)); branch.rotation.z = info.ang; branch.material.opacity = 1 - into;
    const pk = easeOut(seg(t, 1.3, 1.8)); plug.at(lerp(mx + 220, mx, pk), lerp(my - 60, my, pk)); plug.material.opacity = seg(t, 1.25, 1.4); plug.rotation.z = info.ang;
    mud.at(mx + 4, my); mud.rotation.z = info.ang; mud.material.opacity = seg(t, 1.9, 2.1);
    const sk = easeOut(seg(t, 2.2, 2.5)); stamp.at(mx + 4, my); stamp.material.opacity = sk; stamp.scale.setScalar(lerp(1.7, 1, sk)); stamp.rotation.z = info.ang;
    w1.material.opacity = easeOut(seg(t, 1.5, 1.9)); w2.material.opacity = easeOut(seg(t, 2.4, 2.8));
    const u = seg(t, 0, 3.2), f = st.px(mx - 100, my, 0); cam(st, lerp(0, f.x * 0.5, ease(u)), lerp(0, f.y * 0.5, ease(u)), lerp(st.D, st.D * 0.8, ease(u)), lerp(0, f.x * 0.5, ease(u)), lerp(0, f.y * 0.5, ease(u)));
    st.look = { blur: 0.0035, focus: 0.5, band: 0.2 };
  };
  return st;
}

// ───────────── 10–11 驿站门口马早已备好；三十里一驿，人换马换荔枝不停（7.2 秒）─────────────
const SIL = "#1a1410";
function stationSky(g) {
  const gr = g.createLinearGradient(0, 0, 0, SH); gr.addColorStop(0, "#d9c6a4"); gr.addColorStop(0.6, "#f1dcb0"); gr.addColorStop(1, "#f4e2bc"); g.fillStyle = gr; g.fillRect(0, 0, SW, SH);
  const sx = SW * 0.3, sy = SH * 0.42, h = g.createRadialGradient(sx, sy, 10, sx, sy, 600); h.addColorStop(0, "rgba(255,240,205,.9)"); h.addColorStop(1, "rgba(255,240,205,0)"); g.fillStyle = h; g.fillRect(0, 0, SW, SH);
  silk(g, SW, SH, { tone: null, vign: 0.25, seed: 23, fibers: 0.5 });
}
function stationLand(g, w) {
  // 很宽的一条（左右平移用）：远山、近处的地平线和路，每隔一段一座驿站（门楼剪影 + “驿”字旗）
  const R = rng(17);
  g.fillStyle = "rgba(150,130,120,.45)"; g.beginPath(); g.moveTo(0, SH); for (let x = 0; x <= w; x += 30) g.lineTo(x, SH * 0.6 - Math.abs(Math.sin(x * 0.0016)) * 150 - Math.sin(x * 0.007) * 30); g.lineTo(w, SH); g.closePath(); g.fill();
  g.fillStyle = "rgba(90,78,66,.6)"; g.beginPath(); g.moveTo(0, SH); for (let x = 0; x <= w; x += 30) g.lineTo(x, SH * 0.7 - Math.abs(Math.sin(x * 0.0023 + 1)) * 80); g.lineTo(w, SH); g.closePath(); g.fill();
  g.fillStyle = SIL; g.fillRect(0, SH * 0.8, w, SH * 0.2);
  for (let x = 0; x < w; x += 70 + R() * 160) { const hgt = 60 + R() * 120; g.beginPath(); g.moveTo(x, SH * 0.8); g.lineTo(x + 6, SH * 0.8 - hgt); g.lineTo(x + 12, SH * 0.8); g.fill(); for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + 6 + (R() - 0.5) * 50, SH * 0.8 - hgt + (R() - 0.3) * 40, 16 + R() * 18, 0, Math.PI * 2); g.fill(); } }
  const station = (cx) => {
    const by = SH * 0.8;
    g.fillStyle = SIL; g.fillRect(cx - 200, by - 260, 22, 260); g.fillRect(cx + 178, by - 260, 22, 260); g.fillRect(cx - 230, by - 300, 460, 40);
    g.beginPath(); g.moveTo(cx - 300, by - 300); g.quadraticCurveTo(cx, by - 330, cx + 300, by - 300); g.lineTo(cx + 250, by - 360); g.quadraticCurveTo(cx, by - 400, cx - 250, by - 360); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(cx - 310, by - 296); g.quadraticCurveTo(cx - 330, by - 310, cx - 335, by - 330); g.lineTo(cx - 290, by - 306); g.fill(); g.beginPath(); g.moveTo(cx + 310, by - 296); g.quadraticCurveTo(cx + 330, by - 310, cx + 335, by - 330); g.lineTo(cx + 290, by - 306); g.fill();
    g.fillRect(cx - 420, by - 140, 220, 140); g.fillRect(cx + 200, by - 140, 260, 140);   // 两边的院墙
    g.fillRect(cx + 330, by - 520, 8, 380);   // 旗杆
    g.fillStyle = "rgba(225,205,160,.95)"; g.beginPath(); g.moveTo(cx + 338, by - 515); g.lineTo(cx + 450, by - 500); g.lineTo(cx + 445, by - 430); g.lineTo(cx + 338, by - 440); g.closePath(); g.fill();
    brushText(g, "驿", cx + 392, by - 474, 58, { color: SIL });
    g.fillStyle = "rgba(255,190,110,.85)"; g.beginPath(); g.arc(cx - 120, by - 230, 14, 0, Math.PI * 2); g.fill();
  };
  const xs = []; for (let cx = 1500; cx < w - 300; cx += 2200) { station(cx); xs.push(cx); }
  return xs;
}
function standHorse(g, x, y, s) {
  // 站着的马（剪影，侧面朝右）+ 牵马的人
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = SIL;
  fillPath(g, smooth([[48, -62], [55, -80], [72, -118], [80, -112], [92, -104], [96, -110], [90, -118], [70, -140], [62, -150], [56, -134], [42, -108], [24, -100], [-10, -96], [-40, -98], [-56, -86], [-60, -66], [-50, -56], [-10, -52], [30, -54]], 4, true), SIL);
  for (const lx of [-46, -36, 34, 44]) { stroke(g, [[lx, -60], [lx + 2, -30], [lx, 0]], 9, 6, SIL); g.fillRect(lx - 5, -3, 11, 4); }
  stroke(g, smooth([[-56, -88], [-70, -76], [-78, -50]], 4), 9, 3, SIL);
  g.fillStyle = "rgba(120,60,40,.9)"; g.fillRect(-14, -108, 34, 10);   // 鞍
  g.restore();
}
export function buildStation() {
  const st = new Stage(30), W2 = SW * 3.2;
  st.layer(basic(T(canvasOf(stationSky))), -900, 1.2);
  let xs; const landC = canvasOf((g) => { xs = stationLand(g, W2); }, W2, SH, 0.5);
  const s0 = st.pxScale(0, 1.12), land = new THREE.Mesh(new THREE.PlaneGeometry(W2 * s0, SH * s0), basic(T(landC))); st.scene.add(land);
  const waitT = TM(canvasOf((g) => { standHorse(g, 300, 470, 2.2); figureArt(g, 120, 470, 3.4, "stand", 0, { color: SIL }); }, 560, 520, 1));
  const wait = sprite(st, waitT, 560, 520, { z: 4, anchor: [0.5, 0.9] });
  const sheet = sheetOf(12, 384, (g, ph, sz) => riderArt(g, sz * 0.5, sz * 0.92, sz / 240, ph, { cargo: "tube", color: SIL, far: "#3a3028", robe: "#2a2018" }));
  const mkRider = () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: sheet.t.clone(), transparent: true, depthWrite: false })); m.material.map.needsUpdate = true; m.geometry.translate(0, 0.42, 0); st.scene.add(m); return m; };
  const A = mkRider(), B = mkRider();
  const tubeT = TM(canvasOf((g) => { g.fillStyle = "#b3a865"; g.fillRect(10, 20, 100, 30); g.fillStyle = VERM; g.fillRect(48, 14, 22, 42); g.beginPath(); g.arc(112, 35, 12, 0, Math.PI * 2); g.fill(); }, 130, 70, 1));
  const tube = sprite(st, tubeT, 130, 70, { z: 6 });
  const li = sprite(st, T(canvasOf((g) => { g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(20, 40); g.lineTo(20, 70); g.lineTo(980, 70); g.lineTo(980, 40); g.stroke(); g.fillStyle = "rgba(242,231,201,.95)"; g.fillRect(380, 30, 240, 80); brushText(g, "三十里", 500, 72, 64, { color: VERM }); }, 1000, 130, 1)), 1000, 130, { z: 7, opacity: 0 });
  const station0 = xs[0];
  st.update = (t) => {
    // 横向平移：0–5.2 秒停在第一座驿站前；之后跟着新换的马往右飞快地过下一座、再下一座
    const pan = t < 5.2 ? 0 : Math.pow(seg(t, 5.2, 7.2), 1.4) * (xs[1] - xs[0]) * 1.05;
    const sx = (station0 - SW * 0.55) + pan, worldX = (x) => (x - sx);
    land.position.copy(st.px(W2 / 2 - sx, SH / 2, 0));
    const gateX = worldX(station0), by = SH * 0.8;
    wait.at(gateX + 220, by + 4); wait.visible = t < 4.45;
    const fr = (m, x, y, size, flip, tt) => { m.scale.set((flip ? -1 : 1) * size * s0, size * s0, 1); m.position.copy(st.px(x, y, 5)); m.material.map.offset.x = (Math.floor(tt * 15) % 12) / 12; };
    const ax = lerp(-400, gateX - 60, easeOut(seg(t, 2.9, 4.0))); A.visible = t > 2.9; fr(A, ax, by + 6, 430, false, t < 4.0 ? t : 4.0);
    const bx = t < 4.45 ? gateX + 220 : gateX + 220 + Math.pow(seg(t, 4.45, 7.2), 1.2) * 2600; B.visible = t >= 4.45; fr(B, bx - pan * 0, by + 6, 430, false, t);
    const tk = ease(seg(t, 4.0, 4.45)), tx = lerp(ax - 40, gateX + 180, tk), ty = lerp(by - 250, by - 250, tk) - Math.sin(tk * Math.PI) * 90;
    tube.visible = t > 3.95 && t < 4.5; tube.at(tx, ty);
    // 标尺放在驿站上方，避开字幕和底部暗角。
    li.at(worldX((xs[0] + xs[1]) / 2), by - 420); li.material.opacity = seg(t, 5.6, 6.0);
    st.camera.position.set(0, 0, st.D * lerp(1, 0.94, seg(t, 0, 4))); st.camera.lookAt(0, 0, 0);
    st.look = { blur: 0.0025, focus: 0.62, band: 0.25 };
  };
  return st;
}

// ───────────── 12 白天跑，夜里也跑（3.2 秒）─────────────
function rideSky(g, k) {
  // k：0 白天，1 黄昏，2 夜里
  const C = [[["#cfc2a2", 0], ["#efdcae", 0.7], ["#f2e0b6", 1]], [["#8e8098", 0], ["#e3a07a", 0.6], ["#f0c08a", 1]], [["#141a2c", 0], ["#2a3248", 0.65], ["#3e4256", 1]]][k];
  const gr = g.createLinearGradient(0, 0, 0, SH); C.forEach(([c, o]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, SW, SH);
  if (k === 0) { g.fillStyle = "rgba(255,246,220,.9)"; g.beginPath(); g.arc(SW * 0.78, SH * 0.22, 50, 0, Math.PI * 2); g.fill(); }
  if (k === 1) { const sx = SW * 0.2, sy = SH * 0.66, h = g.createRadialGradient(sx, sy, 10, sx, sy, 520); h.addColorStop(0, "rgba(255,200,140,.95)"); h.addColorStop(1, "rgba(255,200,140,0)"); g.fillStyle = h; g.fillRect(0, 0, SW, SH); g.fillStyle = "rgba(230,110,70,.95)"; g.beginPath(); g.arc(sx, sy, 60, 0, Math.PI * 2); g.fill(); }
  if (k === 2) { const R = rng(8); for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,250,235,${0.2 + R() * 0.7})`; g.fillRect(R() * SW, R() * SH * 0.62, 2 + R() * 2, 2 + R() * 2); } g.fillStyle = "rgba(250,240,210,.95)"; g.beginPath(); g.arc(SW * 0.72, SH * 0.2, 56, 0, Math.PI * 2); g.fill(); g.fillStyle = "#141a2c"; g.beginPath(); g.arc(SW * 0.72 + 22, SH * 0.2 - 10, 50, 0, Math.PI * 2); g.fill(); }
  silk(g, SW, SH, { tone: null, vign: 0.3, seed: 77, fibers: 0.4 });
}
function rideHills(g, w, col, y0, amp, seed) { g.fillStyle = col; g.beginPath(); g.moveTo(0, SH); for (let x = 0; x <= w; x += 24) g.lineTo(x, y0 - Math.abs(Math.sin(x * 0.0018 + seed)) * amp - Math.sin(x * 0.009 + seed * 2) * amp * 0.15); g.lineTo(w, SH); g.closePath(); g.fill(); }
export function buildRide() {
  const st = new Stage(30), W2 = SW * 2;
  const skyMat = new THREE.ShaderMaterial({ uniforms: { t0: { value: T(canvasOf((g) => rideSky(g, 0))) }, t1: { value: T(canvasOf((g) => rideSky(g, 1))) }, t2: { value: T(canvasOf((g) => rideSky(g, 2))) }, uK: { value: 0 } }, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D t0, t1, t2; uniform float uK; varying vec2 vUv; void main(){ vec3 a = texture2D(t0, vUv).rgb, b = texture2D(t1, vUv).rgb, c = texture2D(t2, vUv).rgb; gl_FragColor = vec4(uK < 1.0 ? mix(a, b, uK) : mix(b, c, uK - 1.0), 1.0); }` });
  st.layer(skyMat, -900, 1.2);
  const mkLayer = (draw, z, wrapK) => { const c = canvasOf((g) => draw(g), W2, SH, 0.5), t = T(c), s = st.pxScale(z, 1.16), m = new THREE.Mesh(new THREE.PlaneGeometry(W2 * s, SH * s), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); m.position.z = z; st.scene.add(m); m.userData = { s, wrapK }; return m; };
  const far = mkLayer((g) => rideHills(g, W2, "rgba(60,52,60,.55)", SH * 0.62, 160, 1), -500), mid = mkLayer((g) => rideHills(g, W2, "rgba(30,26,26,.85)", SH * 0.74, 90, 3), -200), near = mkLayer((g) => { rideHills(g, W2, SIL, SH * 0.84, 22, 5); const R = rng(4); g.fillStyle = SIL; for (let x = 0; x < W2; x += 60 + R() * 200) { const h = 40 + R() * 160; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + (R() - 0.5) * 50, SH * 0.84 - h + (R() - 0.3) * 40, 14 + R() * 20, 0, Math.PI * 2); g.fill(); } g.fillRect(x - 3, SH * 0.84 - h, 6, h); } }, 0);
  const night = st.layer(new THREE.MeshBasicMaterial({ color: 0x0a0e1c, transparent: true, opacity: 0, depthWrite: false }), 40, 1.2);
  const sheet = sheetOf(12, 384, (g, ph, sz) => riderArt(g, sz * 0.5, sz * 0.92, sz / 240, ph, { cargo: "tube", color: SIL, far: "#3a3028", robe: "#2a2018" }));
  const s0 = st.pxScale(30, 1.12), rider = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: sheet.t, transparent: true, depthWrite: false })); rider.geometry.translate(0, 0.42, 0); st.scene.add(rider);
  const torch = sprite(st, T(canvasOf((g) => { const gr = g.createRadialGradient(150, 150, 4, 150, 150, 150); gr.addColorStop(0, "rgba(255,230,170,1)"); gr.addColorStop(0.25, "rgba(255,150,70,.7)"); gr.addColorStop(1, "rgba(255,120,50,0)"); g.fillStyle = gr; g.fillRect(0, 0, 300, 300); }, 300, 300, 1)), 520, 520, { z: 32, opacity: 0 });
  torch.material.blending = THREE.AdditiveBlending;
  st.update = (t) => {
    const k = clamp(seg(t, 0.4, 1.4) + seg(t, 1.6, 2.5), 0, 2); skyMat.uniforms.uK.value = k;
    for (const [m, sp] of [[far, 120], [mid, 420], [near, 1100]]) { const x = ((t * sp) % (W2 / 2)) ; m.position.x = (W2 / 4 - x) * m.userData.s * 0.5 + 0; }
    night.material.opacity = 0.35 * seg(k, 1.2, 2);
    const p = st.px(SW * 0.5, SH * 0.86, 30); rider.position.copy(p); rider.scale.set(520 * s0, 520 * s0, 1); sheet.t.offset.x = (Math.floor(t * 16) % 12) / 12;
    torch.at(SW * 0.5 + 60, SH * 0.86 - 330); torch.material.opacity = seg(k, 1.5, 2) * (0.85 + 0.15 * Math.sin(t * 23));
    st.camera.position.set(0, 0, st.D); st.camera.lookAt(0, 0, 0);
    st.look = { blur: 0.002, focus: 0.7, band: 0.25 };
  };
  return st;
}

// ───────────── 16 一路上跑死了多少马，没人算过（3.6 秒）─────────────
function fallenArt(g) {
  const gr = g.createLinearGradient(0, 0, 0, SH); gr.addColorStop(0, "#7d7a86"); gr.addColorStop(0.55, "#b9ad9e"); gr.addColorStop(1, "#cbbfa8"); g.fillStyle = gr; g.fillRect(0, 0, SW, SH);
  const ridge = (y0, amp, col, seed) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, SH); for (let x = 0; x <= SW; x += 20) g.lineTo(x, y0 - Math.abs(Math.sin(x * 0.0024 + seed)) * amp - Math.sin(x * 0.01 + seed) * amp * 0.1); g.lineTo(SW, SH); g.closePath(); g.fill(); };
  ridge(SH * 0.48, 260, "rgba(110,106,116,.55)", 1); ridge(SH * 0.58, 200, "rgba(86,82,90,.6)", 2);
  const mist = g.createLinearGradient(0, SH * 0.55, 0, SH * 0.72); mist.addColorStop(0, "rgba(220,214,204,0)"); mist.addColorStop(0.5, "rgba(220,214,204,.7)"); mist.addColorStop(1, "rgba(220,214,204,0)"); g.fillStyle = mist; g.fillRect(0, SH * 0.52, SW, SH * 0.24);
  ridge(SH * 0.78, 60, "#3a3632", 3);
  g.fillStyle = "#2a2622"; g.fillRect(0, SH * 0.84, SW, SH * 0.16);
  // 枯树
  stroke(g, smooth([[SW * 0.82, SH * 0.84], [SW * 0.81, SH * 0.6], [SW * 0.84, SH * 0.42]], 6), 30, 10, "#1e1a17"); for (const [a, l] of [[-0.9, 160], [0.7, 140], [-0.3, 120], [1.1, 90]]) stroke(g, [[SW * 0.82, SH * 0.58], [SW * 0.82 + Math.sin(a) * l, SH * 0.58 - Math.cos(a) * l]], 9, 2, "#1e1a17");
  // 浅色路面衬出马的暗轮廓；抬高主体，给下方字幕留出空间。
  const road = g.createLinearGradient(0, SH * 0.66, 0, SH); road.addColorStop(0, "#b3a087"); road.addColorStop(1, "#67594b");
  g.fillStyle = road; g.beginPath(); g.moveTo(0, SH * 0.87);
  g.bezierCurveTo(SW * 0.18, SH * 0.82, SW * 0.26, SH * 0.66, SW * 0.46, SH * 0.66);
  g.bezierCurveTo(SW * 0.65, SH * 0.65, SW * 0.76, SH * 0.8, SW, SH * 0.85);
  g.lineTo(SW, SH); g.lineTo(0, SH); g.closePath(); g.fill();
  // 倒在路边的马：四肢分开弯折，保留可辨认的耳、吻、鬃、尾。
  g.save(); g.translate(SW * 0.44, SH * 0.66); g.scale(2.6, 2.6);
  const horseInk = "#19130f", rim = "#b6a082";
  const legs = [
    [[-68, -4], [-99, 19], [-79, 47], [-65, 48]],
    [[-46, 4], [-69, 27], [-43, 59], [-28, 57]],
    [[26, 7], [59, 29], [87, 48], [103, 44]],
    [[46, 3], [82, 18], [114, 35], [130, 30]],
  ];
  for (let i = 0; i < legs.length; i++) {
    stroke(g, legs[i], 14, 12, rim);
    stroke(g, legs[i], 10, 8, horseInk);
    stroke(g, legs[i].slice(-2), 14, 12, horseInk);
  }
  const body = smooth([[-92, -10], [-85, -39], [-55, -58], [-7, -61], [38, -54], [64, -42], [83, -48], [106, -33], [126, -14], [132, -19], [133, -34], [139, -21], [143, -37], [149, -18], [168, -11], [184, 2], [181, 15], [165, 18], [143, 8], [121, 5], [99, 8], [78, 17], [32, 20], [-26, 19], [-70, 9]], 5, true);
  stroke(g, body, 4, 4, rim); fillPath(g, body, horseInk);
  stroke(g, smooth([[-87, -24], [-112, -16], [-133, -1], [-153, 3]], 4), 11, 3, horseInk);
  for (let i = 0; i < 5; i++) stroke(g, [[59 + i * 8, -42 + i * 2], [55 + i * 9, -57 + i * 4]], 5, 1.5, horseInk);
  stroke(g, [[154, -5], [160, -3]], 2, 2, rim);
  g.restore();
  silk(g, SW, SH, { tone: null, vign: 0.45, seed: 64, fibers: 0.5 });
}
export function buildFallen() {
  const st = new Stage(30);
  st.layer(basic(T(canvasOf(fallenArt))), 0, 1.14);
  const crowT = TM(canvasOf((g) => { g.fillStyle = "#14110e"; g.beginPath(); g.moveTo(10, 30); g.quadraticCurveTo(40, 10, 60, 30); g.quadraticCurveTo(80, 10, 110, 30); g.quadraticCurveTo(80, 22, 60, 36); g.quadraticCurveTo(40, 22, 10, 30); g.fill(); }, 120, 50, 1));
  const crows = [0, 1, 2].map((i) => sprite(st, crowT, 120 - i * 20, 50 - i * 8, { z: 20 }));
  st.update = (t) => {
    crows.forEach((c, i) => { const a = t * (0.5 + i * 0.12) + i * 2.1; c.at(SW * (0.6 + i * 0.05) + Math.cos(a) * (260 - i * 50), SH * (0.24 + i * 0.04) + Math.sin(a) * 60); c.scale.y = 0.7 + 0.3 * Math.abs(Math.sin(t * 6 + i)); });
    const u = seg(t, 0, 3.6); cam(st, lerp(-60, 0, u), lerp(-20, -60, u), lerp(st.D, st.D * 0.86, ease(u)), lerp(-60, 0, u), lerp(-40, -90, u));
    st.look = { blur: 0.003, focus: 0.66, band: 0.2 };
  };
  return st;
}

// ───────────── 17 而吃下它，只要一口（3.2 秒）─────────────
export function buildPeel4() {
  const st = new Stage(30);
  let info; st.layer(basic(T(canvasOf((g) => { info = peeledScene(g); }))), 0, 1.12);
  const gl = canvasOf((g) => { const gr = g.createLinearGradient(0, 0, 400, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 400, 400); }, 400, 400, 1);
  const s = st.pxScale(0, 1.12), gleam = new THREE.Mesh(new THREE.PlaneGeometry(120 * s, 300 * s), new THREE.MeshBasicMaterial({ map: tex(gl), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); gleam.rotation.z = -0.5; st.scene.add(gleam);
  st.update = (t) => {
    const k = seg(t, 0.6, 1.8); gleam.position.copy(st.px(info.fx - 140 + k * 280, info.fy - 20, 3)); gleam.material.opacity = Math.sin(k * Math.PI) * 0.6;
    const f = st.px(info.fx + 60, info.fy + 40, 0), u = ease(seg(t, 0, 3.2));
    cam(st, lerp(0, f.x * 0.6, u), lerp(0, f.y * 0.6, u), lerp(st.D, st.D * 0.7, u), lerp(0, f.x * 0.6, u), lerp(0, f.y * 0.6, u));
    st.look = { blur: 0.005, focus: 0.5, band: 0.18 };
  };
  return st;
}
