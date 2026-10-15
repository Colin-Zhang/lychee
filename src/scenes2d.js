// 插画场景（原创画面，canvas 绘制）：开场山水与黄土路、长安城坊图、公文、荔枝变色的底、双层瓮剖面图（可动）、春明门、剥开的荔枝、天平（可动）、荔枝园。
import { INK, VERM, AZURE, rng, clamp, lerp, mk, silk, smooth, stroke, fillPath, linePath, brushText, seal, lycheeArt, camelArt, figureArt } from "./art.js";

// 插画的逻辑画布 2560×1440；实际按 RES 倍分辨率画（默认 0.8 = 2048×1152；?res=0.5 低配检查）
export const SW = 2560, SH = 1440, RES = Number((typeof location !== "undefined" && new URLSearchParams(location.search).get("res")) || 0.8);

// ───────── 开场：天、远山、近山、黄土路 ─────────
export function skyLayer(g, { dusk = 0 } = {}) {
  const gr = g.createLinearGradient(0, 0, 0, SH);
  gr.addColorStop(0, `rgb(${lerp(226, 206, dusk)},${lerp(208, 170, dusk)},${lerp(168, 140, dusk)})`); gr.addColorStop(0.62, `rgb(${lerp(240, 232, dusk)},${lerp(224, 186, dusk)},${lerp(184, 140, dusk)})`); gr.addColorStop(1, "rgb(236,214,170)");
  g.fillStyle = gr; g.fillRect(0, 0, SW, SH);
  silk(g, SW, SH, { tone: null, vign: 0.18, seed: 11, fibers: 0.6 }); // 只叠纹理（底色被渐变覆盖前已画）
  const sx = SW * 0.7, sy = SH * (0.28 + dusk * 0.12), sr = SH * 0.07;
  const halo = g.createRadialGradient(sx, sy, sr * 0.8, sx, sy, sr * 4); halo.addColorStop(0, "rgba(214,90,50,.28)"); halo.addColorStop(1, "rgba(214,90,50,0)"); g.fillStyle = halo; g.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
  g.fillStyle = "rgba(196,58,40,.88)"; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
  // 祥云：几道卷云
  const cloud = (x, y, s) => { g.strokeStyle = "rgba(120,92,60,.32)"; g.lineWidth = 3; g.fillStyle = "rgba(250,240,220,.35)"; g.beginPath(); g.moveTo(x - 160 * s, y); g.bezierCurveTo(x - 120 * s, y - 40 * s, x - 60 * s, y - 40 * s, x - 40 * s, y - 10 * s); g.bezierCurveTo(x - 20 * s, y - 60 * s, x + 50 * s, y - 60 * s, x + 60 * s, y - 14 * s); g.bezierCurveTo(x + 100 * s, y - 40 * s, x + 160 * s, y - 20 * s, x + 170 * s, y); g.closePath(); g.fill(); g.stroke(); for (const [cx, cy, r] of [[x - 60, y - 22, 16], [x + 20, y - 34, 20]]) { g.beginPath(); g.arc(cx * 1, cy * 1, r * s, 0.2, Math.PI * 1.8); g.stroke(); } };
  cloud(SW * 0.22, SH * 0.2, 1.1); cloud(SW * 0.48, SH * 0.12, 0.8); cloud(SW * 0.88, SH * 0.18, 0.9);
}
/** 一道山脊（侧影），带晕染和勾线 */
function ridge(g, y0, amp, seed, top, bottom, { ink = 0.35, cun = 0, trees = 0 } = {}) {
  const R = rng(seed), pts = [];
  let y = y0; for (let x = -40; x <= SW + 40; x += 40) { y += (R() - 0.5) * amp * 0.5; y = lerp(y, y0 - amp * (0.4 + 0.6 * Math.abs(Math.sin(x / (240 + seed * 13) + seed))), 0.35); pts.push([x, y]); }
  const sm = smooth(pts, 6);
  const gr = g.createLinearGradient(0, y0 - amp, 0, y0 + amp * 1.2); gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.beginPath(); g.moveTo(-40, SH); sm.forEach((p) => g.lineTo(...p)); g.lineTo(SW + 40, SH); g.closePath(); g.fill();
  g.strokeStyle = `rgba(33,26,19,${ink})`; g.lineWidth = 3; g.beginPath(); sm.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.stroke();
  for (let i = 0; i < cun; i++) { const p = sm[Math.floor(R() * sm.length)]; const len = 40 + R() * 80; g.strokeStyle = `rgba(33,26,19,${ink * 0.6})`; g.lineWidth = 2; g.beginPath(); g.moveTo(p[0], p[1] + 6); g.quadraticCurveTo(p[0] + (R() - 0.5) * 30, p[1] + len * 0.5, p[0] + (R() - 0.5) * 40, p[1] + len); g.stroke(); }
  for (let i = 0; i < trees; i++) { const p = sm[Math.floor(R() * sm.length)]; g.fillStyle = "rgba(38,52,32,.7)"; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(p[0] + (R() - 0.5) * 20, p[1] - 6 + (R() - 0.5) * 10, 4 + R() * 4, 0, Math.PI * 2); g.fill(); } }
  return sm;
}
export function farLayer(g) {
  ridge(g, SH * 0.5, 120, 3, "rgba(150,176,160,.75)", "rgba(196,206,180,.0)", { ink: 0.18 });
  ridge(g, SH * 0.56, 150, 7, "rgba(112,150,132,.85)", "rgba(190,196,160,.0)", { ink: 0.25, cun: 30 });
}
export function midLayer(g) {
  ridge(g, SH * 0.63, 160, 13, "rgba(70,118,102,.95)", "rgba(198,168,112,.9)", { ink: 0.5, cun: 90, trees: 60 });
}
/** 地面与黄土路：返回路的中线（远 → 近），给骑手和荔枝定位 */
export function groundLayer(g) {
  const R = rng(21), hz = SH * 0.66;
  const gr = g.createLinearGradient(0, hz, 0, SH); gr.addColorStop(0, "rgba(206,176,118,.0)"); gr.addColorStop(0.08, "rgb(204,172,114)"); gr.addColorStop(1, "rgb(184,146,92)");
  g.fillStyle = gr; g.fillRect(0, hz - 10, SW, SH - hz + 10);
  for (let i = 0; i < 2600; i++) { const y = hz + Math.pow(R(), 1.6) * (SH - hz), x = R() * SW; g.fillStyle = `rgba(${120 + R() * 40},${90 + R() * 30},${50},${0.15 + R() * 0.2})`; g.fillRect(x, y, 2 + ((y - hz) / (SH - hz)) * 8, 1 + ((y - hz) / (SH - hz)) * 2); }
  // 路：近处宽、远处窄，弯向远方
  const center = smooth([[SW * 0.62, hz + 6], [SW * 0.58, hz + 60], [SW * 0.5, hz + 170], [SW * 0.4, hz + 330], [SW * 0.38, SH + 40]], 10);
  const left = [], right = [];
  center.forEach(([x, y], i) => { const k = (y - hz) / (SH - hz), w = lerp(8, 520, Math.pow(clamp(k), 1.2)); left.push([x - w / 2, y]); right.push([x + w / 2, y]); });
  const rg = g.createLinearGradient(0, hz, 0, SH); rg.addColorStop(0, "rgb(222,196,140)"); rg.addColorStop(1, "rgb(214,182,126)");
  g.fillStyle = rg; g.beginPath(); g.moveTo(...left[0]); left.forEach((p) => g.lineTo(...p)); right.slice().reverse().forEach((p) => g.lineTo(...p)); g.closePath(); g.fill();
  linePath(g, left, "rgba(90,66,40,.55)", 3); linePath(g, right, "rgba(90,66,40,.55)", 3);
  for (let i = 0; i < 160; i++) { const t = Math.pow(R(), 0.7), idx = Math.floor(t * (center.length - 1)), [x, y] = center[idx], k = (y - hz) / (SH - hz); g.strokeStyle = `rgba(120,90,56,${0.25 + R() * 0.2})`; g.lineWidth = 1 + k * 3; g.beginPath(); const ox = (R() - 0.5) * lerp(8, 480, k); g.moveTo(x + ox, y); g.lineTo(x + ox + lerp(2, 30, k), y + lerp(0.5, 4, k)); g.stroke(); }
  // 路边的草和树
  const tuft = (x, y, s) => { for (let k = 0; k < 6; k++) { g.strokeStyle = "rgba(70,84,40,.75)"; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(x + k * 3 * s, y); g.quadraticCurveTo(x + k * 3 * s - 4 * s, y - 14 * s, x + k * 3 * s + (k - 3) * 4 * s, y - 24 * s); g.stroke(); } };
  for (let i = 0; i < 70; i++) { const y = hz + 20 + Math.pow(R(), 1.3) * (SH - hz - 20), k = (y - hz) / (SH - hz), side = R() < 0.5 ? -1 : 1; const idx = center.findIndex((p) => p[1] >= y); const cx = center[Math.max(0, idx)][0]; tuft(cx + side * (lerp(20, 320, k) + R() * lerp(60, 600, k)), y, lerp(0.5, 2.2, k)); }
  const tree = (x, y, s) => { stroke(g, smooth([[x, y], [x - 6 * s, y - 60 * s], [x + 4 * s, y - 120 * s]], 5), 12 * s, 5 * s, "#3b2a1c"); stroke(g, [[x, y - 80 * s], [x + 40 * s, y - 120 * s]], 5 * s, 2 * s, "#3b2a1c"); stroke(g, [[x - 2 * s, y - 70 * s], [x - 44 * s, y - 104 * s]], 5 * s, 2 * s, "#3b2a1c"); for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${40 + R() * 30},${64 + R() * 30},${36},.85)`; g.beginPath(); g.ellipse(x + (R() - 0.5) * 140 * s, y - 130 * s + (R() - 0.5) * 70 * s, 14 * s, 9 * s, R() * 3, 0, Math.PI * 2); g.fill(); } };
  tree(SW * 0.1, SH * 0.98, 2.4); tree(SW * 0.86, SH * 0.94, 2.0); tree(SW * 0.72, hz + 70, 0.6); tree(SW * 0.28, hz + 40, 0.45);
  return center;
}

// ───────── 长安城坊图 ─────────
export function cityPlan(g) {
  silk(g, SW, SH, { seed: 31 });
  const CW = 1460, CH = 1294, x0 = (SW - CW) / 2 + 40, y0 = (SH - CH) / 2 + 30;
  const X = (u) => x0 + u * CW, Y = (v) => y0 + v * CH;
  // 坊：东西 14 条街、南北 11 条街（示意）
  const cols = [0, 0.07, 0.15, 0.23, 0.31, 0.39, 0.47, 0.53, 0.61, 0.69, 0.77, 0.85, 0.93, 1], rows = [0, 0.1, 0.17, 0.24, 0.31, 0.38, 0.45, 0.52, 0.59, 0.66, 0.73, 0.8, 0.87, 0.935, 1];
  const R = rng(5);
  for (let i = 0; i < cols.length - 1; i++) for (let j = 0; j < rows.length - 1; j++) {
    const inPalace = cols[i] >= 0.355 && cols[i + 1] <= 0.645 && rows[j + 1] <= 0.31;
    if (inPalace) continue;
    const bx = X(cols[i]) + 8, by = Y(rows[j]) + 8, bw = (cols[i + 1] - cols[i]) * CW - 16, bh = (rows[j + 1] - rows[j]) * CH - 16;
    const market = (i === 2 || i === 10) && (j === 5 || j === 6);
    g.fillStyle = market ? "rgba(185,141,85,.32)" : `rgba(196,164,112,${0.16 + R() * 0.08})`; g.fillRect(bx, by, bw, bh);
    g.strokeStyle = "rgba(43,34,25,.5)"; g.lineWidth = 2; g.strokeRect(bx, by, bw, bh);
    g.strokeStyle = "rgba(43,34,25,.22)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(bx + bw / 2, by); g.lineTo(bx + bw / 2, by + bh); g.moveTo(bx, by + bh / 2); g.lineTo(bx + bw, by + bh / 2); g.stroke();
  }
  // 宫城、皇城
  g.fillStyle = "rgba(170,60,44,.14)"; g.fillRect(X(0.355), Y(0), 0.29 * CW, 0.17 * CH); g.strokeStyle = INK; g.lineWidth = 5; g.strokeRect(X(0.355), Y(0), 0.29 * CW, 0.17 * CH);
  g.fillStyle = "rgba(170,60,44,.08)"; g.fillRect(X(0.355), Y(0.17), 0.29 * CW, 0.14 * CH); g.lineWidth = 4; g.strokeRect(X(0.355), Y(0.17), 0.29 * CW, 0.14 * CH);
  // 大明宫（城外东北）
  g.beginPath(); g.moveTo(X(0.68), Y(0)); g.lineTo(X(0.68), Y(-0.16)); g.lineTo(X(0.8), Y(-0.19)); g.lineTo(X(0.86), Y(-0.1)); g.lineTo(X(0.86), Y(0)); g.closePath(); g.fillStyle = "rgba(170,60,44,.12)"; g.fill(); g.lineWidth = 4; g.stroke();
  // 曲江池
  g.fillStyle = "rgba(61,111,138,.35)"; g.beginPath(); g.ellipse(X(0.95), Y(0.93), 34, 60, 0.4, 0, Math.PI * 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke();
  // 朱雀大街
  g.fillStyle = "rgba(184,52,42,.28)"; g.fillRect(X(0.5) - 14, Y(0.31), 28, 0.69 * CH);
  // 城墙（双线）与城门
  g.strokeStyle = INK; g.lineWidth = 12; g.strokeRect(X(0), Y(0), CW, CH); g.lineWidth = 3; g.strokeRect(X(0) - 14, Y(0) - 14, CW + 28, CH + 28);
  const gate = (x, y, vert) => { g.fillStyle = "#e9d8b0"; vert ? g.fillRect(x - 10, y - 26, 20, 52) : g.fillRect(x - 26, y - 10, 52, 20); g.fillStyle = VERM; vert ? g.fillRect(x - 6, y - 18, 12, 36) : g.fillRect(x - 18, y - 6, 36, 12); };
  [0.24, 0.5, 0.76].forEach((u) => { gate(X(u), Y(1), false); }); [0.2, 0.52, 0.8].forEach((v) => { gate(X(0), Y(v), true); gate(X(1), Y(v), true); });
  // 字
  brushText(g, "长安城", X(-0.2), Y(0.12), 110, { vertical: true });
  brushText(g, "宫城", X(0.5), Y(0.085), 54); brushText(g, "皇城", X(0.5), Y(0.24), 50);
  brushText(g, "东市", X(0.81), Y(0.48), 46); brushText(g, "西市", X(0.19), Y(0.48), 46);
  brushText(g, "朱雀大街", X(0.5) + 46, Y(0.64), 40, { vertical: true, color: "rgba(150,40,30,.9)" });
  brushText(g, "春明门", X(1) + 64, Y(0.52), 44, { vertical: true, color: VERM });
  brushText(g, "曲江", X(0.95) - 6, Y(0.93), 34);
  brushText(g, "大明宫", X(0.77), Y(-0.09), 42);
  return { X, Y };
}

// ───────── 公文（手卷）─────────
export function documentArt(g) {
  // 书案
  const R = rng(41);
  const gr = g.createRadialGradient(SW * 0.5, SH * 0.45, 100, SW * 0.5, SH * 0.5, SW * 0.75); gr.addColorStop(0, "#5a3b22"); gr.addColorStop(1, "#1f140c");
  g.fillStyle = gr; g.fillRect(0, 0, SW, SH);
  for (let i = 0; i < 200; i++) { const y = R() * SH; g.strokeStyle = `rgba(20,12,6,${0.15 + R() * 0.15})`; g.lineWidth = 1 + R() * 3; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= SW; x += 60) g.lineTo(x, y + Math.sin(x / 200 + i) * 6); g.stroke(); }
  // 纸（返回纸面位置，给展开动画和朱圈用）
  const px = 230, py = 250, pw = 2100, ph = 900;
  g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(px + 14, py + 18, pw, ph);
  const paper = mk(pw, ph), pg = paper.getContext("2d");
  silk(pg, pw, ph, { tone: [236, 222, 186], seed: 43, vign: 0.18 });
  pg.fillStyle = "rgba(70,110,104,.55)"; pg.fillRect(0, 0, pw, 46); pg.fillRect(0, ph - 46, pw, 46);
  pg.strokeStyle = "rgba(180,150,90,.6)"; pg.lineWidth = 2; for (let x = 10; x < pw; x += 26) { pg.beginPath(); pg.arc(x, 23, 8, 0, Math.PI * 2); pg.stroke(); pg.beginPath(); pg.arc(x, ph - 23, 8, 0, Math.PI * 2); pg.stroke(); }
  pg.strokeStyle = "rgba(150,40,30,.35)"; pg.lineWidth = 1.5; for (let x = 120; x < pw - 80; x += 150) { pg.beginPath(); pg.moveTo(x, 70); pg.lineTo(x, ph - 70); pg.stroke(); }
  // 文字（自己写的，竖排，从右往左）
  const cols = [];
  const col = (txt, x, size, opt = {}) => { brushText(pg, txt, x, 150, size, { vertical: true, gap: 1.08, ...opt }); cols.push({ txt, x, size, y: 150 }); };
  col("差遣上林署监事", pw - 150, 64);
  col("荔枝使", pw - 330, 120);
  col("岭南鲜荔枝", pw - 560, 128);
  col("贵妃诞辰", pw - 780, 84);
  col("程限六月初一", pw - 960, 84);
  col("送抵长安", pw - 1140, 84);
  col("违限者论罪", pw - 1320, 64, { color: "rgba(43,34,25,.8)" });
  col("天宝十四载二月", pw - 1640, 56, { color: "rgba(43,34,25,.85)" });
  pg.drawImage(seal("上林署", 190), pw - 1740, 420);
  pg.drawImage(seal("敕", 150, { round: true }), pw - 520, 640);
  return { paper, px, py, pw, ph, cols };
}

// ───────── 天工开物式剖面图：双层瓮（每帧按参数重画）─────────
/** p: draw(0–1 显影由外部遮罩做) soil water branch basket ripe wilt pick salt fruitsIn ice labels(0–1) labels2 */
export function jarDiagram(g, p, t = 0) {
  silk(g, SW, SH, { tone: [234, 220, 184], seed: 51, vign: 0.22, fibers: 0.5 });
  const cx = 980, R = rng(52);
  const outer = [[150, 330], [140, 380], [250, 470], [330, 580], [360, 760], [330, 980], [270, 1150], [220, 1262]];
  const inner = [[110, 372], [104, 410], [190, 490], [262, 600], [286, 760], [260, 960], [210, 1120], [170, 1214]];
  const sideL = (prof) => prof.map(([r, y]) => [cx - r, y]), sideR = (prof) => prof.map(([r, y]) => [cx + r, y]);
  const shapeOf = (prof) => { const L = smooth(sideL(prof), 6), Rr = smooth(sideR(prof), 6).reverse(); return [...L, ...Rr]; };
  const oPoly = shapeOf(outer), iPoly = shapeOf(inner);
  const clipPoly = (poly) => { g.beginPath(); g.moveTo(...poly[0]); poly.forEach((q) => g.lineTo(...q)); g.closePath(); };
  // 外层夹层：水（从下往上灌）
  if (p.water > 0) {
    g.save(); clipPoly(oPoly); g.clip();
    const top = lerp(1262, 400, p.water);
    g.fillStyle = "rgba(120,168,182,.55)"; g.fillRect(cx - 400, top, 800, 1300 - top);
    g.strokeStyle = "rgba(61,111,138,.5)"; g.lineWidth = 2; for (let y = top + 14; y < 1262; y += 26) { g.beginPath(); for (let x = cx - 380; x < cx + 380; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + y + t * 2) * 3); g.stroke(); }
    // 冰块
    const nIce = Math.floor(p.ice * 9 + 0.001);
    for (let i = 0; i < 9; i++) { const k = clamp(p.ice * 9 - i); if (k <= 0) continue; const side = i % 2 ? 1 : -1, yy = lerp(260, 1150 - Math.floor(i / 2) * 90, Math.min(1, k * 1.15)), xx = cx + side * (300 - Math.floor(i / 2) * 6); g.save(); g.translate(xx, yy); g.rotate((R() - 0.5) * 0.4); g.fillStyle = "rgba(220,240,246,.85)"; g.fillRect(-26, -26, 52, 52); g.strokeStyle = "rgba(90,140,160,.9)"; g.lineWidth = 2.5; g.strokeRect(-26, -26, 52, 52); g.strokeStyle = "rgba(255,255,255,.9)"; g.beginPath(); g.moveTo(-18, -18); g.lineTo(6, -18); g.stroke(); g.restore(); void nIce; }
    g.restore();
  }
  // 内层：肥土 / 盐洗过的荔枝
  if (p.soil > 0) {
    g.save(); clipPoly(iPoly); g.clip();
    const top = lerp(1214, 620, p.soil);
    g.fillStyle = `rgba(120,86,52,${0.85 * (1 - p.fruitsIn)})`; g.fillRect(cx - 320, top, 640, 1300 - top);
    g.fillStyle = `rgba(60,40,22,${0.55 * (1 - p.fruitsIn)})`; for (let i = 0; i < 900; i++) { const x = cx - 300 + R() * 600, y = top + R() * (1214 - top); g.fillRect(x, y, 3, 3); }
    g.restore();
  }
  if (p.fruitsIn > 0) {
    g.save(); clipPoly(iPoly); g.clip(); g.globalAlpha = p.fruitsIn;
    const RR = rng(77); for (let row = 0; row < 12; row++) for (let k = 0; k < 9; k++) { const x = cx - 230 + k * 58 + (row % 2) * 29 + (RR() - 0.5) * 10, y = 1180 - row * 50 + (RR() - 0.5) * 8; if (y < 640) continue; lycheeArt(g, x, y, 26, { ripe: 1, leaf: false, stem: false, seed: row * 9 + k }); }
    g.fillStyle = "rgba(160,200,214,.35)"; g.fillRect(cx - 300, 600, 600, 700);
    g.restore();
  }
  // 瓮壁（剖面：外壁、内壁画成带排线的厚边）
  const wall = (prof, w) => { const L = smooth(sideL(prof), 6), Rr = smooth(sideR(prof), 6); for (const side of [L, Rr]) { linePath(g, side, INK, w); g.strokeStyle = "rgba(43,34,25,.35)"; g.lineWidth = 1.4; for (let i = 0; i < side.length - 1; i += 2) { const [x, y] = side[i]; const d = side === L ? -1 : 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + d * 16, y + 10); g.stroke(); } } g.strokeStyle = INK; g.lineWidth = w; g.beginPath(); g.moveTo(cx - prof[prof.length - 1][0], prof[prof.length - 1][1]); g.lineTo(cx + prof[prof.length - 1][0], prof[prof.length - 1][1]); g.stroke(); };
  wall(outer, 9); wall(inner, 6);
  g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.ellipse(cx, 330, 150, 26, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.ellipse(cx, 372, 110, 18, 0, 0, Math.PI * 2); g.stroke();
  // 枝杈（从上往下插进土里），荔枝（青 → 红），叶子（枯）
  const fruitPos = [];
  if (p.branch > 0) {
    const dy = (1 - p.branch) * -520, a = 1 - p.pick;
    g.save(); g.translate(0, dy); g.globalAlpha = clamp(p.branch * 3) * clamp(1 - p.pick * 1.4 + 0.4);
    const wilt = p.wilt, bcol = `rgb(${lerp(74, 92, wilt)},${lerp(52, 60, wilt)},${lerp(32, 40, wilt)})`;
    stroke(g, smooth([[cx + 10, 900], [cx, 700], [cx - 12, 470], [cx + 6, 300]], 6), 34, 22, bcol);
    const forks = [[[cx + 4, 330], [cx - 120, 210], [cx - 190, 150]], [[cx + 2, 360], [cx + 110, 220], [cx + 200, 170]], [[cx + 6, 300], [cx + 20, 160], [cx - 10, 90]]];
    forks.forEach((f) => stroke(g, smooth(f, 5), 16, 7, bcol));
    // 叶
    const RL = rng(61);
    for (let i = 0; i < 26; i++) {
      const f = forks[i % 3], tt = 0.3 + RL() * 0.7, idx = Math.floor(tt * (f.length - 1)), q0 = f[idx], q1 = f[Math.min(f.length - 1, idx + 1)];
      const x = lerp(q0[0], q1[0], RL()), y = lerp(q0[1], q1[1], RL()), ang = (RL() - 0.5) * 2.4 + wilt * 1.1 * (RL() < 0.5 ? 1 : -1) + Math.PI * 0.5 * wilt;
      g.save(); g.translate(x, y); g.rotate(ang - Math.PI / 2);
      const lg = g.createLinearGradient(0, 0, 0, -90); lg.addColorStop(0, `rgb(${lerp(58, 140, wilt)},${lerp(86, 110, wilt)},${lerp(44, 50, wilt)})`); lg.addColorStop(1, `rgb(${lerp(110, 170, wilt)},${lerp(140, 130, wilt)},${lerp(70, 60, wilt)})`);
      g.fillStyle = lg; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(18 * (1 - wilt * 0.4), -45, 0, -95 * (1 - wilt * 0.2)); g.quadraticCurveTo(-18 * (1 - wilt * 0.4), -45, 0, 0); g.fill();
      g.strokeStyle = "rgba(30,40,20,.6)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -88); g.stroke(); g.restore();
    }
    g.globalAlpha = 1; g.restore();
    // 果（摘的时候往下飞进内瓮口）
    const RF = rng(71);
    for (let i = 0; i < 20; i++) {
      const f = forks[i % 3], end = f[f.length - 1], x0 = end[0] + (RF() - 0.5) * 120, y0 = end[1] + 60 + RF() * 90 + dy;
      const pk = clamp(p.pick * 1.6 - i * 0.03), x = lerp(x0, cx + (RF() - 0.5) * 120, pk), y = lerp(y0, 400 + RF() * 40, pk) - Math.sin(pk * Math.PI) * 80;
      if (pk >= 0.999) continue;
      fruitPos.push([x, y]);
      g.save(); g.globalAlpha = clamp(p.branch * 3) * (1 - clamp((pk - 0.85) * 6)); lycheeArt(g, x, y, 22, { ripe: p.ripe * (0.85 + RF() * 0.3), age: p.wilt * 0.6, leaf: false, stem: false, seed: 200 + i }); g.restore();
    }
    void a;
  }
  // 藤筐（罩住树冠的网罩）
  if (p.basket > 0) {
    g.save(); g.globalAlpha = p.basket * (1 - p.pick);
    g.strokeStyle = "rgba(150,118,70,.9)"; g.lineWidth = 3;
    for (let i = 0; i <= 12; i++) { const a = Math.PI + (i / 12) * Math.PI; g.beginPath(); g.moveTo(cx + Math.cos(a) * 240, 330); g.quadraticCurveTo(cx + Math.cos(a) * 260, 130, cx, 60); g.stroke(); }
    for (let k = 0; k < 7; k++) { const yy = lerp(320, 90, k / 7), rr = Math.sqrt(1 - Math.pow((330 - yy) / 290, 2)) * 250; g.beginPath(); g.ellipse(cx, yy, rr, 22, 0, 0, Math.PI * 2); g.stroke(); }
    g.restore();
  }
  // 盐（白色晶粒落下）
  if (p.salt > 0 && p.salt < 1) { const RS = rng(91); for (let i = 0; i < 140; i++) { const st = RS() * 0.6, k = clamp((p.salt - st) / 0.4); if (k <= 0 || k >= 1) continue; const x = cx - 90 + RS() * 180, y = lerp(120, 420, k); g.fillStyle = "rgba(255,255,255,.9)"; g.fillRect(x, y, 5, 5); g.strokeStyle = "rgba(120,120,120,.6)"; g.lineWidth = 1; g.strokeRect(x, y, 5, 5); } }
  // 寒气
  if (p.ice > 0.2) { const RM = rng(93); for (let i = 0; i < 24; i++) { const ph = (t * 0.25 + RM()) % 1, x = cx + (RM() < 0.5 ? -1 : 1) * (200 + RM() * 140), y = lerp(720, 260, ph); const gm = g.createRadialGradient(x, y, 0, x, y, 70); gm.addColorStop(0, `rgba(245,250,255,${0.22 * clamp((p.ice - 0.2) * 2) * Math.sin(ph * Math.PI)})`); gm.addColorStop(1, "rgba(245,250,255,0)"); g.fillStyle = gm; g.fillRect(x - 70, y - 70, 140, 140); } }
  // 标注（引线 + 毛笔字）
  const label = (txt, ax, ay, lx, ly, alpha, size = 50, color = INK) => { if (alpha <= 0) return; g.save(); g.globalAlpha = alpha; g.strokeStyle = "rgba(43,34,25,.7)"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ax, ay); g.lineTo(lx - 20, ly); g.lineTo(lx, ly); g.stroke(); g.fillStyle = INK; g.beginPath(); g.arc(ax, ay, 6, 0, Math.PI * 2); g.fill(); brushText(g, txt, lx + 14, ly, size, { align: "left", color }); g.restore(); };
  label("外层 · 灌清水", cx + 318, 900, 1500, 860, p.labels);
  label("内层 · 培肥土", cx + 150, 980, 1500, 1010, p.labels * (1 - p.fruitsIn));
  label("截枝约三尺，挂果二十来枚", cx + 30, 560, 1500, 560, p.labels * (1 - p.pick));
  label("藤筐罩顶", cx + 200, 170, 1500, 300, p.labels * p.basket * (1 - p.pick));
  label("盐水洗过", cx + 60, 420, 1500, 420, p.labels2);
  label("果实封入内层", cx + 150, 980, 1500, 1010, p.labels2);
  label("江陵冰窖之冰", cx - 300, 980, 220, 1120, p.labels3, 46);
  // 题名
  brushText(g, p.title2 > 0.5 ? "盐洗隔水之法" : "分枝植瓮之法", 2380, 160, 92, { vertical: true, alpha: p.labels > 0 ? 1 : 0 });
  return { fruitPos };
}

// ───────── 春明门（界画）─────────
export function gateScene(g) {
  const R = rng(61);
  const gr = g.createLinearGradient(0, 0, 0, SH); gr.addColorStop(0, "#9aa8b0"); gr.addColorStop(0.42, "#e7c999"); gr.addColorStop(0.62, "#f2dcae"); gr.addColorStop(1, "#d8b682");
  g.fillStyle = gr; g.fillRect(0, 0, SW, SH);
  silk(g, SW, SH, { tone: null, vign: 0.2, seed: 62, fibers: 0.5 });
  const sg = g.createRadialGradient(SW * 0.86, SH * 0.5, 10, SW * 0.86, SH * 0.5, 600); sg.addColorStop(0, "rgba(255,226,170,.75)"); sg.addColorStop(1, "rgba(255,226,170,0)"); g.fillStyle = sg; g.fillRect(0, 0, SW, SH);
  const wallTop = 800, wallBot = 1190, gx = SW * 0.5;
  // 城墙：夯土分层
  g.fillStyle = "#b99a6c"; g.fillRect(0, wallTop, SW, wallBot - wallTop);
  for (let y = wallTop + 12; y < wallBot; y += 16) { g.strokeStyle = `rgba(90,66,40,${0.25 + R() * 0.15})`; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= SW; x += 80) g.lineTo(x, y + (R() - 0.5) * 3); g.stroke(); }
  g.fillStyle = "#9d8b72"; g.fillRect(0, wallBot - 46, SW, 46);
  for (let x = 0; x < SW; x += 34) { g.fillStyle = "#a88f68"; g.fillRect(x, wallTop - 26, 22, 26); g.strokeStyle = "rgba(60,44,28,.5)"; g.lineWidth = 2; g.strokeRect(x, wallTop - 26, 22, 26); }
  // 三个门洞
  const door = (x, w, h) => { const top = wallBot - h; g.fillStyle = "#2a2018"; g.beginPath(); g.moveTo(x - w / 2, wallBot); g.lineTo(x - w / 2, top + w * 0.3); g.quadraticCurveTo(x, top - w * 0.1, x + w / 2, top + w * 0.3); g.lineTo(x + w / 2, wallBot); g.closePath(); g.fill(); g.strokeStyle = "#3d2c1c"; g.lineWidth = 6; g.stroke(); g.fillStyle = "#7a3a22"; g.fillRect(x - w / 2 - 34, top + w * 0.35, 30, h - w * 0.35); g.fillRect(x + w / 2 + 4, top + w * 0.35, 30, h - w * 0.35); g.fillStyle = "#c9a046"; for (let k = 0; k < 4; k++) for (const sx of [x - w / 2 - 19, x + w / 2 + 19]) { g.beginPath(); g.arc(sx, top + w * 0.5 + k * 40, 3.5, 0, Math.PI * 2); g.fill(); } };
  door(gx, 170, 280); door(gx - 290, 130, 230); door(gx + 290, 130, 230);
  // 门楼
  const tw = 980, base = wallTop - 26;
  g.fillStyle = "#d9cdb4"; g.fillRect(gx - tw / 2 - 30, base - 30, tw + 60, 30); g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(gx - tw / 2 - 30, base - 30, tw + 60, 30);
  const colH = 170, top = base - 30 - colH;
  g.fillStyle = "#efe6d2"; g.fillRect(gx - tw / 2, top, tw, colH);
  for (let i = 0; i <= 7; i++) { const x = gx - tw / 2 + (tw * i) / 7; g.fillStyle = "#a3302a"; g.fillRect(x - 9, top, 18, colH); }
  for (let i = 0; i < 7; i++) { const x = gx - tw / 2 + (tw * (i + 0.5)) / 7; g.strokeStyle = "rgba(122,40,30,.85)"; g.lineWidth = 2; for (let k = -40; k <= 40; k += 13) { g.beginPath(); g.moveTo(x + k, top + 30); g.lineTo(x + k, top + colH - 20); g.stroke(); } }
  g.fillStyle = "#2f6f6a"; g.fillRect(gx - tw / 2 - 10, top - 26, tw + 20, 26);
  g.fillStyle = "#c99a3c"; for (let i = 0; i < 22; i++) g.fillRect(gx - tw / 2 + i * (tw / 21) - 8, top - 22, 16, 10);
  // 屋顶（庑殿顶）
  const ry = top - 26, eave = 160, rh = 170;
  const roofPts = smooth([[gx - tw / 2 - eave, ry + 10], [gx - tw / 2 - eave * 0.4, ry - 8], [gx - tw / 2 + 160, ry - rh * 0.8], [gx - tw / 2 + 260, ry - rh], [gx + tw / 2 - 260, ry - rh], [gx + tw / 2 - 160, ry - rh * 0.8], [gx + tw / 2 + eave * 0.4, ry - 8], [gx + tw / 2 + eave, ry + 10]], 8);
  fillPath(g, [...roofPts, [gx + tw / 2 + eave * 0.6, ry + 16], [gx - tw / 2 - eave * 0.6, ry + 16]], "#3b4148");
  g.strokeStyle = "rgba(20,24,28,.7)"; g.lineWidth = 2; for (let x = gx - tw / 2 - eave * 0.6; x < gx + tw / 2 + eave * 0.6; x += 16) { const k = Math.abs(x - gx) / (tw / 2 + eave); g.beginPath(); g.moveTo(x, ry + 14); g.lineTo(x + (x - gx) * 0.06, ry - rh * (1 - k * k) * 0.95 + 6); g.stroke(); }
  linePath(g, roofPts, INK, 6);
  g.fillStyle = "#2a2e33"; g.fillRect(gx - tw / 2 + 250, ry - rh - 22, tw - 500, 24);
  const chiwen = (x, d) => { fillPath(g, smooth([[x, ry - rh - 20], [x + d * 10, ry - rh - 80], [x + d * 50, ry - rh - 96], [x + d * 30, ry - rh - 60], [x + d * 36, ry - rh - 20]], 4, true), "#2a2e33"); };
  chiwen(gx - tw / 2 + 250, -1); chiwen(gx + tw / 2 - 250, 1);
  // 牌匾
  g.fillStyle = "#2b2219"; g.fillRect(gx - 80, top + 8, 160, 56); g.strokeStyle = "#c99a3c"; g.lineWidth = 4; g.strokeRect(gx - 80, top + 8, 160, 56); brushText(g, "春明门", gx, top + 37, 40, { color: "#e8c56a" });
  // 彩旗、花饰、灯笼（贵妃诞辰，城门装点一新）
  for (let i = 0; i < 9; i++) { const x = 150 + i * 290; if (Math.abs(x - gx) < 560) continue; stroke(g, [[x, wallTop - 26], [x, wallTop - 230]], 6, 4, "#3b2a1c"); fillPath(g, smooth([[x, wallTop - 228], [x + 90, wallTop - 214], [x + 120, wallTop - 186], [x + 86, wallTop - 160], [x, wallTop - 150]], 4, true), i % 2 ? "#c0392b" : "#d9a33a"); }
  for (let i = 0; i < 40; i++) { const x = gx - 470 + i * 24, y = top + colH + 6 + Math.sin(i * 0.5) * 16; g.fillStyle = ["#e8b4b8", "#f4e1c8", "#d9534f"][i % 3]; g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill(); }
  for (const lx of [gx - 420, gx + 420]) { stroke(g, [[lx, top + colH], [lx, top + colH + 40]], 2, 2, INK); g.fillStyle = "#c0392b"; g.beginPath(); g.ellipse(lx, top + colH + 70, 26, 34, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "#e9c46a"; g.fillRect(lx - 14, top + colH + 34, 28, 6); g.fillRect(lx - 14, top + colH + 100, 28, 6); }
  // 地面与路
  const gg = g.createLinearGradient(0, wallBot, 0, SH); gg.addColorStop(0, "#c9a670"); gg.addColorStop(1, "#b58f5a"); g.fillStyle = gg; g.fillRect(0, wallBot, SW, SH - wallBot);
  for (let i = 0; i < 900; i++) { const y = wallBot + Math.pow(R(), 1.4) * (SH - wallBot); g.fillStyle = `rgba(110,80,46,${0.15 + R() * 0.2})`; g.fillRect(R() * SW, y, 3 + R() * 10, 1.5); }
  return { wallBot, gx };
}

// ───────── 剥开的荔枝 ─────────
export function peeledScene(g) {
  const R = rng(81);
  const gr = g.createRadialGradient(SW * 0.5, SH * 0.55, 100, SW * 0.5, SH * 0.6, SW * 0.7); gr.addColorStop(0, "#4a1f16"); gr.addColorStop(1, "#160805");
  g.fillStyle = gr; g.fillRect(0, 0, SW, SH);
  for (let i = 0; i < 120; i++) { const y = R() * SH; g.strokeStyle = `rgba(255,200,170,${0.015 + R() * 0.02})`; g.lineWidth = 1 + R() * 2; g.beginPath(); g.moveTo(0, y); g.lineTo(SW, y + (R() - 0.5) * 40); g.stroke(); }
  // 青瓷盘
  const px = SW * 0.5, py = SH * 0.66;
  g.fillStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.ellipse(px + 20, py + 40, 560, 170, 0, 0, Math.PI * 2); g.fill();
  const pg = g.createRadialGradient(px - 120, py - 60, 40, px, py, 600); pg.addColorStop(0, "#d6e3cf"); pg.addColorStop(0.6, "#a9c2a6"); pg.addColorStop(1, "#6f8c74");
  g.fillStyle = pg; g.beginPath(); g.ellipse(px, py, 560, 170, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 5; g.beginPath(); g.ellipse(px, py - 4, 548, 162, 0, Math.PI * 1.05, Math.PI * 1.9); g.stroke();
  g.fillStyle = "rgba(120,150,120,.5)"; g.beginPath(); g.ellipse(px, py + 6, 380, 106, 0, 0, Math.PI * 2); g.fill();
  // 一颗完整的，放在后面
  lycheeArt(g, px + 330, py - 60, 92, { ripe: 1, seed: 7, leaf: true });
  // 剥开的：三瓣壳 + 白色果肉
  const shell = (ang) => { g.save(); g.translate(px - 120, py - 20); g.rotate(ang); const sp = g.createLinearGradient(0, 0, 0, 170); sp.addColorStop(0, "#c92f27"); sp.addColorStop(1, "#7e1712"); g.fillStyle = sp; g.beginPath(); g.moveTo(-60, 0); g.quadraticCurveTo(-90, 120, 0, 180); g.quadraticCurveTo(90, 120, 60, 0); g.closePath(); g.fill(); g.fillStyle = "rgba(248,226,214,.9)"; g.beginPath(); g.moveTo(-46, 6); g.quadraticCurveTo(-64, 110, 0, 160); g.quadraticCurveTo(64, 110, 46, 6); g.closePath(); g.fill(); g.strokeStyle = "rgba(90,20,14,.6)"; g.lineWidth = 2; for (let k = 0; k < 14; k++) { g.beginPath(); g.arc((R() - 0.5) * 120, 40 + R() * 120, 8, 0, Math.PI * 2); g.stroke(); } g.restore(); };
  shell(0.9); shell(-0.9); shell(2.6);
  const fx = px - 120, fy = py - 120;
  const fg = g.createRadialGradient(fx - 40, fy - 50, 10, fx, fy, 150); fg.addColorStop(0, "#ffffff"); fg.addColorStop(0.45, "#f1ede4"); fg.addColorStop(0.85, "#c9cfcf"); fg.addColorStop(1, "#9aa6a8");
  g.fillStyle = fg; g.beginPath(); g.ellipse(fx, fy, 128, 140, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(180,190,190,.6)"; g.lineWidth = 2; for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(fx + (R() - 0.5) * 120, fy - 120); g.quadraticCurveTo(fx + (R() - 0.5) * 160, fy, fx + (R() - 0.5) * 120, fy + 120); g.stroke(); }
  g.fillStyle = "rgba(255,255,255,.75)"; g.beginPath(); g.ellipse(fx - 52, fy - 64, 34, 18, -0.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(255,255,255,.5)"; g.beginPath(); g.ellipse(fx + 40, fy + 70, 14, 26, 0.4, 0, Math.PI * 2); g.fill();
  // 一滴汁
  g.fillStyle = "rgba(240,245,245,.85)"; g.beginPath(); g.ellipse(fx + 150, py + 30, 16, 10, 0, 0, Math.PI * 2); g.fill();
  return { fx, fy };
}

// ───────── 天平：一枚荔枝 vs 一头骆驼（每帧按参数重画）─────────
export function scaleScene(g, p) {
  silk(g, SW, SH, { tone: [232, 216, 178], seed: 91, fibers: 0.5 });
  const px = SW / 2, py = 470, half = 560, ang = p.tilt * (12 * Math.PI) / 180;   // 正：左边往下
  // 底座、立柱
  fillPath(g, [[px - 220, 1260], [px + 220, 1260], [px + 150, 1200], [px - 150, 1200]], "#5a3b22");
  stroke(g, [[px, 1210], [px, py + 10]], 34, 26, "#4a3020");
  g.fillStyle = "#c99a3c"; g.beginPath(); g.arc(px, py, 22, 0, Math.PI * 2); g.fill();
  // 横梁
  const lx = px - Math.cos(ang) * half, ly = py + Math.sin(ang) * half, rx = px + Math.cos(ang) * half, ry = py - Math.sin(ang) * half;
  stroke(g, [[lx, ly], [rx, ry]], 22, 22, "#4a3020"); g.fillStyle = "#c99a3c"; g.beginPath(); g.arc(lx, ly, 12, 0, Math.PI * 2); g.arc(rx, ry, 12, 0, Math.PI * 2); g.fill();
  // 指针
  stroke(g, [[px, py], [px + Math.sin(-ang) * 160, py - Math.cos(ang) * 160]], 8, 4, VERM);
  // 秤盘
  const pan = (x, y) => { const pyy = y + 300; g.strokeStyle = "rgba(60,40,24,.9)"; g.lineWidth = 3; for (const dx of [-150, 0, 150]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, pyy); g.stroke(); } fillPath(g, smooth([[x - 190, pyy], [x + 190, pyy], [x + 150, pyy + 40], [x - 150, pyy + 40]], 4, true), "#8a6a44"); g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.ellipse(x, pyy, 190, 22, 0, 0, Math.PI * 2); g.stroke(); return pyy; };
  const lp = pan(lx, ly), rp = pan(rx, ry);
  if (p.lychee > 0) lycheeArt(g, lx, lerp(lp - 520, lp - 44, Math.min(1, p.lychee)), 50, { ripe: 1, seed: 5, leaf: true });
  if (p.camel > 0) camelArt(g, rx - 20, lerp(rp - 600, rp - 4, Math.min(1, p.camel)), 1.55);
  // 标注
  const a = p.labels;
  if (a > 0) {
    brushText(g, "一枚荔枝", lx, lp + 120, 64, { alpha: a }); brushText(g, "约十七贯五百钱", lx, lp + 200, 50, { alpha: a, color: VERM });
    brushText(g, "波斯骆驼一头", rx, rp + 120, 64, { alpha: a }); brushText(g, "不到十五贯", rx, rp + 200, 50, { alpha: a, color: "rgba(43,34,25,.8)" });
  }
}

// ───────── 荔枝园背景（远山、梯田、地面）─────────
export function orchardBack(g) {
  const gr = g.createLinearGradient(0, 0, 0, SH); gr.addColorStop(0, "#d9cfa8"); gr.addColorStop(0.5, "#ece0bc"); gr.addColorStop(1, "#cbb27c");
  g.fillStyle = gr; g.fillRect(0, 0, SW, SH);
  silk(g, SW, SH, { tone: null, vign: 0.22, seed: 101, fibers: 0.5 });
  ridge(g, SH * 0.42, 140, 31, "rgba(120,160,140,.8)", "rgba(200,200,170,0)", { ink: 0.2 });
  ridge(g, SH * 0.5, 170, 37, "rgba(78,126,108,.92)", "rgba(190,170,110,.8)", { ink: 0.45, cun: 70, trees: 80 });
  const R = rng(103), hz = SH * 0.56;
  const gg = g.createLinearGradient(0, hz, 0, SH); gg.addColorStop(0, "rgb(160,160,100)"); gg.addColorStop(1, "rgb(132,118,70)"); g.fillStyle = gg; g.fillRect(0, hz, SW, SH - hz);
  for (let y = hz + 30; y < SH; y += lerp(30, 90, (y - hz) / (SH - hz))) { g.strokeStyle = "rgba(80,70,40,.35)"; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= SW; x += 60) g.lineTo(x, y + Math.sin(x / 300 + y) * 12); g.stroke(); }
  for (let i = 0; i < 1500; i++) { const y = hz + Math.pow(R(), 1.2) * (SH - hz); g.fillStyle = `rgba(70,90,40,${0.2 + R() * 0.25})`; g.fillRect(R() * SW, y, 2 + R() * 5, 2); }
  return { hz };
}
export { figureArt };
