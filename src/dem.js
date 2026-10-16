// 真实地形：读 data/<名字>.bin（Int16，米）+ .json（tools/dem.py 生成），换成本地米制坐标（x 向东、z 向南，原点在整张图中心）；
// 再从高程算出水系：先把洼地填平（priority-flood），每一格流向“把它淹到的那一格”，累计汇水面积 → 汇水够大的就是河。
import { Field, PolyDist, chaikin, resample, smoothArr, clamp } from "./landform.js";

/** 浏览器里读；node 里传 { read: (file) => Buffer } */
export async function loadDEM(name, { base = "./data/", read = null } = {}) {
  if (read) { const meta = JSON.parse(read(`${base}${name}.json`).toString()); const b = read(`${base}${name}.bin`); return { meta, h: new Int16Array(b.buffer, b.byteOffset, b.length / 2) }; }
  const meta = await (await fetch(`${base}${name}.json`)).json();
  return { meta, h: new Int16Array(await (await fetch(`${base}${name}.bin`)).arrayBuffer()) };
}
/** 经纬度 → 本地米（相对这张图的中心） */
export function projector(meta, center = null) {
  const n = 2 ** meta.z, k = meta.m;
  const merc = (lon, lat) => { const r = (lat * Math.PI) / 180; return [((lon + 180) / 360) * n * 256, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * 256]; };
  const [cx, cy] = center ? merc(...center) : [meta.ox + meta.w / 2, meta.oy + meta.h / 2];
  const f = (lon, lat) => { const [X, Y] = merc(lon, lat); return [(X - cx) * k, (Y - cy) * k]; };
  f.merc = merc; f.cx = cx; f.cy = cy; return f;
}
/**
 * 高程 → Field。crop：[西, 南, 东, 北]（经纬度）；stride：隔几格取一格（取平均）；V：竖向夸张；center：本地坐标原点（经纬度，默认图中心）
 */
export function demField(dem, proj, { crop = null, stride = 2, V = 1.35, floor = -50 } = {}) {
  const { meta, h } = dem, W = meta.w;
  let i0 = 0, j0 = 0, i1 = meta.w, j1 = meta.h;
  if (crop) { const [a, b] = proj.merc(crop[0], crop[3]), [c, d] = proj.merc(crop[2], crop[1]); i0 = clamp(Math.floor(a - meta.ox), 0, meta.w); j0 = clamp(Math.floor(b - meta.oy), 0, meta.h); i1 = clamp(Math.ceil(c - meta.ox), 0, meta.w); j1 = clamp(Math.ceil(d - meta.oy), 0, meta.h); }
  const nx = Math.floor((i1 - i0) / stride), nz = Math.floor((j1 - j0) / stride), out = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    let s = 0; for (let b = 0; b < stride; b++) for (let a = 0; a < stride; a++) s += h[(j0 + j * stride + b) * W + i0 + i * stride + a];
    out[j * nx + i] = Math.max(floor, s / (stride * stride)) * V;
  }
  const d = meta.m * stride, x0 = (meta.ox + i0 + stride / 2 - proj.cx) * meta.m, z0 = (meta.oy + j0 + stride / 2 - proj.cy) * meta.m;
  const F = Field.from(out, nx, nz, x0, z0, d); F.V = V; return F;
}

/** 水系：返回 { down（每格流向哪一格，-1 是出口）, acc（汇水格数）, filled（填平后的高度）, order（从高到低）} */
export function hydrology(F) {
  const nx = F.nx, nz = F.nz, N = nx * nz, h = F.h, filled = new Float32Array(N), down = new Int32Array(N).fill(-1), seen = new Uint8Array(N), order = new Int32Array(N);
  // 小根堆（高度, 格）
  const hk = new Float32Array(N + 8), hv = new Int32Array(N + 8); let hn = 0;
  const push = (key, v) => { let i = hn++; hk[i] = key; hv[i] = v; while (i) { const p = (i - 1) >> 1; if (hk[p] <= hk[i]) break; [hk[p], hk[i]] = [hk[i], hk[p]]; [hv[p], hv[i]] = [hv[i], hv[p]]; i = p; } };
  const pop = () => { const v = hv[0]; hn--; if (hn) { hk[0] = hk[hn]; hv[0] = hv[hn]; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hn && hk[l] < hk[m]) m = l; if (r < hn && hk[r] < hk[m]) m = r; if (m === i) break; [hk[m], hk[i]] = [hk[i], hk[m]]; [hv[m], hv[i]] = [hv[i], hv[m]]; i = m; } } return v; };
  for (let i = 0; i < nx; i++) for (const j of [0, nz - 1]) { const k = j * nx + i; if (!seen[k]) { seen[k] = 1; filled[k] = h[k]; push(h[k], k); } }
  for (let j = 1; j < nz - 1; j++) for (const i of [0, nx - 1]) { const k = j * nx + i; if (!seen[k]) { seen[k] = 1; filled[k] = h[k]; push(h[k], k); } }
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]; let o = 0;
  while (hn) {
    const k = pop(); order[o++] = k; const i = k % nx, j = (k / nx) | 0;
    for (const [di, dj] of nb) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const m = b * nx + a; if (seen[m]) continue; seen[m] = 1; filled[m] = Math.max(h[m], filled[k] + 0.001); down[m] = k; push(filled[m], m); }
  }
  const acc = new Float32Array(N).fill(1);
  for (let q = N - 1; q >= 0; q--) { const k = order[q]; if (down[k] >= 0) acc[down[k]] += acc[k]; }
  return { down, acc, filled, order };
}

/** 汇水面积超过 minKm2 的河段 → 折线：[{ pts: [[x, z], …], ys, ws（宽，米）, acc }, …]，从上游往下游 */
export function rivers(F, hy, { minKm2 = 6, widthK = 7, minW = 8, maxW = 140, smooth = 2 } = {}) {
  const { down, acc, filled } = hy, nx = F.nx, cellKm2 = (F.d * F.d) / 1e6, T = minKm2 / cellKm2, N = nx * F.nz;
  const kids = new Uint8Array(N); for (let k = 0; k < N; k++) if (acc[k] >= T && down[k] >= 0) kids[down[k]]++;
  const used = new Uint8Array(N), out = [];
  const xz = (k) => [F.x0 + (k % nx) * F.d, F.z0 + Math.floor(k / nx) * F.d];
  for (let k = 0; k < N; k++) {
    if (acc[k] < T || kids[k] > 0 || used[k]) continue;
    const chain = [k]; let c = k; used[c] = 1;
    while (down[c] >= 0) { c = down[c]; chain.push(c); if (used[c]) break; used[c] = 1; }
    if (chain.length < 4) continue;
    let pts = chain.map(xz);
    const A = chain.map((q) => acc[q] * cellKm2), Y = chain.map((q) => filled[q]);
    pts = chaikin(pts, smooth);
    const f = (arr) => pts.map((_, i) => arr[Math.min(arr.length - 1, Math.round((i / (pts.length - 1)) * (arr.length - 1)))]);
    const ys = smoothArr(f(Y), 3, 2), area = f(A);
    for (let i = 1; i < ys.length; i++) ys[i] = Math.min(ys[i], ys[i - 1]);   // 水往低处流
    out.push({ pts, ys, ws: area.map((a) => clamp(minW + widthK * Math.sqrt(a), minW, maxW)), area });
  }
  return out;
}

/** 从某点顺着水流一直往下走（船的航线）：返回 [[x, z], …] */
export function flowPath(F, hy, x, z, { maxSteps = 100000 } = {}) {
  const nx = F.nx, i = clamp(Math.round((x - F.x0) / F.d), 0, nx - 1), j = clamp(Math.round((z - F.z0) / F.d), 0, F.nz - 1);
  // 先挪到附近汇水最大的一格（落在河道上）
  let best = j * nx + i, ba = -1;
  for (let b = -6; b <= 6; b++) for (let a = -6; a <= 6; a++) { const p = clamp(i + a, 0, nx - 1), q = clamp(j + b, 0, F.nz - 1), k = q * nx + p; if (hy.acc[k] > ba) { ba = hy.acc[k]; best = k; } }
  const out = []; let c = best, n = 0;
  while (c >= 0 && n++ < maxSteps) { out.push([F.x0 + (c % nx) * F.d, F.z0 + Math.floor(c / nx) * F.d, hy.filled[c]]); c = hy.down[c]; }
  return out;
}
