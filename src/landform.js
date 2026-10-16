// 地形工具（纯 JS，不碰浏览器，node 里也能跑）：噪声、到折线的距离、高度场、按坡度自动找山路、折线平滑与重采样。
// 单位：米；x 向东、z 向南（three.js 里看向 -z 就是朝北）。
export const rng = (s) => { let x = s >>> 0 || 1; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; };
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** 二维梯度噪声，约 -1..1 */
export function perlin(seed) {
  const R = rng(seed), p = new Uint16Array(512), gx = new Float32Array(256), gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) { p[i] = i; const a = R() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 256; i++) p[256 + i] = p[i];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, X = xi & 255, Y = yi & 255;
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const h00 = p[p[X] + Y], h10 = p[p[X + 1] + Y], h01 = p[p[X] + Y + 1], h11 = p[p[X + 1] + Y + 1];
    const a = gx[h00] * fx + gy[h00] * fy, b = gx[h10] * (fx - 1) + gy[h10] * fy, c = gx[h01] * fx + gy[h01] * (fy - 1), d = gx[h11] * (fx - 1) + gy[h11] * (fy - 1);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 1.41;
  };
}
export const fbm = (n, x, y, oct = 5) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f); f *= 2.03; a *= 0.5; } return s; };
/** 山脊噪声：尖脊、圆谷，约 0..1 */
export const ridged = (n, x, y, oct = 6) => { let s = 0, a = 0.5, f = 1, w = 1; for (let i = 0; i < oct; i++) { let v = 1 - Math.abs(n(x * f, y * f)); v *= v; v *= w; w = clamp(v * 2); s += v * a; f *= 2.05; a *= 0.5; } return s; };

/** 到一条折线的最近距离（网格分桶加速）。pts：[[x, z], …] */
export class PolyDist {
  constructor(pts, cell = 50) {
    this.p = pts; this.c = cell; this.cum = [0]; this.g = new Map();
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.L = this.cum[this.cum.length - 1];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const i0 = Math.floor(Math.min(ax, bx) / cell), i1 = Math.floor(Math.max(ax, bx) / cell), j0 = Math.floor(Math.min(az, bz) / cell), j1 = Math.floor(Math.max(az, bz) / cell);
      for (let a = i0; a <= i1; a++) for (let b = j0; b <= j1; b++) { const k = (a + 32768) * 65536 + (b + 32768); let l = this.g.get(k); if (!l) this.g.set(k, (l = [])); l.push(i); }
    }
  }
  /** { d 距离, s 沿线长度, i 段号, f 段内比例 }；超过 maxD 返回 null */
  query(x, z, maxD) {
    const c = this.c, i0 = Math.floor((x - maxD) / c), i1 = Math.floor((x + maxD) / c), j0 = Math.floor((z - maxD) / c), j1 = Math.floor((z + maxD) / c);
    let bd = maxD * maxD, bi = -1, bf = 0;
    for (let a = i0; a <= i1; a++) for (let b = j0; b <= j1; b++) {
      const l = this.g.get((a + 32768) * 65536 + (b + 32768)); if (!l) continue;
      for (const i of l) {
        const ax = this.p[i][0], az = this.p[i][1], dx = this.p[i + 1][0] - ax, dz = this.p[i + 1][1] - az, L2 = dx * dx + dz * dz || 1;
        let f = ((x - ax) * dx + (z - az) * dz) / L2; f = f < 0 ? 0 : f > 1 ? 1 : f;
        const ex = ax + dx * f - x, ez = az + dz * f - z, d2 = ex * ex + ez * ez;
        if (d2 < bd) { bd = d2; bi = i; bf = f; }
      }
    }
    if (bi < 0) return null;
    return { d: Math.sqrt(bd), i: bi, f: bf, s: this.cum[bi] + bf * (this.cum[bi + 1] - this.cum[bi]) };
  }
  /** 沿线长度 s 处的点和方向 */
  at(s) {
    s = clamp(s, 0, this.L); const C = this.cum; let lo = 0, hi = C.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (C[m] < s) lo = m; else hi = m; }
    const f = (s - C[lo]) / (C[hi] - C[lo] || 1), a = this.p[lo], b = this.p[hi], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    return { x: a[0] + dx * f, z: a[1] + dz * f, dx: dx / L, dz: dz / L, i: lo, f };
  }
}

/** 规则网格高度场：nx×nz 个点，间距 d 米，左上角 (x0, z0)。fn(x, z) 给高度；也可以 Field.from(数组, …) 直接用现成的高度 */
export class Field {
  constructor(fn, x0, z0, size, n, nz = n) {
    this.x0 = x0; this.z0 = z0; this.nx = n; this.nz = nz; this.n = n; this.d = size / (n - 1); this.size = size; this.h = new Float32Array(n * nz);
    if (fn) for (let j = 0; j < nz; j++) for (let i = 0; i < n; i++) this.h[j * n + i] = fn(x0 + i * this.d, z0 + j * this.d);
  }
  static from(h, nx, nz, x0, z0, d) { const F = new Field(null, x0, z0, d * (nx - 1), nx, nz); F.h = h; return F; }
  at(x, z) {
    const nx = this.nx, gx = clamp((x - this.x0) / this.d, 0, nx - 1.0001), gz = clamp((z - this.z0) / this.d, 0, this.nz - 1.0001), i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, h = this.h, k = j * nx + i;
    return (h[k] * (1 - fx) + h[k + 1] * fx) * (1 - fz) + (h[k + nx] * (1 - fx) + h[k + nx + 1] * fx) * fz;
  }
  slope(x, z, e = this.d) { const dx = (this.at(x + e, z) - this.at(x - e, z)) / (2 * e), dz = (this.at(x, z + e) - this.at(x, z - e)) / (2 * e); return Math.hypot(dx, dz); }
  /** 每个点处理一次（x, z, h）→ 新高度 */
  map(fn) { const nx = this.nx; for (let j = 0; j < this.nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; this.h[k] = fn(this.x0 + i * this.d, this.z0 + j * this.d, this.h[k]); } return this; }
  /** 盒式模糊（半径 r 格，两遍）→ 新数组 */
  blur(r, src = this.h) {
    const nx = this.nx, nz = this.nz, a = Float32Array.from(src), b = new Float32Array(nx * nz);
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < nz; j++) { let s = 0, c = 0; for (let i = -r; i <= r; i++) { if (i >= 0 && i < nx) { s += a[j * nx + i]; c++; } } for (let i = 0; i < nx; i++) { b[j * nx + i] = s / c; const o = i - r, e = i + r + 1; if (o >= 0) { s -= a[j * nx + o]; c--; } if (e < nx) { s += a[j * nx + e]; c++; } } }
      for (let i = 0; i < nx; i++) { let s = 0, c = 0; for (let j = -r; j <= r; j++) { if (j >= 0 && j < nz) { s += b[j * nx + i]; c++; } } for (let j = 0; j < nz; j++) { a[j * nx + i] = s / c; const o = j - r, e = j + r + 1; if (o >= 0) { s -= b[o * nx + i]; c--; } if (e < nz) { s += b[e * nx + i]; c++; } } }
    }
    return a;
  }
}

/** 按坡度找路（A*，16 个方向）：坡越陡越贵，上坡另加一点代价——自然会绕山、走之字形、过垭口 */
export function findPath(F, from, to, { cell = 20, slopeK = 28, maxGrade = 0.16, climb = 0.6, cost = null } = {}) {
  const n = Math.floor((F.d * (F.nx - 1)) / cell) + 1, nz = Math.floor((F.d * (F.nz - 1)) / cell) + 1, x0 = F.x0, z0 = F.z0, N = n * nz;
  const hs = new Float32Array(N); for (let j = 0; j < nz; j++) for (let i = 0; i < n; i++) hs[j * n + i] = F.at(x0 + i * cell, z0 + j * cell);
  const extra = cost ? new Float32Array(N).map((_, k) => cost(x0 + (k % n) * cell, z0 + Math.floor(k / n) * cell)) : null;
  const toI = ([x, z]) => [clamp(Math.round((x - x0) / cell), 0, n - 1), clamp(Math.round((z - z0) / cell), 0, nz - 1)];
  const [si, sj] = toI(from), [ti, tj] = toI(to), S = sj * n + si, T = tj * n + ti;
  const g = new Float64Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const heap = []; const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const moves = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [2, 1], [1, 2], [-2, 1], [-1, 2], [2, -1], [1, -2], [-2, -1], [-1, -2]];
  g[S] = 0; push(0, S);
  while (heap.length) {
    const [, k] = pop(); if (done[k]) continue; done[k] = 1; if (k === T) break;
    const i = k % n, j = (k / n) | 0;
    for (const [di, dj] of moves) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= n || b >= nz) continue;
      const m = b * n + a; if (done[m]) continue;
      const len = cell * Math.hypot(di, dj), dh = hs[m] - hs[k], gr = Math.abs(dh) / len;
      const c = g[k] + len * (1 + slopeK * gr * gr + (extra ? extra[m] : 0)) + (gr > maxGrade ? len * 80 * (gr - maxGrade) : 0) + Math.max(0, dh) * climb;
      if (c < g[m]) { g[m] = c; came[m] = k; push(c + Math.hypot(a - ti, b - tj) * cell, m); }
    }
  }
  const out = []; for (let k = T; k >= 0; k = came[k]) { out.push([x0 + (k % n) * cell, z0 + ((k / n) | 0) * cell]); if (k === S) break; }
  return out.reverse();
}

/** Chaikin 切角平滑（保留两端） */
export function chaikin(pts, iter = 3) {
  let p = pts;
  for (let t = 0; t < iter; t++) { const q = [p[0]]; for (let i = 0; i < p.length - 1; i++) { const [ax, az] = p[i], [bx, bz] = p[i + 1]; q.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]); } q.push(p[p.length - 1]); p = q; }
  return p;
}
/** 按固定间距重采样 */
export function resample(pts, step) {
  const out = [pts[0]]; let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); let s = step - carry;
    while (s <= L) { out.push([ax + ((bx - ax) * s) / L, az + ((bz - az) * s) / L]); s += step; }
    carry = L - (s - step);
  }
  const e = pts[pts.length - 1], l = out[out.length - 1]; if (Math.hypot(e[0] - l[0], e[1] - l[1]) > step * 0.3) out.push(e);
  return out;
}
/** 让折线蜿蜒一点（低频横向偏移，两端不动） */
export function meander(pts, amp, wave, seed = 1) {
  const N = perlin(seed); let s = 0;
  return pts.map((p, i) => {
    if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    if (i === 0 || i === pts.length - 1) return p;
    const a = pts[i - 1], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dx, dz) || 1, k = Math.min(1, i / 8, (pts.length - 1 - i) / 8);
    const o = N(s / wave, 0.5) * amp * k; return [p[0] - (dz / d) * o, p[1] + (dx / d) * o];
  });
}
/** 一串高度做滑动平均（半径 r 个点，几遍） */
export function smoothArr(a, r, passes = 3) {
  let x = Float32Array.from(a);
  for (let p = 0; p < passes; p++) { const y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) { let s = 0, c = 0; for (let k = -r; k <= r; k++) { const j = i + k; if (j >= 0 && j < x.length) { s += x[j]; c++; } } y[i] = s / c; } x = y; }
  return x;
}
