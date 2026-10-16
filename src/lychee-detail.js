// 开场近景专用：球面上的不规则果皮鳞片、细小凸起和叶脉。
// 固定种子让四个新鲜度状态共用一套纹理位置，叠化时不会跳纹。
import { mk, rng, clamp, lerp, smooth, stroke } from "./art.js";

const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const rgb = (c, a = 1) => `rgba(${c.map((v) => Math.round(clamp(v, 0, 255))).join(",")},${a})`;
const path = (g, p) => { g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };

// 用相邻种子的中垂线切出鳞片；边数和大小有变化，避免整齐的蜂窝格。
function cell(seed, neighbors, span) {
  let p = [[seed.x - span, seed.y - span], [seed.x + span, seed.y - span], [seed.x + span, seed.y + span], [seed.x - span, seed.y + span]];
  for (const q of neighbors) {
    if (q === seed) continue;
    const nx = q.x - seed.x, ny = q.y - seed.y;
    const c = (q.x * q.x + q.y * q.y - seed.x * seed.x - seed.y * seed.y) / 2;
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], da = a[0] * nx + a[1] * ny - c, db = b[0] * nx + b[1] * ny - c;
      if (da <= 0) out.push(a);
      if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]); }
    }
    p = out;
    if (!p.length) break;
  }
  return p;
}

function leaf(g, x, y, len, width, angle, age, seed) {
  const R = rng(seed), dry = clamp(age / 3), bend = width * 0.18;
  g.save(); g.translate(x, y); g.rotate(angle);
  const outline = () => {
    g.beginPath(); g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.28, -width * 0.85, len * 0.64, -width * 0.69, len, -bend);
    g.bezierCurveTo(len * 0.77, width * 0.35, len * 0.26, width * 0.94, 0, 0); g.closePath();
  };
  const green = mix([64, 98, 39], [93, 88, 39], dry * 0.65);
  const grad = g.createLinearGradient(0, -width, len * 0.3, width);
  grad.addColorStop(0, rgb(mix(green, [150, 168, 80], 0.57)));
  grad.addColorStop(0.48, rgb(green)); grad.addColorStop(1, rgb(mix(green, [24, 48, 25], 0.6)));
  outline(); g.fillStyle = grad; g.fill(); g.save(); g.clip();
  // 两侧叶肉略有色差，中央叶脉和侧脉顺着叶尖弯过去。
  const mid = (t) => -bend * t * t;
  g.fillStyle = "rgba(167,184,91,.10)"; g.beginPath(); g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.55, -width * 0.8, len, -bend); g.quadraticCurveTo(len * 0.5, 0, 0, 0); g.fill();
  for (let i = 1; i <= 13; i++) {
    const t = i / 15, bx = len * t, by = mid(t), w = width * Math.sin(t * Math.PI) * 0.55;
    for (const sign of [-1, 1]) {
      g.strokeStyle = sign < 0 ? "rgba(190,196,112,.28)" : "rgba(25,49,24,.27)";
      g.lineWidth = Math.max(0.55, len * 0.0021); g.beginPath(); g.moveTo(bx, by);
      g.quadraticCurveTo(bx + len * 0.055, by + sign * w * 0.52, bx + len * 0.12, by + sign * w * 0.87); g.stroke();
    }
  }
  for (let i = 0; i < 220; i++) {
    const px = R() * len, py = (R() - 0.5) * width * 1.5;
    g.fillStyle = i % 3 ? "rgba(200,207,135,.08)" : "rgba(23,44,20,.10)";
    g.fillRect(px, py, len * 0.003, len * 0.0017);
  }
  g.restore();
  stroke(g, smooth([[0, 0], [len * 0.38, -bend * 0.08], [len * 0.75, -bend * 0.56], [len * 0.97, -bend * 0.94]], 6), len * 0.009, len * 0.002, "rgba(175,182,101,.6)");
  outline(); g.strokeStyle = "rgba(36,62,29,.45)"; g.lineWidth = len * 0.0025; g.stroke();
  g.restore();
}

export function openingLychee(size, { age = 0, seed = 21 } = {}) {
  const c = mk(size, size), g = c.getContext("2d"), R = rng(seed);
  const a1 = clamp(age), a2 = clamp(age - 1), a3 = clamp(age - 2);
  // 四张贴图保持同一轮廓；萎缩由场景网格连续缩放，避免叠化出双边。
  const r = size * 0.3, cx = size / 2, cy = size * 0.56;
  const fresh = [194, 48, 42], dull = [159, 52, 39], brown = [118, 65, 40];
  const base = mix(mix(fresh, dull, a1 * 0.72), brown, a2 * 0.55 + a3 * 0.3);
  const surface = (u, v) => {
    const sx = Math.sin(u) * Math.cos(v), sy = Math.sin(v);
    const wob = 1 + 0.013 * Math.sin(v * 5 + seed);
    return [cx + sx * r * wob, cy + sy * r * (1.04 + Math.max(0, sy) * 0.08)];
  };
  const shape = () => {
    g.beginPath();
    for (let i = 0; i <= 160; i++) {
      const t = i / 160 * Math.PI * 2, sy = Math.sin(t), v = Math.asin(sy);
      const wob = 1 + 0.013 * Math.sin(v * 5 + seed);
      const x = cx + Math.cos(t) * r * wob, y = cy + sy * r * (1.04 + Math.max(0, sy) * 0.08);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
  };
  leaf(g, cx + r * 0.05, cy - r * 1.02, r * 1.5, r * 0.34, -2.6, age, seed + 2);
  leaf(g, cx + r * 0.05, cy - r * 1.02, r * 1.35, r * 0.30, -0.55, age, seed + 3);
  g.save(); shape(); g.clip();
  const under = g.createRadialGradient(cx - r * 0.34, cy - r * 0.42, r * 0.1, cx, cy, r * 1.18);
  under.addColorStop(0, rgb(mix(base, [244, 142, 105], 0.38 * (1 - a2 * 0.6))));
  under.addColorStop(0.5, rgb(base)); under.addColorStop(1, rgb(mix(base, [45, 13, 14], 0.58)));
  g.fillStyle = under; g.fillRect(cx - r * 1.2, cy - r * 1.2, r * 2.4, r * 2.4);

  // 在球面的经纬网格上打乱种子，鳞片到了边缘自然压窄。
  const step = 0.081, rows = 42, grid = [], cells = [];
  for (let j = 0; j < rows; j++) {
    grid[j] = [];
    for (let i = 0; i < rows; i++) {
      const s = { x: (i - 20.5 + (j % 2) * 0.5 + (R() - 0.5) * 0.65) * step,
        y: (j - 20.5 + (R() - 0.5) * 0.65) * step, tone: R(), peak: R(), i, j };
      grid[j][i] = s; cells.push(s);
    }
  }
  const shade = (s) => {
    const nx = Math.sin(s.x) * Math.cos(s.y), ny = Math.sin(s.y), nz = Math.cos(s.x) * Math.cos(s.y);
    const light = clamp(-nx * 0.38 - ny * 0.5 + nz * 0.77);
    let col = mix(base, [230, 102, 65], (s.tone - 0.3) * 0.22 * (1 - a2 * 0.7));
    col = mix(col, [37, 13, 16], 0.49 * (1 - light));
    return mix(col, [255, 171, 119], Math.pow(light, 5) * 0.25 * (1 - a2 * 0.6));
  };
  for (const s of cells) {
    if (Math.abs(s.x) > Math.PI / 2 || Math.abs(s.y) > Math.PI / 2) continue;
    const neighbors = [];
    for (let j = Math.max(0, s.j - 2); j <= Math.min(rows - 1, s.j + 2); j++)
      for (let i = Math.max(0, s.i - 2); i <= Math.min(rows - 1, s.i + 2); i++) neighbors.push(grid[j][i]);
    const uv = cell(s, neighbors, step * 1.6), points = uv.map(([u, v]) => surface(clamp(u, -Math.PI / 2, Math.PI / 2), clamp(v, -Math.PI / 2, Math.PI / 2)));
    if (points.length < 3) continue;
    const [x, y] = surface(s.x, s.y), col = shade(s);
    const bump = r * step * (0.35 + s.peak * 0.15), crest = [x - bump * 0.24, y - bump * 0.28];
    path(g, points); g.fillStyle = rgb(mix(col, [59, 22, 16], 0.3)); g.fill();
    // 轻微内缩给果皮留下细沟，凸起的受光面是暖红，背光面偏深。
    const inner = points.map(([px, py]) => [lerp(x, px, 0.93), lerp(y, py, 0.93)]);
    path(g, inner);
    const relief = g.createRadialGradient(crest[0], crest[1], bump * 0.06, x, y + bump * 0.12, bump * 1.45);
    relief.addColorStop(0, rgb(mix(col, [255, 177, 122], 0.36 * (1 - a2 * 0.5))));
    relief.addColorStop(0.32, rgb(mix(col, [237, 117, 75], 0.17)));
    relief.addColorStop(0.72, rgb(col)); relief.addColorStop(1, rgb(mix(col, [61, 20, 16], 0.27)));
    g.fillStyle = relief; g.fill();
    // 小突尖和很短的裂隙，不用每格一个黑圆点。
    const tip = r * (0.0009 + s.peak * 0.0015);
    g.fillStyle = rgb(mix(col, [255, 203, 146], 0.43), 0.6 * (1 - a2 * 0.55));
    g.beginPath(); g.ellipse(crest[0], crest[1] - tip, tip * 1.3, tip * 0.65, -0.5, 0, Math.PI * 2); g.fill();
    if (s.tone > 0.45) {
      g.strokeStyle = rgb(mix(col, [55, 18, 14], 0.6), 0.5); g.lineWidth = r * 0.0014;
      g.beginPath(); g.moveTo(x + bump * 0.08, y + bump * 0.12); g.lineTo(x + bump * 0.22, y + bump * 0.4); g.stroke();
    }
  }
  // 细孔和斑驳叠在鳞片上，保留插画质感。
  const D = rng(seed + 90);
  for (let i = 0; i < 7200; i++) {
    const u = (D() - 0.5) * Math.PI, v = (D() - 0.5) * Math.PI, [x, y] = surface(u, v);
    const sz = r * (0.0007 + D() * 0.0017), k = D();
    g.fillStyle = k < 0.68 ? "rgba(57,17,12,.13)" : `rgba(255,174,119,${0.14 * (1 - a2 * 0.5)})`;
    g.beginPath(); g.ellipse(x, y, Math.max(sz * 0.25, sz * Math.cos(u)), sz, 0, 0, Math.PI * 2); g.fill();
  }
  const ageR = rng(seed + 133);
  for (let i = 0; i < 24; i++) {
    const x = cx + (ageR() - 0.5) * r * 1.7, y = cy + (ageR() - 0.5) * r * 1.8, rad = r * (0.06 + ageR() * 0.16);
    const stain = g.createRadialGradient(x, y, 0, x, y, rad);
    stain.addColorStop(0, `rgba(76,42,21,${(0.12 * a1 + 0.24 * a2 + 0.12 * a3) * (0.6 + ageR() * 0.4)})`);
    stain.addColorStop(1, "rgba(76,42,21,0)"); g.fillStyle = stain; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  if (a3 > 0) {
    g.strokeStyle = "rgba(49,27,17,.3)"; g.lineWidth = r * 0.0025;
    for (let i = 0; i < 30; i++) {
      const u = (ageR() - 0.5) * 2.5, v = (ageR() - 0.5) * 2.4;
      g.beginPath();
      for (let k = 0; k <= 8; k++) { const p = surface(u + k * 0.011 + Math.sin(k * 0.8 + i) * 0.008, v + k * 0.018); k ? g.lineTo(...p) : g.moveTo(...p); }
      g.stroke();
    }
  }
  const edge = g.createRadialGradient(cx - r * 0.12, cy - r * 0.15, r * 0.55, cx, cy, r * 1.13);
  edge.addColorStop(0, "rgba(43,11,14,0)"); edge.addColorStop(1, "rgba(43,11,14,.38)");
  g.fillStyle = edge; g.fillRect(cx - r * 1.2, cy - r * 1.2, r * 2.4, r * 2.4);
  g.restore();
  // 果蒂的凹窝、木质果柄和纤维。
  const stemPoints = smooth([[cx + r * 0.02, cy - r * 0.98], [cx + r * 0.05, cy - r * 1.18], [cx + r * 0.16, cy - r * 1.36]], 8);
  g.fillStyle = "rgba(62,35,18,.7)"; g.beginPath(); g.ellipse(cx + r * 0.025, cy - r * 1.01, r * 0.09, r * 0.038, -0.15, 0, Math.PI * 2); g.fill();
  stroke(g, stemPoints, r * 0.083, r * 0.055, "#5b3e24");
  stroke(g, stemPoints.map(([x, y]) => [x - r * 0.018, y - r * 0.003]), r * 0.017, r * 0.009, "#9b7b46");
  for (let i = 0; i < 7; i++) {
    const t = 0.1 + i * 0.12, p = stemPoints[Math.floor(t * (stemPoints.length - 1))];
    stroke(g, [[p[0] - r * 0.024, p[1] - r * 0.006], [p[0] + r * 0.023, p[1] + r * 0.006]], r * 0.004, r * 0.002, "rgba(40,26,16,.45)");
  }
  return c;
}
