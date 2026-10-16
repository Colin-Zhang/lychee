// 每个立体场景的地面：真实地形（SRTM，竖向夸张 V 倍）+ 由高程算出的水系 + 路线（按坡度自动找的山路 / 顺着河道的航线）。
// 纯 JS，node 里也能跑（tools/landmap.mjs 画俯视图检查）。
import { projector, demField, hydrology, rivers, flowPath } from "./dem.js";
import { PolyDist, findPath, chaikin, resample, smoothArr, clamp, lerp, smoothstep } from "./landform.js";

/**
 * cfg：
 *   center [经, 纬]（本地坐标原点）、crop [西, 南, 东, 北]、stride、V、farStride
 *   rivers：传给 rivers() 的参数（false 不画小河）
 *   water：{ level } 大江大湖的水面（真实米），用一张水平的水面来画（长江、汉水这种平原上的宽河）
 *   boat：{ from: [经, 纬], len 米, dir: "down" | "up", via: [[经, 纬], …]（不用水系时，按这几个点连成航线）}
 *   road：{ from: [经, 纬], to: [经, 纬] | "boat"（接到船的起点旁边）, slopeK, maxGrade, climb }
 */
export function buildLand(dem, far, cfg) {
  const { center, crop, stride = 2, V = 1.35 } = cfg;
  const proj = projector(dem.meta, center), projFar = projector(far.meta, center);
  const F = demField(dem, proj, { crop, stride, V }), G = demField(far, projFar, { stride: cfg.farStride ?? 3, V });
  const nx = F.nx, nz = F.nz, cellKm2 = (F.d * F.d) / 1e6, hy = hydrology(F);
  const cell = (x, z) => clamp(Math.round((z - F.z0) / F.d), 0, nz - 1) * nx + clamp(Math.round((x - F.x0) / F.d), 0, nx - 1);
  const areaAt = (x, z) => hy.acc[cell(x, z)] * cellKm2;
  const waterY = cfg.water ? cfg.water.level * V : null;
  // ── 小河：汇水够大的画成水带，河床往下挖一点（有大水面的场景，水面以下的不画）
  const RV = cfg.rivers === false ? [] : rivers(F, hy, { minKm2: 4, widthK: 4.5, minW: 7, maxW: 110, smooth: 4, ...(cfg.rivers || {}) }).filter((r) => waterY == null || Math.min(...r.ys) > waterY + 1.5);
  for (const r of RV) for (let i = 0; i < r.pts.length; i++) {
    const [x, z] = r.pts[i], w = r.ws[i] / 2, y = r.ys[i] - 2.4, Rr = w + 45;
    const i0 = Math.max(0, Math.floor((x - Rr - F.x0) / F.d)), i1 = Math.min(nx - 1, Math.ceil((x + Rr - F.x0) / F.d)), j0 = Math.max(0, Math.floor((z - Rr - F.z0) / F.d)), j1 = Math.min(nz - 1, Math.ceil((z + Rr - F.z0) / F.d));
    for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) { const d = Math.hypot(F.x0 + ii * F.d - x, F.z0 + j * F.d - z); if (d > Rr) continue; const k = j * nx + ii, tg = lerp(y, F.h[k], smoothstep(w * 0.7, Rr, d)); if (tg < F.h[k]) F.h[k] = tg; }
  }
  // 大水面：水面以下一点的地方压平，岸边不会有锯齿
  if (waterY != null) F.map((x, z, h) => (h < waterY + 0.6 * V ? Math.min(h, waterY - 2) : h));
  // ── 航线
  let boat2 = null, boatY = null, BD = null, slope = null;
  if (cfg.boat) {
    let pts;
    if (cfg.boat.via) {
      // 按给的几个点连线；有大水面时，每个点挪到附近离岸最远的地方（江心）
      let via = cfg.boat.via.map(([a, b]) => proj(a, b));
      if (waterY != null && cfg.boat.snap) {
        const N = nx * nz, dist = new Float32Array(N).fill(1e9), q = new Int32Array(N); let qh = 0, qt = 0;
        for (let k = 0; k < N; k++) if (F.h[k] > waterY - 1) { dist[k] = 0; q[qt++] = k; }
        while (qh < qt) { const k = q[qh++], i = k % nx, j = (k / nx) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const m = b * nx + a; if (dist[m] > dist[k] + 1) { dist[m] = dist[k] + 1; q[qt++] = m; } } }
        const R = Math.ceil(cfg.boat.snap / F.d);
        via = via.map(([x, z]) => { const i0 = Math.round((x - F.x0) / F.d), j0 = Math.round((z - F.z0) / F.d); let best = [x, z], bd = -1; for (let b = -R; b <= R; b++) for (let a = -R; a <= R; a++) { const i = clamp(i0 + a, 0, nx - 1), j = clamp(j0 + b, 0, nz - 1), dd = dist[j * nx + i] - Math.hypot(a, b) * 0.15; if (dd > bd) { bd = dd; best = [F.x0 + i * F.d, F.z0 + j * F.d]; } } return best; });
      }
      pts = resample(chaikin(via, 5), 8);
    } else {
      let [bx, bz] = proj(...cfg.boat.from);
      if (cfg.boat.minKm2) { let bd = Infinity; for (const r of RV) r.pts.forEach(([x, z], i) => { if (r.area[i] < cfg.boat.minKm2) return; const d = Math.hypot(x - bx, z - bz); if (d < bd) { bd = d; bx = x; bz = z; } }); }
      const fp = flowPath(F, hy, bx, bz);
      pts = resample(chaikin(fp.map(([x, z]) => [x, z]), 4), 8);
    }
    const fill = (x, z) => { const i = Math.round((x - F.x0) / F.d), j = Math.round((z - F.z0) / F.d); let m = Infinity; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) m = Math.min(m, hy.filled[clamp(j + b, 0, nz - 1) * nx + clamp(i + a, 0, nx - 1)]); return m; };
    if (cfg.boat.skip) { let s0 = 0, k = 1; for (; k < pts.length && s0 < cfg.boat.skip; k++) s0 += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); pts = pts.slice(k - 1); }
    if (cfg.boat.len) { let s0 = 0, k = 1; for (; k < pts.length && s0 < cfg.boat.len; k++) s0 += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); pts = pts.slice(0, k); }
    let raw = pts.map(([x, z]) => fill(x, z));
    if (cfg.boat.wide) { const r = 120; raw = raw.map((_, i) => { let m = Infinity; for (let k = Math.max(0, i - r); k <= Math.min(raw.length - 1, i + r); k++) m = Math.min(m, raw[k]); return m; }); }   // 宽河取下包络，免得开头落在岸上
    let ys = waterY != null ? pts.map(() => waterY) : Array.from(smoothArr(raw, 10, 4));
    if (waterY == null) for (let i = 1; i < ys.length; i++) ys[i] = Math.min(ys[i], ys[i - 1]);
    // 宽的大河（赣江、汉水）：沿航线一张顺着水势倾斜的水面，离航线 reach 米以内、低于水面的地方压平成河床
    if (cfg.boat.wide) {
      const PD = new PolyDist(pts, 200), reach = cfg.boat.wide.reach ?? 1500, lift = (cfg.boat.wide.lift ?? 0.6) * V, lvl = Float32Array.from(ys, (y) => y + lift);
      const lv = (x, z) => { const qq = PD.query(x, z, reach); if (!qq) return null; const k = clamp(qq.s / 8, 0, lvl.length - 1.001), i = Math.floor(k); return { y: lerp(lvl[i], lvl[i + 1], k - i), d: qq.d }; };
      F.map((x, z, h) => { const l = lv(x, z); if (!l) return h; return h < l.y + 0.5 * V ? Math.min(h, l.y - 2 - 3 * smoothstep(0, 300, reach - l.d)) : h; });
      slope = { pts, lvl, reach, at: lv };
      ys = Array.from(lvl);
    }
    if (cfg.boat.dir === "up") { pts.reverse(); ys.reverse(); }
    boat2 = pts; boatY = Float32Array.from(ys); BD = new PolyDist(pts, 200);
  }
  // ── 山路
  let road = null, roadH = null, RD = null, roadY = null, sTop = 0, top = 0, port = null;
  if (cfg.road) {
    const start = proj(...cfg.road.from);
    let end;
    if (cfg.road.to === "boat") { const b = BD.at(0), w = (cfg.road.portW ?? 60) / 2 + 14, sx = Math.sign((start[0] - b.x) * -b.dz + (start[1] - b.z) * b.dx) || 1; end = port = [b.x - b.dz * sx * w, b.z + b.dx * sx * w]; }
    else end = proj(...cfg.road.to);
    const raw = findPath(F, start, end, { cell: 35, slopeK: cfg.road.slopeK ?? 26, maxGrade: cfg.road.maxGrade ?? 0.13, climb: cfg.road.climb ?? 0.45, cost: (x, z) => (areaAt(x, z) > 2.5 || (waterY != null && F.at(x, z) < waterY + 1) ? 8 : 0) });
    road = resample(chaikin(raw, 4), 6); roadH = smoothArr(road.map(([x, z]) => F.at(x, z)), 8, 4); RD = new PolyDist(road, 40);
    roadY = (s) => { const k = clamp(s / 6, 0, roadH.length - 1.001), i = Math.floor(k), f = k - i; return roadH[i] * (1 - f) + roadH[i + 1] * f; };
    F.map((x, z, h) => { const q = RD.query(x, z, 32); if (!q) return h; return h + (roadY(q.s) - 0.4 - h) * (1 - smoothstep(4.5, 32, q.d)); });
    for (let i = 1; i < roadH.length; i++) if (roadH[i] > roadH[top]) top = i;
    sTop = top * 6;
  }
  const rect = { x0: F.x0, x1: F.x0 + F.d * (nx - 1), z0: F.z0, z1: F.z0 + F.d * (nz - 1) };
  return { F, G, hy, RV, road, roadH, RD, roadY, sTop, top, roadLen: road ? (road.length - 1) * 6 : 0, boat2, boatY, BD, rect, areaAt, proj, V, waterY, slope, port, cfg };
}
