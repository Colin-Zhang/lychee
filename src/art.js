// 画笔与图标：全部用 canvas 一笔笔画出来的原创造型（骑马的人、船、背瓮的挑夫、李善德的剪影、骆驼、荔枝、荔枝树……），给三维场景当贴图。
export const INK = "#211a13", VERM = "#b8342a", AZURE = "#3d6f8a", JADE = "#4f8a7a", OCHRE = "#b98d55", PAPER = "#e6d4aa";

export const rng = (s) => { let x = s >>> 0 || 1; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; };
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const mixRGB = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** 旧绢底：底色 + 绢纹 + 纤维 + 霉斑 + 四边发暗 */
export function silk(g, w, h, { tone = [230, 212, 170], seed = 1, vign = 0.32, fibers = 1 } = {}) {
  const R = rng(seed);
  if (tone) { g.fillStyle = rgb(tone); g.fillRect(0, 0, w, h); }   // tone 为 null 时只叠纹理
  const t = mk(6, 6), tg = t.getContext("2d");
  tg.fillStyle = "rgba(120,92,52,.09)"; tg.fillRect(0, 0, 6, 1); tg.fillRect(0, 3, 6, 1); tg.fillStyle = "rgba(255,248,228,.09)"; tg.fillRect(0, 0, 1, 6); tg.fillRect(3, 0, 1, 6);
  g.fillStyle = g.createPattern(t, "repeat"); g.fillRect(0, 0, w, h);
  const n = Math.round((w * h) / 70) * fibers;
  for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${105 + R() * 40},${82 + R() * 30},${48 + R() * 20},${0.03 + R() * 0.05})`; g.fillRect(R() * w, R() * h, 1 + R() * 6, 1); }
  for (let i = 0; i < 26; i++) { const x = R() * w, y = R() * h, r = 40 + R() * Math.max(w, h) * 0.12, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(135,100,58,${0.04 + R() * 0.06})`); gr.addColorStop(1, "rgba(135,100,58,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  if (vign) { const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72); vg.addColorStop(0, "rgba(80,52,24,0)"); vg.addColorStop(1, `rgba(80,52,24,${vign})`); g.fillStyle = vg; g.fillRect(0, 0, w, h); }
}

/** Catmull-Rom 平滑一串点 */
export function smooth(pts, per = 8, closed = false) {
  const P = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  const out = [];
  for (let i = 1; i < P.length - 2; i++) for (let k = 0; k < per; k++) {
    const t = k / per, t2 = t * t, t3 = t2 * t, [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    out.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
  }
  if (!closed) out.push(pts[pts.length - 1]);
  return out;
}
/** 一笔：粗细从 w0 渐变到 w1（毛笔起收），两头圆 */
export function stroke(g, pts, w0, w1 = w0, color = INK, alpha = 1) {
  if (pts.length < 2) return;
  const n = pts.length, L = [], Rr = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const w = lerp(w0, w1, i / (n - 1)) / 2, nx = -dy / d, ny = dx / d;
    L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); Rr.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  g.save(); g.globalAlpha = alpha; g.fillStyle = color; g.beginPath(); g.moveTo(...L[0]); for (const p of L) g.lineTo(...p); for (const p of Rr.reverse()) g.lineTo(...p); g.closePath(); g.fill();
  g.beginPath(); g.arc(pts[0][0], pts[0][1], w0 / 2, 0, Math.PI * 2); g.arc(pts[n - 1][0], pts[n - 1][1], w1 / 2, 0, Math.PI * 2); g.fill(); g.restore();
}
export function fillPath(g, pts, color, closed = true) { g.fillStyle = color; g.beginPath(); g.moveTo(...pts[0]); for (const p of pts) g.lineTo(...p); if (closed) g.closePath(); g.fill(); }
export function linePath(g, pts, color, w) { g.strokeStyle = color; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(...pts[0]); for (const p of pts) g.lineTo(...p); g.stroke(); }

/** 毛笔字：横排或竖排 */
export function brushText(g, txt, x, y, size, { color = INK, vertical = false, gap = 1.06, align = "center", font = "Brush", alpha = 1 } = {}) {
  g.save(); g.globalAlpha = alpha; g.fillStyle = color; g.font = `${size}px "${font}"`; g.textBaseline = "middle";
  if (vertical) { g.textAlign = "center"; [...txt].forEach((ch, i) => g.fillText(ch, x, y + i * size * gap)); }
  else { g.textAlign = align; g.fillText(txt, x, y); }
  g.restore();
}
/** 印章：方印（2–4 字）或圆印 */
export function seal(txt, size, { round = false, color = VERM, white = false } = {}) {
  const c = mk(size, size), g = c.getContext("2d"), R = rng(txt.charCodeAt(0));
  const inset = size * 0.06;
  g.fillStyle = color;
  if (round) { g.beginPath(); g.arc(size / 2, size / 2, size / 2 - inset, 0, Math.PI * 2); white ? g.fill() : (g.lineWidth = size * 0.07, g.strokeStyle = color, g.stroke()); }
  else if (white) g.fillRect(inset, inset, size - 2 * inset, size - 2 * inset);
  else { g.lineWidth = size * 0.07; g.strokeStyle = color; g.strokeRect(inset * 1.4, inset * 1.4, size - 2.8 * inset, size - 2.8 * inset); }
  g.fillStyle = white ? "#f3e6c8" : color; g.font = `${size * (txt.length <= 1 ? 0.62 : txt.length === 2 ? 0.4 : 0.36)}px "Brush"`; g.textAlign = "center"; g.textBaseline = "middle";
  const ch = [...txt];
  if (ch.length === 1) g.fillText(ch[0], size / 2, size / 2 + size * 0.02);
  else if (ch.length === 2) { g.fillText(ch[0], size / 2, size * 0.32); g.fillText(ch[1], size / 2, size * 0.7); }
  else if (ch.length === 3) { g.fillText(ch[0], size * 0.7, size * 0.32); g.fillText(ch[1], size * 0.7, size * 0.7); g.font = `${size * 0.5}px "Brush"`; g.fillText(ch[2], size * 0.3, size * 0.52); }
  else { g.fillText(ch[0], size * 0.7, size * 0.32); g.fillText(ch[1], size * 0.7, size * 0.7); g.fillText(ch[2], size * 0.3, size * 0.32); g.fillText(ch[3], size * 0.3, size * 0.7); }
  // 印泥不匀：随机擦掉一些
  g.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(0,0,0,${0.15 + R() * 0.5})`; g.beginPath(); g.arc(R() * size, R() * size, 0.5 + R() * size * 0.025, 0, Math.PI * 2); g.fill(); }
  return c;
}

// ───────────────── 荔枝 ─────────────────
/** 一颗荔枝（外壳的龟裂纹、高光、果柄、叶子）。ripe：0 青 → 1 红；age：0 新鲜 → 3 三日后（变褐、失光、起皱） */
export function lycheeArt(g, cx, cy, r, { ripe = 1, age = 0, seed = 3, leaf = true, stem = true } = {}) {
  const R = rng(seed);
  const red = [198, 38, 34], green = [150, 172, 78], brown = [112, 58, 36], dull = [150, 48, 40];
  const a1 = clamp(age), a2 = clamp(age - 1), a3 = clamp(age - 2);
  let base = mixRGB(green, red, ripe); base = mixRGB(base, dull, a1 * 0.7); base = mixRGB(base, brown, a2 * 0.6 + a3 * 0.4);
  const rr = r * (1 - a3 * 0.06);
  const shape = () => { g.beginPath(); for (let i = 0; i <= 64; i++) { const t = (i / 64) * Math.PI * 2, wob = 1 + Math.sin(t * 3 + seed) * 0.015 + (a3 * Math.sin(t * 7 + seed * 2) * 0.03); const y = Math.sin(t) * rr * 1.04 * wob + Math.max(0, Math.sin(t)) * rr * 0.08, x = Math.cos(t) * rr * wob; i ? g.lineTo(cx + x, cy + y) : g.moveTo(cx + x, cy + y); } g.closePath(); };
  // 叶子在后
  if (leaf) {
    const lf = (ang, len, wd) => { g.save(); g.translate(cx + rr * 0.05, cy - rr * 1.02); g.rotate(ang); const gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, "#3d5a2e"); gr.addColorStop(1, "#6e8f45"); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -wd, len, 0); g.quadraticCurveTo(len * 0.5, wd * 0.9, 0, 0); g.fill(); g.strokeStyle = "rgba(30,40,20,.6)"; g.lineWidth = Math.max(1, r * 0.015); g.beginPath(); g.moveTo(0, 0); g.lineTo(len * 0.95, 0); g.stroke(); g.restore(); };
    lf(-2.6, rr * 1.5, rr * 0.32); lf(-0.55, rr * 1.35, rr * 0.28);
  }
  // 果身
  g.save(); shape();
  const gr = g.createRadialGradient(cx - rr * 0.35, cy - rr * 0.4, rr * 0.1, cx, cy, rr * 1.15);
  gr.addColorStop(0, rgb(mixRGB(base, [255, 210, 180], 0.35 * (1 - a2)))); gr.addColorStop(0.55, rgb(base)); gr.addColorStop(1, rgb(mixRGB(base, [40, 10, 8], 0.55)));
  g.fillStyle = gr; g.fill(); g.clip();
  // 龟裂纹：六角格子，每格一个小凸起
  const d = rr * 0.16;
  for (let row = -8; row <= 8; row++) for (let col = -8; col <= 8; col++) {
    const x = cx + col * d * 0.87 + (row % 2 ? d * 0.43 : 0) + (R() - 0.5) * d * 0.2, y = cy + row * d * 0.75 + (R() - 0.5) * d * 0.2;
    const dist = Math.hypot((x - cx) / rr, (y - cy) / (rr * 1.05)); if (dist > 1.02) continue;
    const local = clamp(ripe * 1.5 - R() * 0.7), cc = mixRGB(mixRGB(green, red, local), base, 0.55 + a1 * 0.2);
    const k = 0.55 * (1 - dist * 0.35);
    g.beginPath(); for (let i = 0; i < 6; i++) { const t = (i / 6) * Math.PI * 2 + 0.5; const rad = d * k * (i === 4 ? 1.25 : 1); i ? g.lineTo(x + Math.cos(t) * rad, y + Math.sin(t) * rad) : g.moveTo(x + Math.cos(t) * rad, y + Math.sin(t) * rad); } g.closePath();
    g.fillStyle = rgb(cc, 0.85); g.fill();
    g.strokeStyle = `rgba(60,14,10,${0.45 - a3 * 0.1})`; g.lineWidth = Math.max(0.6, d * 0.09); g.stroke();
    g.fillStyle = `rgba(255,220,200,${0.28 * (1 - a2) * (1 - dist)})`; g.beginPath(); g.arc(x - d * 0.12, y - d * 0.14, d * 0.16, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(40,8,6,.55)"; g.beginPath(); g.arc(x + d * 0.05, y + d * 0.04, d * 0.05, 0, Math.PI * 2); g.fill();
  }
  // 边缘暗、褐斑、皱纹
  const eg = g.createRadialGradient(cx, cy, rr * 0.55, cx, cy, rr * 1.08); eg.addColorStop(0, "rgba(30,6,4,0)"); eg.addColorStop(1, "rgba(30,6,4,.45)"); g.fillStyle = eg; g.fillRect(cx - rr * 1.3, cy - rr * 1.3, rr * 2.6, rr * 2.6);
  if (a2 > 0) for (let i = 0; i < 14; i++) { const x = cx + (R() - 0.5) * rr * 1.6, y = cy + (R() - 0.5) * rr * 1.6, s = rr * (0.08 + R() * 0.2); const sg = g.createRadialGradient(x, y, 0, x, y, s); sg.addColorStop(0, `rgba(70,36,20,${0.55 * a2})`); sg.addColorStop(1, "rgba(70,36,20,0)"); g.fillStyle = sg; g.fillRect(x - s, y - s, 2 * s, 2 * s); }
  if (a3 > 0) { g.strokeStyle = `rgba(40,18,10,${0.5 * a3})`; g.lineWidth = rr * 0.02; for (let i = 0; i < 9; i++) { const x = cx + (R() - 0.5) * rr * 1.4, y = cy + (R() - 0.5) * rr * 1.4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + rr * 0.15, y + rr * (R() - 0.5) * 0.3, x + rr * 0.3 * (R() - 0.2), y + rr * 0.25); g.stroke(); } }
  g.restore();
  // 高光
  const gloss = 0.4 * (1 - a1 * 0.5) * (1 - a2 * 0.8);
  if (gloss > 0.02) { const hg = g.createRadialGradient(cx - rr * 0.38, cy - rr * 0.45, 0, cx - rr * 0.38, cy - rr * 0.45, rr * 0.45); hg.addColorStop(0, `rgba(255,245,235,${gloss})`); hg.addColorStop(1, "rgba(255,245,235,0)"); g.fillStyle = hg; g.beginPath(); g.ellipse(cx - rr * 0.38, cy - rr * 0.45, rr * 0.4, rr * 0.28, -0.6, 0, Math.PI * 2); g.fill(); }
  if (stem) stroke(g, smooth([[cx + rr * 0.02, cy - rr * 0.98], [cx + rr * 0.05, cy - rr * 1.18], [cx + rr * 0.16, cy - rr * 1.36]], 6), rr * 0.09, rr * 0.06, "#5b3d22");
}
export function lychee(size, opt = {}) { const c = mk(size, size), g = c.getContext("2d"); lycheeArt(g, size / 2, size * 0.56, size * 0.3, opt); return c; }

// 骑马的人、马：见 horse.js（按真实袭步画的）

// ───────────────── 船、挑夫、人物、骆驼 ─────────────────
export function boatArt(g, x, y, s, phase = 0, { color = INK, accent = VERM } = {}) {
  g.save(); g.translate(x, y); g.scale(s, s); g.translate(0, Math.sin(phase * Math.PI * 2) * 1.5);
  fillPath(g, smooth([[-70, -18], [70, -22], [56, -4], [-52, -2]], 6, true), color);
  g.fillStyle = "#6b4630"; g.fillRect(-26, -40, 34, 20); g.strokeStyle = color; g.lineWidth = 2; g.strokeRect(-26, -40, 34, 20);
  stroke(g, [[18, -20], [18, -118]], 4, 3, color);
  fillPath(g, [[20, -112], [58, -104], [56, -36], [20, -32]], "rgba(214,196,150,.95)"); g.strokeStyle = color; g.lineWidth = 2.2; g.beginPath(); g.moveTo(20, -112); g.lineTo(58, -104); g.lineTo(56, -36); g.lineTo(20, -32); g.stroke();
  for (let i = 1; i < 5; i++) { const yy = lerp(-110, -34, i / 5); g.beginPath(); g.moveTo(20, yy); g.lineTo(57, yy + 6); g.stroke(); }
  fillPath(g, [[18, -118], [36, -128], [18, -132]], accent);
  g.strokeStyle = "rgba(61,111,138,.6)"; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-70 + i * 30, 4, 10, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
  g.restore();
}
/** 船尾摇橹的船夫（戴斗笠，弓步，双手推橹；橹从手里斜着伸到船后的水里）。脚在 (x, y)，面朝 +x */
export function boatmanArt(g, x, y, s, phase, { color = INK } = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const a = Math.sin(phase * Math.PI * 2), lean = 0.18 + a * 0.12;
  stroke(g, [[-4, -46], [-16, -24], [-20, 0]], 9, 6, "#4a3e33"); stroke(g, [[-4, -46], [10, -24], [16, 0]], 9, 6, color);
  g.fillStyle = color; g.fillRect(-26, -3, 11, 4); g.fillRect(12, -3, 11, 4);
  g.save(); g.translate(-4, -46); g.rotate(lean);
  fillPath(g, smooth([[-9, 2], [-8, -30], [0, -40], [9, -30], [10, 2]], 4, true), color);
  g.beginPath(); g.arc(1, -48, 7, 0, Math.PI * 2); g.fill();
  fillPath(g, [[-17, -51], [1, -64], [19, -51]], "#8a6a3e"); g.strokeStyle = color; g.lineWidth = 2; g.beginPath(); g.moveTo(-17, -51); g.lineTo(1, -64); g.lineTo(19, -51); g.closePath(); g.stroke();
  const lx = 22 + a * 8, ly = -26 - a * 2;
  stroke(g, [[2, -34], [12, -26], [lx, ly]], 5.5, 4, color); stroke(g, [[-2, -32], [8, -22], [lx - 3, ly + 2]], 5, 4, color);
  g.restore();
  const hx = -4 + Math.cos(lean) * lx - Math.sin(lean) * ly, hy = -46 + Math.sin(lean) * lx + Math.cos(lean) * ly;
  stroke(g, [[hx, hy], [-36, -6], [-118, 44 + a * 4]], 3.4, 2.6, "#3a2a1c");
  fillPath(g, [[-104, 36 + a * 4], [-124, 42 + a * 4], [-128, 52 + a * 4], [-108, 48 + a * 4]], "#3a2a1c");
  g.restore();
}
export function boatSprite(size, phase) { const c = mk(size, size), g = c.getContext("2d"); boatArt(g, size * 0.5, size * 0.86, size / 180, phase); return c; }

/** 背瓮的挑夫（戴斗笠，弯腰，一步一步往上走） */
export function porterArt(g, x, y, s, phase, { color = INK } = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const a = Math.sin(phase * Math.PI * 2) * 0.45, b = -a;
  const leg = (ang, col) => { const kx = Math.sin(ang) * 22, ky = -48 + Math.cos(ang) * 22, fx = kx + Math.sin(ang - 0.35) * 24, fy = ky + Math.cos(ang - 0.35) * 24; stroke(g, [[0, -48], [kx, ky], [fx, fy]], 8, 5, col); g.fillStyle = col; g.fillRect(fx - 2, fy - 2, 9, 4); };
  leg(b, "#5a4c3f");
  stroke(g, [[0, -48], [14, -82]], 14, 11, color);
  leg(a, color);
  stroke(g, [[12, -78], [24, -62], [20, -54]], 6, 4, color);
  g.fillStyle = color; g.beginPath(); g.arc(24, -90, 7, 0, Math.PI * 2); g.fill();
  fillPath(g, [[8, -94], [26, -110], [42, -92]], "#8a6a3e"); g.strokeStyle = color; g.lineWidth = 2; g.beginPath(); g.moveTo(8, -94); g.lineTo(26, -110); g.lineTo(42, -92); g.closePath(); g.stroke();
  g.save(); g.translate(-6, -84); g.rotate(-0.35);
  fillPath(g, smooth([[-10, -20], [10, -20], [15, -6], [13, 14], [0, 22], [-13, 14], [-15, -6]], 4, true), "#6b4630");
  g.strokeStyle = "rgba(160,130,80,.9)"; g.lineWidth = 1.6; for (let i = -12; i <= 12; i += 6) { g.beginPath(); g.moveTo(i, -18); g.lineTo(i * 0.8, 18); g.stroke(); } for (let j = -12; j <= 14; j += 7) { g.beginPath(); g.moveTo(-14, j); g.lineTo(14, j); g.stroke(); }
  g.fillStyle = VERM; g.fillRect(-8, -24, 16, 5);
  // 插在瓮里的荔枝枝
  stroke(g, [[0, -22], [3, -36], [8, -44]], 2.4, 1.4, "#4a3420"); g.fillStyle = "#5f7d3a"; g.beginPath(); g.ellipse(10, -46, 7, 3, -0.5, 0, Math.PI * 2); g.fill(); g.fillStyle = VERM; g.beginPath(); g.arc(4, -40, 2.6, 0, Math.PI * 2); g.arc(8, -38, 2.4, 0, Math.PI * 2); g.fill();
  g.restore();
  g.strokeStyle = color; g.lineWidth = 2.5; g.beginPath(); g.moveTo(16, -80); g.lineTo(-2, -74); g.stroke();
  g.restore();
}
export function porterSprite(size, phase) { const c = mk(size, size), g = c.getContext("2d"); porterArt(g, size * 0.5, size * 0.92, size / 150, phase); return c; }

/** 李善德的剪影：圆领长袍、幞头。pose：stand（双手捧公文）、bow（躬身）、plant（弯腰种树）、walk */
export function figureArt(g, x, y, s, pose = "stand", phase = 0, { color = INK } = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  if (pose === "plant") {
    fillPath(g, smooth([[-14, 0], [-8, -44], [6, -62], [30, -70], [40, -62], [20, -48], [8, -26], [10, 0]], 4, true), color);
    g.beginPath(); g.arc(44, -66, 8, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(46, -72, 9, 5, 0.6, Math.PI, Math.PI * 2.1); g.fill();
    stroke(g, [[34, -62], [46, -40], [52, -16]], 6, 4, color); stroke(g, [[28, -58], [36, -36], [44, -14]], 6, 4, "#4a3e33");
  } else {
    const lean = pose === "bow" ? 0.35 : pose === "walk" ? 0.08 : 0.03;
    g.rotate(lean * 0.4);
    const sw = pose === "walk" ? Math.sin(phase * Math.PI * 2) * 6 : 0;
    fillPath(g, smooth([[-15 - sw * 0.3, 0], [-13, -40], [-11, -66], [0, -74], [12, -66], [14, -40], [16 + sw * 0.3, 0]], 4, true), color);
    g.fillStyle = "rgba(184,52,42,.85)"; g.fillRect(-12, -42, 25, 3);
    g.save(); g.translate(0, -74); g.rotate(lean);
    g.fillStyle = color; g.beginPath(); g.arc(1, -10, 8, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(1, -16, 9.5, 6, 0, Math.PI, Math.PI * 2); g.fill();
    stroke(g, [[-7, -15], [-18, -13], [-26, -16]], 2.2, 1, color); stroke(g, [[9, -15], [20, -13], [28, -16]], 2.2, 1, color);
    g.restore();
    if (pose === "stand" || pose === "bow") { stroke(g, [[-8, -62], [6, -50], [14, -54]], 6, 5, color); g.fillStyle = "#efe2c0"; g.fillRect(12, -64, 6, 18); g.strokeStyle = color; g.lineWidth = 1.5; g.strokeRect(12, -64, 6, 18); }
  }
  g.restore();
}
export function figureSprite(size, pose, phase) { const c = mk(size, size), g = c.getContext("2d"); figureArt(g, size * 0.5, size * 0.95, size / 110, pose, phase); return c; }

/** 双峰骆驼（站着，侧面） */
export function camelArt(g, x, y, s, { color = INK, fill = "#8a6a44" } = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const leg = (lx, col) => { stroke(g, [[lx, -56], [lx + 2, -28], [lx, 0]], 9, 6, col); g.fillStyle = col; g.fillRect(lx - 4, -3, 10, 4); };
  leg(-34, "#4a3e33"); leg(30, "#4a3e33");
  const body = smooth([[-50, -58], [-46, -74], [-34, -96], [-22, -78], [-8, -100], [6, -80], [26, -72], [44, -70], [56, -86], [62, -112], [76, -118], [84, -112], [76, -106], [70, -84], [60, -60], [40, -50], [-40, -48]], 4, true);
  fillPath(g, body, fill); g.strokeStyle = color; g.lineWidth = 3; g.beginPath(); body.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.closePath(); g.stroke();
  g.fillStyle = color; g.beginPath(); g.arc(77, -113, 2, 0, Math.PI * 2); g.fill();
  stroke(g, [[-50, -60], [-58, -48]], 4, 2, color);
  leg(-24, color); leg(40, color);
  g.restore();
}

// ───────────────── 荔枝树、树桩、新苗 ─────────────────
export function treeArt(g, x, y, s, seed = 1, { fruit = 1 } = {}) {
  const R = rng(seed);
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = "rgba(40,30,18,.18)"; g.beginPath(); g.ellipse(0, 2, 70, 12, 0, 0, Math.PI * 2); g.fill();
  stroke(g, smooth([[0, 0], [-4, -40], [2, -78]], 6), 16, 9, "#3b2a1c");
  for (const [a, l] of [[-0.9, 50], [0.8, 46], [-0.35, 40], [0.3, 44]]) stroke(g, [[0, -60], [Math.sin(a) * l, -60 - Math.cos(a) * l * 0.8]], 7, 3, "#3b2a1c");
  for (let i = 0; i < 70; i++) {
    const ang = R() * Math.PI * 2, rad = Math.sqrt(R()), cx = Math.cos(ang) * rad * 68, cy = -112 + Math.sin(ang) * rad * 46;
    const shade = cy < -120 ? 1 : 0.7;
    g.fillStyle = `rgba(${Math.round((44 + R() * 30) * shade)},${Math.round((72 + R() * 40) * shade)},${Math.round((40 + R() * 20) * shade)},.9)`;
    g.beginPath(); g.ellipse(cx, cy, 10 + R() * 9, 7 + R() * 5, R() * 3, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = "rgba(25,32,18,.55)"; g.lineWidth = 1.6; for (let i = 0; i < 26; i++) { const cx = (R() - 0.5) * 120, cy = -112 + (R() - 0.5) * 80; g.beginPath(); g.arc(cx, cy, 6 + R() * 6, Math.PI, Math.PI * 1.9); g.stroke(); }
  if (fruit) for (let i = 0; i < 40; i++) { const ang = R() * Math.PI * 2, rad = Math.sqrt(R()) * 0.9, cx = Math.cos(ang) * rad * 66, cy = -108 + Math.sin(ang) * rad * 44; for (let k = 0; k < 3; k++) { g.fillStyle = `rgba(${190 + R() * 40},${36 + R() * 20},${30},${0.85 * fruit})`; g.beginPath(); g.arc(cx + (R() - 0.5) * 8, cy + (R() - 0.5) * 6, 3 + R() * 1.6, 0, Math.PI * 2); g.fill(); } }
  g.restore();
}
export function stumpArt(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = "rgba(40,30,18,.18)"; g.beginPath(); g.ellipse(0, 2, 30, 6, 0, 0, Math.PI * 2); g.fill();
  fillPath(g, [[-14, 0], [-12, -26], [12, -30], [15, 0]], "#3b2a1c");
  stroke(g, [[-14, 0], [-26, 4]], 6, 2, "#3b2a1c"); stroke(g, [[14, 0], [27, 5]], 6, 2, "#3b2a1c");
  g.fillStyle = "#c9a774"; g.beginPath(); g.ellipse(0, -28, 12.5, 4.5, -0.15, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(90,60,30,.7)"; g.lineWidth = 1; for (let r = 3; r < 12; r += 3) { g.beginPath(); g.ellipse(0, -28, r, r * 0.36, -0.15, 0, Math.PI * 2); g.stroke(); }
  g.restore();
}
export function saplingArt(g, x, y, s, k = 1) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(s * k, s * k);
  stroke(g, smooth([[0, 0], [2, -18], [-1, -36]], 5), 3.4, 2, "#4a3420");
  for (const [yy, d] of [[-14, 1], [-20, -1], [-27, 1], [-33, -1], [-38, 1]]) { g.save(); g.translate(0, yy); g.rotate(d * 0.7); g.fillStyle = "#5f8a3a"; g.beginPath(); g.ellipse(d * 9, 0, 10, 3.6, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  g.restore();
}

/** 噪声遮罩（墨晕开的转场、画面一点点“显影”） */
export function noiseCanvas(w, h, seed = 5, { radial = 0.45 } = {}) {
  const c = mk(w, h), g = c.getContext("2d"), img = g.createImageData(w, h), R = rng(seed);
  const grid = (n) => { const a = new Float32Array((n + 1) * (n + 1)); for (let i = 0; i < a.length; i++) a[i] = R(); return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy); const v = (i, j) => a[Math.min(n, j) * (n + 1) + Math.min(n, i)]; return lerp(lerp(v(xi, yi), v(xi + 1, yi), ux), lerp(v(xi, yi + 1), v(xi + 1, yi + 1), ux), uy); }; };
  const octs = [[grid(6), 6, 0.5], [grid(14), 14, 0.25], [grid(36), 36, 0.15], [grid(90), 90, 0.1]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let n = 0; for (const [f, s, a] of octs) n += f((x / w) * s, (y / h) * s) * a;
    const d = Math.hypot(x / w - 0.5, (y / h - 0.5) * (h / w)) * 1.6;
    const v = clamp(n * (1 - radial) + d * radial);
    const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(v * 255); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return c;
}
