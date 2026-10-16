// 路线红线（加粗版）：屏幕上的粗细按像素算（立体场景里近处略粗），朱红线芯 + 墨色描边 + 外面一圈淡影；线头发亮；
// 还没走到的路画成淡虚线（预告往哪走）；立体场景里被山挡住的那段，从山后隐约透出来（虚线）。平铺的地图和立体场景共用。
import * as THREE from "three";

const VS = `attribute vec3 aPrev, aNext; attribute float aSide, aS, aKind;
  uniform vec2 uRes; uniform float uLift, uOff, uCore, uWorld, uMinPx, uMaxPx, uEdge, uHalo, uPx;
  varying float vS, vD, vCore, vEdge, vHalo, vKind, vWpp;
  vec4 proj(vec3 p){ p.y = p.y * uLift + uOff; return projectionMatrix * modelViewMatrix * vec4(p, 1.0); }
  void main(){
    vec4 c = proj(position), a = proj(aPrev), b = proj(aNext);
    if (c.w < 0.05) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
    vec2 sa = a.xy / max(a.w, 0.05) * uRes * 0.5, sb = b.xy / max(b.w, 0.05) * uRes * 0.5;
    vec2 d = sb - sa; float L = length(d); vec2 dir = L > 1e-5 ? d / L : vec2(1.0, 0.0), n = vec2(-dir.y, dir.x);
    float core = uWorld > 0.0 ? clamp(uWorld * projectionMatrix[1][1] * uRes.y * 0.5 / c.w, uMinPx * uPx, uMaxPx * uPx) : uCore * uPx;
    float edge = max(1.1 * uPx, core * uEdge), halo = core * uHalo + uPx;
    float hw = core * 0.5 + edge + halo + uPx;
    c.xy += n * aSide * hw / (uRes * 0.5) * c.w;
    vS = aS; vD = aSide * hw; vCore = core * 0.5; vEdge = edge; vHalo = halo; vKind = aKind; vWpp = c.w / (projectionMatrix[1][1] * uRes.y * 0.5) * uPx;
    gl_Position = c;
  }`;
const FS = `uniform float uProg, uFrom, uHead, uHeadGlow, uAhead, uDash, uOpacity, uGhost, uHaloA, uPx;
  uniform vec3 uCol, uColW, uEdgeCol, uHaloCol, uGlowCol; uniform float uDashPx, uAheadEnd;
  varying float vS, vD, vCore, vEdge, vHalo, vKind, vWpp;
  void main(){
    float per = max(uDash, vWpp * uDashPx);   // 虚线一段的长度：远处按屏幕像素算，不会碎成一排竖杠
    float d = abs(vD), aa = 0.8 * uPx;
    vec3 cc = mix(uCol, uColW, vKind);
    if (vS < uFrom) discard;
    if (vS > uProg) {
      // 还没走到：虚线（预告往哪走）；被山挡住的那段更淡
      if (uAhead <= 0.0 || vS > uAheadEnd) discard;
      if (mod(vS, per * 2.0) > per) discard;
      float th = 1.0 - smoothstep(vCore * 0.72 - aa, vCore * 0.72 + aa, d);
      float hl = 1.0 - smoothstep(vCore * 0.72 + aa, vCore * 0.72 + vEdge + aa, d);
      gl_FragColor = vec4(mix(uEdgeCol, cc, th / max(hl, 1e-3)), hl * uAhead * uOpacity * (uGhost > 0.5 ? 0.6 : 1.0));
      return;
    }
    if (uGhost > 0.5) {
      // 走过、但被山挡住：半透明的细线
      float th = 1.0 - smoothstep(vCore * 0.7 - aa, vCore * 0.7 + aa, d);
      gl_FragColor = vec4(cc, th * uOpacity);
      return;
    }
    float hd = uHead > 0.0 ? clamp(1.0 - (uProg - vS) / uHead, 0.0, 1.0) : 0.0;
    cc = mix(cc, cc * 1.2 + 0.08, (1.0 - smoothstep(0.0, vCore, d)) * 0.55);          // 线芯中间亮一点
    cc = mix(cc, uGlowCol, hd * hd * 0.7 * uHeadGlow);                                  // 线头发亮
    float coreA = 1.0 - smoothstep(vCore - aa, vCore + aa, d);
    float edgeA = 1.0 - smoothstep(vCore + vEdge - aa, vCore + vEdge + aa, d);
    float haloK = 1.0 - smoothstep(vCore + vEdge, vCore + vEdge + vHalo, d);
    vec3 hc = mix(uHaloCol, uGlowCol, hd * uHeadGlow);
    float haloA = haloK * haloK * mix(uHaloA, 0.8, hd * hd * uHeadGlow);
    // 由外往里叠：淡影 → 描边 → 线芯（预乘再还原）
    vec3 C = hc * haloA; float A = haloA;
    C = mix(C, uEdgeCol, edgeA); A = mix(A, 1.0, edgeA);
    C = mix(C, cc, coreA); A = mix(A, 1.0, coreA);
    gl_FragColor = vec4(C / max(A, 1e-4), A * uOpacity);
  }`;

export class RouteRibbon {
  /**
   * pts：世界坐标 [[x, y, z], …]（越密越好；平铺地图时 y 是满高度，乘 uLift）；kinds：每点 0 陆路 / 1 水路
   * core：线芯粗细（1080p 下的像素）；world > 0 时改成世界单位（近粗远细，夹在 minPx–maxPx）；edge：描边占线芯的比例；halo：外圈占线芯的比例
   * depth：和地形比深度（立体场景）；ghost：被挡住部分的透明度（0 不画）
   */
  constructor(pts, { kinds = null, core = 9, world = 0, minPx = 3, maxPx = 40, edge = 0.22, halo = 0.9, haloA = 0.35, col = "#cf3a2b", colW = null, edgeCol = "#2a140c", haloCol = "#1e1008", glowCol = "#ffd9a0", ahead = 0.4, ghost = 0, depth = false, off = 0, order = 30, px = 1 } = {}) {
    const n = pts.length, pos = new Float32Array(n * 6), prv = new Float32Array(n * 6), nxt = new Float32Array(n * 6), side = new Float32Array(n * 2), sA = new Float32Array(n * 2), kd = new Float32Array(n * 2), idx = [];
    let s = 0; this.cum = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (i) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
      this.cum[i] = s;
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      for (let k = 0; k < 2; k++) { const j = i * 2 + k; pos.set(pts[i], j * 3); prv.set(a, j * 3); nxt.set(b, j * 3); side[j] = k ? 1 : -1; sA[j] = s; kd[j] = kinds ? kinds[i] : 0; }
      if (i < n - 1) { const j = i * 2; idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
    }
    this.length = s; this.pts = pts;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aPrev", new THREE.BufferAttribute(prv, 3)); g.setAttribute("aNext", new THREE.BufferAttribute(nxt, 3));
    g.setAttribute("aSide", new THREE.BufferAttribute(side, 1)); g.setAttribute("aS", new THREE.BufferAttribute(sA, 1)); g.setAttribute("aKind", new THREE.BufferAttribute(kd, 1)); g.setIndex(idx);
    const C = (c) => new THREE.Color(c);
    this.u = {
      uRes: { value: new THREE.Vector2(1920 * px, 1080 * px) }, uPx: { value: px }, uLift: { value: 1 }, uOff: { value: off }, uCore: { value: core }, uWorld: { value: world }, uMinPx: { value: minPx }, uMaxPx: { value: maxPx },
      uEdge: { value: edge }, uHalo: { value: halo }, uHaloA: { value: haloA }, uProg: { value: 0 }, uFrom: { value: 0 }, uHead: { value: 0 }, uHeadGlow: { value: 1 }, uAhead: { value: ahead }, uDash: { value: 10 }, uDashPx: { value: 16 }, uAheadEnd: { value: 1e9 }, uOpacity: { value: 1 }, uGhost: { value: 0 },
      uCol: { value: C(col) }, uColW: { value: C(colW ?? col) }, uEdgeCol: { value: C(edgeCol) }, uHaloCol: { value: C(haloCol) }, uGlowCol: { value: C(glowCol) },
    };
    this.mat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: depth, depthWrite: false, side: THREE.DoubleSide });   // 屏幕空间展开的带子是背面朝外的，两面都画
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.renderOrder = order; this.mesh.frustumCulled = false;
    this.ghost = null;
    if (ghost > 0 && depth) {
      // 被山挡住的部分：同一条线，只在“比地形深”的地方画
      const gu = { ...this.u, uGhost: { value: 1 }, uOpacity: { value: ghost } };
      this.ghostMat = new THREE.ShaderMaterial({ uniforms: gu, vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: true, depthWrite: false, depthFunc: THREE.GreaterDepth, side: THREE.DoubleSide });
      this.ghost = new THREE.Mesh(g, this.ghostMat); this.ghost.renderOrder = order - 1; this.ghost.frustumCulled = false; this.ghostBase = ghost;
    }
  }
  addTo(scene) { scene.add(this.mesh); if (this.ghost) scene.add(this.ghost); return this; }
  /** prog：走到全长的比例；head：线头发亮的长度（世界单位）；dash：虚线一段的长度（世界单位） */
  set(prog, { from = 0, opacity = 1, head = 0, dash, ahead, aheadTo = 1 } = {}) {
    const u = this.u; u.uProg.value = prog * this.length + 1e-3; u.uFrom.value = from * this.length; u.uOpacity.value = opacity; u.uHead.value = head; u.uAheadEnd.value = aheadTo * this.length + 1e-3;
    if (dash !== undefined) u.uDash.value = dash;
    if (ahead !== undefined) u.uAhead.value = ahead;
    this.mesh.visible = opacity > 0.003 && (prog > 0.0005 || u.uAhead.value > 0);
    if (this.ghost) { this.ghostMat.uniforms.uOpacity.value = this.ghostBase * opacity; this.ghost.visible = this.mesh.visible && prog > 0.0005; }
  }
  /** 按长度比例取点：{ x, y, z, dx, dz, i }（i 是所在的点序号） */
  at(prog) {
    const target = Math.max(0, Math.min(1, prog)) * this.length, P = this.pts, C = this.cum;
    let lo = 0, hi = P.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (C[m] < target) lo = m; else hi = m; }
    const f = (target - C[lo]) / (C[hi] - C[lo] || 1), a = P[lo], b = P[hi];
    return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, z: a[2] + (b[2] - a[2]) * f, dx: b[0] - a[0], dz: b[2] - a[2], i: lo };
  }
}

/** 一串地图像素点 → 加密（每 step 像素一个点），可选手抖（低频横向偏移） */
export function densify(pts, step = 3, wobble = 0, seed = 1) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, pts[i][2] ?? 0]);
  }
  out.push([...pts[pts.length - 1].slice(0, 2), pts[pts.length - 1][2] ?? 0]);
  if (wobble > 0) {
    let s = seed * 9.7; for (let i = 1; i < out.length - 1; i++) { const a = out[i - 1], b = out[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1; s += 0.05; const w = (Math.sin(s) + 0.4 * Math.sin(s * 2.7)) * wobble; out[i][0] += (-dy / d) * w; out[i][1] += (dx / d) * w; }
  }
  return out;
}
