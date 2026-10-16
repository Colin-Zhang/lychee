// 古地图（原创示意，不是任何真实古地图的复制）：旧绢 + 绢纹 + 折痕，海上鱼鳞波，曲折的海岸和小岛，上游细下游粗的江河（长江、黄河画双线），
// 青绿山水画法的成片山峦（勾线、披麻皴、点苔、石青赭石晕染），淡墨驿道，城郭、关隘、题记、计里画方、图名与印章。
// 分辨率 KY 像素 / 纬度；S = KY / 230 是线宽、字号的缩放。drawMap(g, ox, oy) 画整张图（g 已平移到某一块），分块绘制时每块调用一次，结果一致。
import { VIEW, COAST, HAINAN, ISLETS, TAIWAN, RIVERS, LAKES, RANGES, HIGHLANDS, CITIES, LABELS, ROUTE, ROADS } from "./geo.js";

// 分辨率可以用网址参数改：?ky=150（服务器上低配检查用）；默认 300（成片）
const Q = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
export const KY = Number(Q.get("ky") || 300), S = KY / 230, KX = KY * Math.cos((29 * Math.PI) / 180);
export const MW = Math.round((VIEW.lon1 - VIEW.lon0) * KX), MH = Math.round((VIEW.lat1 - VIEW.lat0) * KY);
export const P = (lon, lat) => [(lon - VIEW.lon0) * KX, (VIEW.lat1 - lat) * KY];
/** 一百唐里约 54 公里 ≈ 0.486 个纬度 */
export const CELL = 0.486 * KY;
export const INK = "#2b2219", VERM = "#b8342a", AZURE = "#3d6f8a";

const rnd = (s) => { let x = s >>> 0 || 1; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; };
export function fractal(pts, depth, rough, seed) {
  const R = rnd(seed); let cur = pts;
  for (let d = 0; d < depth; d++) {
    const out = [cur[0]];
    for (let i = 0; i < cur.length - 1; i++) {
      const [x0, y0] = cur[i], [x1, y1] = cur[i + 1], dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
      const k = (R() - 0.5) * rough * L;
      out.push([(x0 + x1) / 2 - (dy / (L || 1)) * k, (y0 + y1) / 2 + (dx / (L || 1)) * k], cur[i + 1]);
    }
    cur = out; rough *= 0.62;
  }
  return cur;
}
const path = (g, pts) => { g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); };

function peak(g, x, y, s, R) {
  const w = s * (1.1 + R() * 0.6), h = s * (0.9 + R() * 0.7);
  const n = 2 + Math.floor(R() * 2), tops = [];
  for (let i = 0; i < n; i++) tops.push([x - w * 0.5 + (w * (i + 0.5)) / n + (R() - 0.5) * w * 0.2, y - h * (i === Math.floor(n / 2) ? 1 : 0.62 + R() * 0.25)]);
  const outline = [[x - w, y]]; tops.forEach(([tx, ty], i) => { if (i) outline.push([(tops[i - 1][0] + tx) / 2, y - h * (0.35 + R() * 0.15)]); outline.push([tx, ty]); }); outline.push([x + w, y]);
  const gr = g.createLinearGradient(0, y - h, 0, y);
  gr.addColorStop(0, "rgba(68,120,108,.93)"); gr.addColorStop(0.45, "rgba(116,150,118,.8)"); gr.addColorStop(1, "rgba(196,160,108,.55)");
  g.fillStyle = gr; g.beginPath(); g.moveTo(...outline[0]);
  for (let i = 1; i < outline.length; i++) { const [px, py] = outline[i - 1], [qx, qy] = outline[i]; g.quadraticCurveTo(px + (qx - px) * 0.5 + (R() - 0.5) * 4 * S, Math.min(py, qy) + (R() - 0.3) * 3 * S, qx, qy); }
  g.closePath(); g.fill();
  g.strokeStyle = "rgba(38,30,22,.88)"; g.lineWidth = Math.max(1.4 * S, s * 0.07); g.lineCap = "round"; g.lineJoin = "round"; g.stroke();
  g.lineWidth = Math.max(0.9 * S, s * 0.04); g.strokeStyle = "rgba(38,30,22,.5)";
  tops.forEach(([tx, ty]) => { for (let k = 0; k < 4; k++) { const ox = (R() - 0.5) * w * 0.6, len = h * (0.3 + R() * 0.4); g.beginPath(); g.moveTo(tx + ox * 0.3, ty + h * 0.12 + R() * 4 * S); g.quadraticCurveTo(tx + ox * 0.7, ty + len * 0.5, tx + ox, ty + len); g.stroke(); } });
  g.fillStyle = "rgba(30,44,30,.75)"; tops.forEach(([tx, ty]) => { for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(tx + (R() - 0.5) * w * 0.5, ty + R() * h * 0.25, Math.max(0.8 * S, s * 0.035), 0, Math.PI * 2); g.fill(); } });
}

/** 画整张地图。g 应该已经平移到要画的那一块（分块时 g.translate(-ox, -oy)） */
export function drawMap(g) {
  const R = rnd(7);
  // ── 绢底
  g.fillStyle = "#e2cfa3"; g.fillRect(0, 0, MW, MH);
  const tile = document.createElement("canvas"); tile.width = tile.height = 6; const tg = tile.getContext("2d");
  tg.fillStyle = "rgba(120,92,52,.10)"; tg.fillRect(0, 0, 6, 1); tg.fillRect(0, 3, 6, 1); tg.fillStyle = "rgba(255,248,228,.10)"; tg.fillRect(0, 0, 1, 6); tg.fillRect(3, 0, 1, 6);
  g.fillStyle = g.createPattern(tile, "repeat"); g.fillRect(0, 0, MW, MH);
  for (let i = 0; i < 100000; i++) { g.fillStyle = `rgba(${105 + R() * 40},${82 + R() * 30},${48 + R() * 20},${0.03 + R() * 0.05})`; g.fillRect(R() * MW, R() * MH, (1 + R() * 6) * S, S); }
  for (let i = 0; i < 80; i++) { const x = R() * MW, y = R() * MH, r = (40 + R() * 260) * S, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(135,100,58,${0.05 + R() * 0.07})`); gr.addColorStop(1, "rgba(135,100,58,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }

  // ── 海
  const coast = fractal(COAST.map(([a, b]) => P(a, b)), 4, 0.5, 3);
  const seaPoly = [...coast, [coast[coast.length - 1][0], -10], [MW + 10, -10], [MW + 10, MH + 10], [coast[0][0], MH + 10]];
  g.save(); path(g, seaPoly); g.closePath(); g.clip();
  g.fillStyle = "rgba(92,130,138,.16)"; g.fillRect(0, 0, MW, MH);
  g.strokeStyle = "rgba(55,100,124,.40)"; g.lineWidth = 1.5 * S;
  const wr = 17 * S, wy = 18 * S, wx = 38 * S;
  for (let y = 0, row = 0; y < MH + 40; y += wy, row++) for (let x = row % 2 ? 0 : wx / 2; x < MW + 40; x += wx) { g.beginPath(); g.arc(x, y, wr, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); }
  g.strokeStyle = "rgba(55,100,124,.55)"; g.lineWidth = 2 * S;
  for (let i = 0; i < 260; i++) { const x = R() * MW, y = R() * MH, r = (10 + R() * 14) * S; g.beginPath(); g.arc(x, y, r, Math.PI, Math.PI * 2.2); g.arc(x + r * 0.6, y - r * 0.1, r * 0.4, 0, Math.PI * 1.4, true); g.stroke(); }
  g.restore();
  g.lineJoin = "round"; g.lineCap = "round";
  g.strokeStyle = "rgba(43,34,25,.35)"; g.lineWidth = 9 * S; path(g, coast); g.stroke();
  g.strokeStyle = INK; g.lineWidth = 3.6 * S; path(g, coast); g.stroke();
  const island = (pts, seed) => { const q = fractal(pts, 3, 0.45, seed); g.fillStyle = "#e2cfa3"; path(g, q); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 3 * S; path(g, q); g.closePath(); g.stroke(); return q; };
  island(TAIWAN.map(([a, b]) => P(a, b)), 9); island(HAINAN.map(([a, b]) => P(a, b)), 10);
  ISLETS.forEach(([lon, lat, r], i) => { const [x, y] = P(lon, lat), pts = []; for (let a = 0; a < 9; a++) { const t = (a / 9) * Math.PI * 2; pts.push([x + Math.cos(t) * r * KX * (0.7 + R() * 0.5), y + Math.sin(t) * r * KY * (0.7 + R() * 0.5)]); } pts.push(pts[0]); island(pts, 20 + i); });

  // ── 计里画方
  // 网格用淡墨（像石刻拓本），红色只留给荔枝走的那条路
  for (let i = 0, x = 0; x < MW; x += CELL, i++) { g.strokeStyle = i % 5 ? "rgba(96,72,46,.11)" : "rgba(96,72,46,.22)"; g.lineWidth = (i % 5 ? 1.2 : 2) * S; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, MH); g.stroke(); }
  for (let j = 0, y = 0; y < MH; y += CELL, j++) { g.strokeStyle = j % 5 ? "rgba(96,72,46,.11)" : "rgba(96,72,46,.22)"; g.lineWidth = (j % 5 ? 1.2 : 2) * S; g.beginPath(); g.moveTo(0, y); g.lineTo(MW, y); g.stroke(); }

  // ── 湖
  LAKES.forEach(([, [lon, lat], [rx, ry]], i) => {
    const [x, y] = P(lon, lat), pts = [];
    const RR = rnd(30 + i); for (let a = 0; a <= 48; a++) { const t = (a / 48) * Math.PI * 2, k = 0.8 + RR() * 0.3; pts.push([x + Math.cos(t) * rx * KX * k, y + Math.sin(t) * ry * KY * k]); }
    const q = fractal(pts, 2, 0.3, 40 + i);
    g.fillStyle = "rgba(92,130,138,.30)"; path(g, q); g.fill();
    g.save(); path(g, q); g.clip(); g.strokeStyle = "rgba(55,100,124,.35)"; g.lineWidth = 1.2 * S; for (let yy = y - ry * KY; yy < y + ry * KY; yy += 9 * S) { g.beginPath(); for (let xx = x - rx * KX; xx < x + rx * KX; xx += 12 * S) g.lineTo(xx, yy + Math.sin(xx * 0.15 / S) * 2 * S); g.stroke(); } g.restore();
    g.strokeStyle = INK; g.lineWidth = 2.6 * S; path(g, q); g.stroke();
  });

  // ── 江河：上游细、下游粗；长江、黄河画成双线（中间水色），其余单线
  RIVERS.forEach(([name, w, pts], ri) => {
    const q = fractal(pts.map(([a, b]) => P(a, b)), 4, 0.35, 50 + ri);
    let L = 0; const acc = [0]; for (let i = 1; i < q.length; i++) { L += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]); acc.push(L); }
    g.lineCap = "round"; g.lineJoin = "round";
    const big = name === "长江" || name === "黄河";
    for (let i = 1; i < q.length; i++) { const k = 0.35 + 0.65 * (acc[i] / L); g.strokeStyle = "rgba(61,111,138,.20)"; g.lineWidth = w * 4.5 * k * S; g.beginPath(); g.moveTo(...q[i - 1]); g.lineTo(...q[i]); g.stroke(); }
    if (big) {
      for (let i = 1; i < q.length; i++) { const k = 0.45 + 0.55 * (acc[i] / L); g.strokeStyle = INK; g.lineWidth = w * 2.2 * k * S; g.beginPath(); g.moveTo(...q[i - 1]); g.lineTo(...q[i]); g.stroke(); }
      for (let i = 1; i < q.length; i++) { const k = 0.45 + 0.55 * (acc[i] / L); g.strokeStyle = name === "黄河" ? "#d8c49a" : "#bfcfc6"; g.lineWidth = w * 1.25 * k * S; g.beginPath(); g.moveTo(...q[i - 1]); g.lineTo(...q[i]); g.stroke(); }
      g.strokeStyle = "rgba(61,111,138,.35)"; g.lineWidth = 0.8 * S; g.setLineDash([6 * S, 9 * S]); path(g, q); g.stroke(); g.setLineDash([]);
    } else {
      for (let i = 1; i < q.length; i++) { const k = 0.35 + 0.65 * (acc[i] / L); g.strokeStyle = INK; g.lineWidth = Math.max(1.2 * S, w * 1.05 * k * S); g.beginPath(); g.moveTo(...q[i - 1]); g.lineTo(...q[i]); g.stroke(); }
    }
  });

  // ── 驿道（淡墨虚线；红色只留给荔枝走的那条路）
  g.strokeStyle = "rgba(92,70,48,.34)"; g.lineWidth = 2 * S; g.setLineDash([14 * S, 10 * S]);
  ROADS.forEach(([, pts], i) => { path(g, fractal(pts.map(([a, b]) => P(a, b)), 3, 0.18, 300 + i)); g.stroke(); });
  g.setLineDash([]);

  // ── 山
  const seaTest = (x, y) => { let inside = false; const poly = seaPoly; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };
  const riverPts = []; RIVERS.forEach(([, , pts]) => { const q = fractal(pts.map(([a, b]) => P(a, b)), 3, 0.35, 0); riverPts.push(...q); });
  const cityPts = CITIES.map(([, [a, b]]) => P(a, b));
  const near = (x, y, list, d) => list.some(([px, py]) => Math.abs(px - x) < d && Math.abs(py - y) < d);
  const peaks = [];
  RANGES.forEach(([, pts, dens], ri) => {
    const RR = rnd(90 + ri), q = pts.map(([a, b]) => P(a, b));
    for (let s = 0; s < q.length - 1; s++) {
      const [x0, y0] = q[s], [x1, y1] = q[s + 1], L = Math.hypot(x1 - x0, y1 - y0), n = Math.round((L / (15 * S)) * dens), nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      for (let k = 0; k < n; k++) { const f = RR(), off = (RR() + RR() + RR() - 1.5) * 0.55 * KY; const x = x0 + (x1 - x0) * f + nx * off, y = y0 + (y1 - y0) * f + ny * off; const size = (30 + RR() * 22) * S * (1 - Math.min(0.6, Math.abs(off) / (0.9 * KY))); peaks.push([x, y, size]); }
    }
  });
  HIGHLANDS.forEach(([[lon, lat], [rx, ry], dens], hi) => {
    const RR = rnd(200 + hi), [cx, cy] = P(lon, lat), n = Math.round(rx * ry * 60 * dens);
    for (let k = 0; k < n; k++) { const a = RR() * Math.PI * 2, r = Math.sqrt(RR()); peaks.push([cx + Math.cos(a) * r * rx * KX, cy + Math.sin(a) * r * ry * KY, (22 + RR() * 20) * S]); }
  });
  // 南方丘陵：零散的小山
  { const RR = rnd(400); for (let k = 0; k < 260; k++) { const lon = 106 + RR() * 13, lat = 22.3 + RR() * 7.5; const [x, y] = P(lon, lat); peaks.push([x, y, (13 + RR() * 9) * S]); } }
  peaks.filter(([x, y]) => x > 110 * S && y > 110 * S && x < MW - 110 * S && y < MH - 110 * S && !seaTest(x, y) && !near(x, y, riverPts, 24 * S) && !near(x, y, cityPts, 46 * S))
    .sort((a, b) => a[1] - b[1]).forEach(([x, y, s], i) => peak(g, x, y, s, rnd(1000 + i)));
  // 低地点苔
  g.fillStyle = "rgba(48,70,44,.33)";
  for (let i = 0; i < 4200; i++) { const lon = 104 + R() * 16, lat = 21.5 + R() * 11; const [x, y] = P(lon, lat); if (seaTest(x, y)) continue; g.beginPath(); g.arc(x, y, (1.2 + R() * 1.4) * S, 0, Math.PI * 2); g.fill(); }
  // 云：几道淡墨卷云
  const cloud = (lon, lat, s) => { const [x, y] = P(lon, lat); s *= S; g.strokeStyle = "rgba(90,70,48,.35)"; g.lineWidth = 2.4 * S; g.fillStyle = "rgba(244,232,206,.55)"; g.beginPath(); g.moveTo(x - 150 * s, y); g.bezierCurveTo(x - 110 * s, y - 40 * s, x - 60 * s, y - 40 * s, x - 40 * s, y - 10 * s); g.bezierCurveTo(x - 20 * s, y - 60 * s, x + 50 * s, y - 60 * s, x + 60 * s, y - 14 * s); g.bezierCurveTo(x + 100 * s, y - 40 * s, x + 150 * s, y - 20 * s, x + 160 * s, y); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.arc(x - 60 * s, y - 22 * s, 14 * s, 0.2, Math.PI * 1.8); g.stroke(); g.beginPath(); g.arc(x + 20 * s, y - 34 * s, 18 * s, 0.2, Math.PI * 1.8); g.stroke(); };
  cloud(100.6, 33.6, 1.4); cloud(102.0, 27.5, 1.2); cloud(104.4, 37.8, 1.1); cloud(117.8, 38.6, 1.0); cloud(126.0, 33.5, 1.3); cloud(125.5, 23.5, 1.2);

  // ── 城郭
  CITIES.forEach(([name, [lon, lat], lv]) => {
    const [x, y] = P(lon, lat);
    g.strokeStyle = INK; g.fillStyle = "#efe1bd"; g.lineWidth = 3 * S;
    if (lv === "京") {
      const s = 30 * S; g.fillRect(x - s, y - s, 2 * s, 2 * s); g.strokeRect(x - s, y - s, 2 * s, 2 * s);
      g.fillStyle = INK; for (let k = -s; k < s; k += 8 * S) { g.fillRect(x + k, y - s - 5 * S, 4 * S, 5 * S); g.fillRect(x + k, y + s, 4 * S, 5 * S); g.fillRect(x - s - 5 * S, y + k, 5 * S, 4 * S); g.fillRect(x + s, y + k, 5 * S, 4 * S); }
      g.strokeRect(x - s * 0.55, y - s * 0.55, s * 1.1, s * 1.1); g.fillStyle = "#efe1bd"; g.fillRect(x - 5 * S, y + s - 2 * S, 10 * S, 8 * S);
      g.lineWidth = 1.2 * S; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); g.stroke();
    } else if (lv === "关") {
      g.fillRect(x - 16 * S, y - 8 * S, 32 * S, 18 * S); g.strokeRect(x - 16 * S, y - 8 * S, 32 * S, 18 * S); g.beginPath(); g.moveTo(x - 20 * S, y - 8 * S); g.lineTo(x, y - 22 * S); g.lineTo(x + 20 * S, y - 8 * S); g.closePath(); g.fillStyle = "#7d3a2a"; g.fill(); g.stroke();
      g.fillStyle = INK; g.fillRect(x - 5 * S, y + 1 * S, 10 * S, 9 * S);
    } else if (lv === "岭") { /* 山口：不画城，只写名字（梅关的关楼是宋代才修的，唐代只有张九龄开的山路） */ }
    else if (lv === "县") { g.beginPath(); g.arc(x, y, 9 * S, 0, Math.PI * 2); g.fill(); g.stroke(); }
    else { const s = 13 * S; g.fillRect(x - s, y - s, 2 * s, 2 * s); g.strokeRect(x - s, y - s, 2 * s, 2 * s); g.lineWidth = 1.4 * S; g.strokeRect(x - s + 4 * S, y - s + 4 * S, 2 * s - 8 * S, 2 * s - 8 * S); }
    const fs = (lv === "京" ? 96 : lv === "县" ? 54 : 66) * S;
    g.font = `${fs}px "Brush"`; g.textBaseline = "middle";
    const dx = (lv === "京" ? 42 : 24) * S;
    g.fillStyle = "rgba(43,34,25,.25)"; g.fillText(name, x + dx + 2 * S, y + S);
    g.fillStyle = INK; g.fillText(name, x + dx, y - S);
  });
  LABELS.forEach(([name, [lon, lat]]) => {
    const [x, y] = P(lon, lat), sea = name.endsWith("海"); g.fillStyle = sea ? "rgba(40,80,100,.75)" : "rgba(43,34,25,.72)"; g.font = `${(sea ? 110 : 64) * S}px "Brush"`; g.textAlign = "center";
    [...name].forEach((ch, i) => g.fillText(ch, x, y + (i - (name.length - 1) / 2) * (sea ? 118 : 66) * S));
    g.textAlign = "left";
  });
  const note = (lon, lat, lines) => { const [x, y] = P(lon, lat); g.fillStyle = "rgba(43,34,25,.7)"; g.font = `${40 * S}px "Brush"`; lines.forEach((ln, c) => [...ln].forEach((ch, i) => g.fillText(ch, x - c * 44 * S, y + i * 42 * S))); };
  note(116.1, 25.7, ["五岭险阻", "开元四年", "凿大庾岭路"]);
  note(111.3, 30.9, ["过江", "调冰江陵"]);
  note(110.5, 34.85, ["商州道", "入关中"]);
  note(113.35, 22.75, ["从化", "荔枝所出"]);

  // ── 图名框 + 印章 + 北
  {
    const x = 170 * S, y = 170 * S, w = 420 * S, h = 1080 * S;
    g.fillStyle = "rgba(239,226,190,.94)"; g.fillRect(x, y, w, h); g.strokeStyle = INK; g.lineWidth = 6 * S; g.strokeRect(x, y, w, h); g.lineWidth = 2 * S; g.strokeRect(x + 22 * S, y + 22 * S, w - 44 * S, h - 44 * S);
    g.lineWidth = 2.4 * S;
    for (let k = x + 34 * S; k < x + w - 40 * S; k += 26 * S) for (const yy of [y + 8 * S, y + h - 8 * S]) { const d = yy < y + h / 2 ? 1 : -1; g.beginPath(); g.moveTo(k, yy + 6 * S * d); g.lineTo(k, yy); g.lineTo(k + 14 * S, yy); g.lineTo(k + 14 * S, yy + 8 * S * d); g.lineTo(k + 6 * S, yy + 8 * S * d); g.stroke(); }
    g.fillStyle = INK; g.font = `${120 * S}px "Brush"`; g.textAlign = "center";
    [..."岭南至长安驿路图"].forEach((ch, i) => g.fillText(ch, x + w / 2 + 50 * S, y + 130 * S + i * 112 * S));
    g.font = `${44 * S}px "Brush"`; g.fillStyle = VERM; [..."每方百里"].forEach((ch, i) => g.fillText(ch, x + 90 * S, y + 160 * S + i * 50 * S));
    g.fillStyle = "rgba(43,34,25,.8)"; [..."计五千四百四十七里"].forEach((ch, i) => g.fillText(ch, x + 90 * S, y + 400 * S + i * 50 * S));
    g.textAlign = "left";
    const seal = (sx, sy, s, txt) => { g.fillStyle = "rgba(178,40,32,.85)"; g.fillRect(sx, sy, s, s); g.fillStyle = "#efe1bd"; g.font = `${s * 0.42}px "Brush"`; g.textAlign = "center"; [...txt].forEach((c, i) => g.fillText(c, sx + s * (i < 2 ? 0.72 : 0.28), sy + s * (i % 2 ? 0.74 : 0.32))); g.textAlign = "left"; };
    seal(x + w + 40 * S, y + h - 160 * S, 130 * S, "钳沿");
    seal(x + w + 40 * S, y + h + 10 * S, 110 * S, "示意");
    g.fillStyle = INK; g.font = `${90 * S}px "Brush"`; g.textAlign = "center"; g.fillText("北", MW / 2, 140 * S); g.textAlign = "left";
  }
  // ── 折痕、边框、四边发暗
  const crease = (x0, y0, x1, y1) => { g.strokeStyle = "rgba(90,64,34,.22)"; g.lineWidth = 7 * S; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.strokeStyle = "rgba(255,246,222,.28)"; g.lineWidth = 3 * S; g.beginPath(); g.moveTo(x0 + 5 * S, y0 + 5 * S); g.lineTo(x1 + 5 * S, y1 + 5 * S); g.stroke(); };
  crease(MW / 3, 0, MW / 3, MH); crease((MW * 2) / 3, 0, (MW * 2) / 3, MH); crease(0, MH / 2, MW, MH / 2);
  g.strokeStyle = INK; g.lineWidth = 16 * S; g.strokeRect(46 * S, 46 * S, MW - 92 * S, MH - 92 * S); g.lineWidth = 4 * S; g.strokeRect(82 * S, 82 * S, MW - 164 * S, MH - 164 * S);
  const vg = g.createRadialGradient(MW / 2, MH / 2, MW * 0.32, MW / 2, MH / 2, MW * 0.72); vg.addColorStop(0, "rgba(90,60,30,0)"); vg.addColorStop(1, "rgba(90,60,30,.32)"); g.fillStyle = vg; g.fillRect(0, 0, MW, MH);
}

/** 路线（像素坐标、累计长度、分段类型） */
export function routeGeom(list = ROUTE) {
  const pts = list.map(([lon, lat, kind, name]) => ({ p: P(lon, lat), kind: kind ?? "l", name }));
  let L = 0; pts.forEach((q, i) => { if (i) L += Math.hypot(q.p[0] - pts[i - 1].p[0], q.p[1] - pts[i - 1].p[1]); q.s = L; });
  return { pts, L };
}
export function routeAt(R, s) {
  const { pts } = R; s = Math.max(0, Math.min(R.L, s));
  for (let i = 1; i < pts.length; i++) if (pts[i].s >= s) { const a = pts[i - 1], b = pts[i], f = (s - a.s) / (b.s - a.s || 1); return { x: a.p[0] + (b.p[0] - a.p[0]) * f, y: a.p[1] + (b.p[1] - a.p[1]) * f, kind: a.kind, i, dx: b.p[0] - a.p[0], dy: b.p[1] - a.p[1] }; }
  const e = pts[pts.length - 1]; return { x: e.p[0], y: e.p[1], kind: e.kind, i: pts.length - 1, dx: 1, dy: 0 };
}
