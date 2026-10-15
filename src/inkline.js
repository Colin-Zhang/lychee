// 地图上的墨线：一条折线做成带状网格，按长度一点点“画出来”（uProg），边缘柔和、带干笔的斑驳；水路可以画成虚线，线头可以发亮。
// 坐标：地图像素 (x, y) → 世界 (x - MW/2, h, y - MH/2)。线宽 uWidth 是世界单位（每帧按镜头远近换算成固定的屏幕粗细）。
import * as THREE from "three";
import { MW, MH } from "./map.js";

const rnd = (s) => { let x = s >>> 0 || 1; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; };

export class InkLine {
  /**
   * pts：[[x, y], …] 地图像素；kinds：每一点到下一点是 "w"（水路）还是 "l"（陆路）
   * opt：colL / colW（颜色）、dashAll（整条虚线）、dashW（水路虚线）、wobble（手抖幅度，像素）、step（重采样间距）
   */
  constructor(pts, { kinds = null, colL = "#b8342a", colW = "#3d6f8a", dashAll = false, dashW = true, wobble = 2.5, step = 8, seed = 1, h = 4, order = 10 } = {}) {
    const R = rnd(seed), dense = [], kd = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / step));
      for (let k = 0; k < n; k++) { const f = k / n; dense.push([x0 + (x1 - x0) * f, y0 + (y1 - y0) * f]); kd.push(kinds ? (kinds[i] === "w" ? 1 : 0) : 0); }
    }
    dense.push(pts[pts.length - 1]); kd.push(kd[kd.length - 1] ?? 0);
    // 手抖：低频的横向偏移
    let ph = R() * 10; const wob = dense.map((p, i) => { ph += 0.07 + R() * 0.03; return Math.sin(ph) * wobble + Math.sin(ph * 2.7) * wobble * 0.4; });
    const n = dense.length, pos = new Float32Array(n * 2 * 3), nrm = new Float32Array(n * 2 * 2), side = new Float32Array(n * 2), sArr = new Float32Array(n * 2), kind = new Float32Array(n * 2), idx = [];
    let s = 0;
    for (let i = 0; i < n; i++) {
      const a = dense[Math.max(0, i - 1)], b = dense[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
      if (i) s += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
      const cx = dense[i][0] + nx * wob[i] - MW / 2, cz = dense[i][1] + ny * wob[i] - MH / 2;
      for (let k = 0; k < 2; k++) { const j = i * 2 + k; pos.set([cx, h, cz], j * 3); nrm.set([nx, ny], j * 2); side[j] = k ? 1 : -1; sArr[j] = s; kind[j] = kd[i]; }
      if (i < n - 1) { const j = i * 2; idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
    }
    this.length = s; this.pts = dense;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aN", new THREE.BufferAttribute(nrm, 2)); g.setAttribute("aSide", new THREE.BufferAttribute(side, 1)); g.setAttribute("aS", new THREE.BufferAttribute(sArr, 1)); g.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uProg: { value: 0 }, uFrom: { value: 0 }, uWidth: { value: 10 }, uColL: { value: new THREE.Color(colL) }, uColW: { value: new THREE.Color(colW) }, uOpacity: { value: 1 }, uDash: { value: 0 }, uDashAll: { value: dashAll ? 1 : 0 }, uDashW: { value: dashW ? 1 : 0 }, uHead: { value: 0 }, uPulse: { value: -1 }, uPulseLen: { value: 300 }, uGrey: { value: 0 } },
      vertexShader: `attribute vec2 aN; attribute float aSide, aS, aKind; uniform float uWidth; varying float vS, vSide, vKind;
        void main(){ vS = aS; vSide = aSide; vKind = aKind; vec3 p = position + vec3(aN.x, 0.0, aN.y) * aSide * uWidth; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform float uProg, uFrom, uOpacity, uDash, uDashAll, uDashW, uHead, uPulse, uPulseLen, uGrey; uniform vec3 uColL, uColW; varying float vS, vSide, vKind;
        void main(){
          if (vS > uProg || vS < uFrom) discard;
          float edge = 1.0 - smoothstep(0.5, 1.0, abs(vSide));
          float n = fract(sin(floor(vS * 0.35) * 12.9898 + floor(vSide * 3.0) * 78.233) * 43758.5453);
          float a = edge * (0.82 + 0.18 * n);
          vec3 col = mix(uColL, uColW, vKind);
          float dash = max(uDashAll, uDashW * vKind);
          if (dash > 0.5 && uDash > 0.0) { float m = mod(vS, uDash * 1.7); a *= m > uDash ? 0.0 : 1.0; }
          float hd = uHead > 0.0 ? clamp(1.0 - (uProg - vS) / uHead, 0.0, 1.0) : 0.0;
          col = mix(col, vec3(1.0, 0.88, 0.62), hd * 0.55);
          if (uPulse >= 0.0) { float pd = clamp(1.0 - abs(vS - uPulse) / uPulseLen, 0.0, 1.0); col = mix(col, vec3(1.0, 0.9, 0.66), pd * 0.75); a = max(a, pd * edge); }
          col = mix(col, vec3(dot(col, vec3(0.33))) * 0.9 + 0.08, uGrey);
          gl_FragColor = vec4(col, a * uOpacity);
        }`,
      transparent: true, depthTest: false, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.renderOrder = order; this.mesh.frustumCulled = false;
  }
  /** prog：画到的长度比例（0–1）；wpx：一个屏幕像素是多少世界单位；width：屏幕粗细（像素） */
  set(prog, wpx, width = 6, opacity = 1, from = 0) {
    const u = this.mat.uniforms; u.uProg.value = prog * this.length + 0.01; u.uFrom.value = from * this.length; u.uWidth.value = (width / 2) * wpx; u.uOpacity.value = opacity;
    u.uDash.value = 14 * wpx; u.uHead.value = 0;
    this.mesh.visible = opacity > 0.003 && prog > 0.0005;
  }
  /** 线头位置（地图像素）和方向 */
  at(prog) {
    const target = prog * this.length; let s = 0;
    for (let i = 1; i < this.pts.length; i++) { const d = Math.hypot(this.pts[i][0] - this.pts[i - 1][0], this.pts[i][1] - this.pts[i - 1][1]); if (s + d >= target) { const f = (target - s) / (d || 1); return { x: this.pts[i - 1][0] + (this.pts[i][0] - this.pts[i - 1][0]) * f, y: this.pts[i - 1][1] + (this.pts[i][1] - this.pts[i - 1][1]) * f, dx: this.pts[i][0] - this.pts[i - 1][0], dy: this.pts[i][1] - this.pts[i - 1][1] }; } s += d; }
    const e = this.pts[this.pts.length - 1]; return { x: e[0], y: e[1], dx: 1, dy: 0 };
  }
}

/** 一串点（驿站）：每个点有自己的“出现时刻” aT（0–1），uT 走到哪就亮到哪；屏幕上大小固定 */
export class Dots {
  constructor(list /* [[x, y, t], …] */, { size = 9, fill = "#f3e6c6", ring = "#2b2219", h = 6, order = 12 } = {}) {
    const n = list.length, pos = new Float32Array(n * 3), tt = new Float32Array(n);
    list.forEach(([x, y, t], i) => { pos.set([x - MW / 2, h, y - MH / 2], i * 3); tt[i] = t; });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aT", new THREE.BufferAttribute(tt, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uSize: { value: size }, uFill: { value: new THREE.Color(fill) }, uRing: { value: new THREE.Color(ring) }, uOpacity: { value: 1 } },
      vertexShader: `attribute float aT; uniform float uT, uSize; varying float vK; void main(){ vK = clamp((uT - aT) * 40.0, 0.0, 1.0); gl_PointSize = uSize * (0.3 + 0.7 * vK) * (1.0 + 0.6 * (1.0 - vK) * step(0.01, vK)); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uFill, uRing; uniform float uOpacity; varying float vK; void main(){ if (vK <= 0.0) discard; float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; vec3 c = r > 0.62 ? uRing : uFill; float a = smoothstep(1.0, 0.86, r); gl_FragColor = vec4(c, a * vK * uOpacity); }`,
      transparent: true, depthTest: false, depthWrite: false,
    });
    this.points = new THREE.Points(g, this.mat); this.points.renderOrder = order; this.points.frustumCulled = false;
  }
  set(t, opacity = 1, size) { this.mat.uniforms.uT.value = t; this.mat.uniforms.uOpacity.value = opacity; if (size) this.mat.uniforms.uSize.value = size; this.points.visible = opacity > 0.003 && t > 0; }
}
