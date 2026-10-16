// 立体山水（青绿设色）：给“特殊场景”用的三维小世界——山、路、江、树、雾、人马剪影、船。
// 画法照《千里江山图》一路：山脚赭石、山腰石绿、山顶石青；背光面有顺坡的皴笔；树是一株株画出来的（松、杂树、柏、竹）；
// 山的轮廓按深度勾墨线（后期一道）；谷里起雾（越低越浓），远山淡进绢色里。人、马、船夫是剪影，红色只留给荔枝。
import * as THREE from "three";
import { W, H, tex } from "./engine.js";
import { mk, rng, smooth, stroke, fillPath, lerp, clamp, INK, VERM } from "./art.js";

const Q = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
/** 超采样倍数：成片 2（更细），服务器检查 1 */
export const SS = Number(Q.get("ss") || 1);

// ───────── 共用的天光、雾
export function worldUniforms({ waterY = 40, sun = [-0.55, 0.6, 0.5] } = {}) {
  return {
    uSun: { value: new THREE.Vector3(...sun).normalize() }, uCam: { value: new THREE.Vector3() }, uTime: { value: 0 },
    uFogCol: { value: new THREE.Color("#e9dfc6") }, uHazeCol: { value: new THREE.Color("#ddd8c4") }, uFogA: { value: 0.0011 }, uFogB: { value: 1 / 140 }, uFogY0: { value: waterY }, uFogFar: { value: 12000 },
    uV: { value: 1 }, uBase: { value: waterY + 60 }, uSpan: { value: 900 }, uWaterY: { value: waterY }, uDay: { value: 1 },
    uSkyTop: { value: new THREE.Color(0.8, 0.8, 0.74) }, uSunGlow: { value: new THREE.Color(0.16, 0.11, 0.04) }, uLitCol: { value: new THREE.Color(1.07, 1.02, 0.94) }, uShadeCol: { value: new THREE.Color(0.6, 0.66, 0.77) },
    uBoat: { value: new THREE.Vector4(0, 0, 1, 0) }, uBoatOn: { value: 0 },
  };
}
const COMMON = `
  uniform vec3 uSun, uCam, uFogCol, uHazeCol, uSkyTop, uSunGlow, uLitCol, uShadeCol; uniform float uTime, uFogA, uFogB, uFogY0, uFogFar, uDay;
  float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y); }
  float fbm3(vec2 p){ return 0.5 * vnoise(p) + 0.25 * vnoise(p * 2.03 + 7.1) + 0.125 * vnoise(p * 4.01 + 3.3) + 0.0625 * vnoise(p * 8.05 + 1.7); }
  // 高度雾（越低越浓，一团一团的）+ 远处的霭
  vec3 fogMix(vec3 col, vec3 p){
    vec3 d = p - uCam; float dist = length(d);
    float k = uFogB * d.y; float g = abs(k) > 1e-3 ? (1.0 - exp(-k)) / k : 1.0;
    float mist = 0.3 + 1.2 * fbm3(p.xz * 0.0011 + vec2(uTime * 0.012, uTime * 0.005));
    float F = uFogA * mist * exp(-uFogB * (uCam.y - uFogY0)) * dist * g;
    float hz = smoothstep(uFogFar * 0.08, uFogFar, dist);
    col = mix(col, uHazeCol, hz * (2.0 - hz) * 0.92);
    return mix(col, uFogCol, 1.0 - exp(-max(F, 0.0)));
  }`;

// ───────── 地形（真实高程也能用）：颜色按“比周围高多少 + 海拔 + 坡度 + 山脊/山沟”上，平地画成一块块田；光照暖亮冷暗；坡上点苔
const TERRAIN_VS = `attribute float aRel, aCurv; varying vec3 vW, vN; varying float vRel, vCurv;
  void main(){ vRel = aRel; vCurv = aCurv; vN = normal; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const TERRAIN_FS = `${COMMON}
  uniform float uV, uBase, uSpan, uWaterY; varying vec3 vW, vN; varying float vRel, vCurv;
  vec3 ramp(float t){
    vec3 c0 = vec3(0.80, 0.75, 0.58), c1 = vec3(0.73, 0.61, 0.43), c2 = vec3(0.47, 0.60, 0.48), c3 = vec3(0.29, 0.48, 0.42), c4 = vec3(0.21, 0.37, 0.48);
    vec3 c = mix(c0, c1, smoothstep(0.0, 0.22, t)); c = mix(c, c2, smoothstep(0.2, 0.46, t)); c = mix(c, c3, smoothstep(0.46, 0.7, t)); return mix(c, c4, smoothstep(0.68, 0.95, t));
  }
  void main(){
    vec2 q = vW.xz; vec3 n = normalize(vN);
    float b0 = fbm3(q * 0.02), bx = fbm3((q + vec2(3.0, 0.0)) * 0.02), bz = fbm3((q + vec2(0.0, 3.0)) * 0.02);
    n = normalize(n + vec3(b0 - bx, 0.0, b0 - bz) * 1.4);
    float slope = clamp(1.0 - n.y, 0.0, 1.0), e = vW.y / uV, hN = smoothstep(uBase, uBase + uSpan, e);
    float big = fbm3(q * 0.0009), mid = fbm3(q * 0.006);
    float t = 0.16 + hN * 0.6 + vRel * 0.32 + vCurv * 0.16 + slope * 0.3 + (big - 0.5) * 0.25 + (mid - 0.5) * 0.12;
    vec3 col = ramp(clamp(t, 0.0, 1.0));
    // 平地：一块块田（淡黄绿、浅赭），田埂淡淡一道
    float flatLow = (1.0 - smoothstep(0.02, 0.09, slope)) * (1.0 - smoothstep(0.0, 0.16, hN));
    vec2 fc = q / vec2(74.0, 48.0) + vec2(fbm3(q * 0.004) * 3.0, fbm3(q * 0.003 + 4.0) * 2.0), fi = floor(fc), ff = fract(fc);
    float tn = hash12(fi); vec3 fcol = mix(vec3(0.81, 0.77, 0.56), vec3(0.69, 0.72, 0.50), tn); fcol = mix(fcol, vec3(0.78, 0.66, 0.47), step(0.82, tn));
    fcol *= 1.0 - smoothstep(0.43, 0.5, max(abs(ff.x - 0.5), abs(ff.y - 0.5))) * 0.16;
    col = mix(col, fcol, flatLow * 0.85);
    float dif = dot(n, uSun), lit = smoothstep(-0.35, 0.75, dif);
    col *= mix(uShadeCol, uLitCol, lit);
    col *= 1.0 + clamp(vCurv, -1.0, 1.0) * 0.1;
    vec2 cell = floor(q / 13.0), fr = fract(q / 13.0) - 0.5 - (vec2(hash12(cell), hash12(cell + 7.0)) - 0.5) * 0.5;
    float dt = (1.0 - smoothstep(0.1, 0.2, length(fr))) * step(0.6, hash12(cell + 3.0)) * smoothstep(0.06, 0.3, slope) * (1.0 - flatLow);
    col = mix(col, vec3(0.13, 0.2, 0.16), dt * 0.5);
    col *= 1.0 - (1.0 - smoothstep(0.0, 4.0, vW.y - uWaterY)) * 0.15;
    gl_FragColor = vec4(fogMix(col, vW), 1.0);
  }`;
export function terrainMaterial(U) { return new THREE.ShaderMaterial({ uniforms: U, vertexShader: TERRAIN_VS, fragmentShader: TERRAIN_FS }); }

/** 高度场 → 地形网格。hole：中间挖掉一块（远处的粗地形用）；skirt：四边往下垂一圈（和粗地形接缝处不露缝） */
export function terrainMesh(F, mat, { hole = null, sink = 90, skirt = 0, relR = 260, relK = 320, curK = 40 } = {}) {
  // hole：{ x0, x1, z0, z1 }（远处的粗地形挖掉中间精细的那块：完全在里面的格子不画，里面的点往下压 sink 米，接缝处不露缝也不打架）
  const inHole = (x, z) => hole && x > hole.x0 && x < hole.x1 && z > hole.z0 && z < hole.z1;
  const n = F.nx, nz = F.nz, B = F.blur(Math.max(2, Math.round(relR / F.d))), C = F.blur(1);
  const pos = [], nor = [], rel = [], cur = [], idx = [];
  const at = (a, i, j) => a[clamp(j, 0, nz - 1) * n + clamp(i, 0, n - 1)];
  for (let j = 0; j < nz; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, x = F.x0 + i * F.d, z = F.z0 + j * F.d, h = F.h;
    const dx = (h[j * n + Math.min(n - 1, i + 1)] - h[j * n + Math.max(0, i - 1)]) / (2 * F.d), dz = (h[Math.min(nz - 1, j + 1) * n + i] - h[Math.max(0, j - 1) * n + i]) / (2 * F.d), L = Math.hypot(dx, 1, dz);
    pos.push(x, h[k] - (inHole(x, z) ? sink : 0), z); nor.push(-dx / L, 1 / L, -dz / L); rel.push(clamp((h[k] - B[k]) / relK, -1, 1));
    cur.push(clamp((4 * C[k] - at(C, i - 2, j) - at(C, i + 2, j) - at(C, i, j - 2) - at(C, i, j + 2)) / curK, -1, 1));
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < n - 1; i++) {
    const xa = F.x0 + i * F.d, za = F.z0 + j * F.d;
    if (hole && inHole(xa, za) && inHole(xa + F.d, za) && inHole(xa, za + F.d) && inHole(xa + F.d, za + F.d)) continue;
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d);
  }
  if (skirt) {
    const ring = []; for (let i = 0; i < n; i++) ring.push(i); for (let j = 1; j < nz; j++) ring.push(j * n + n - 1); for (let i = n - 2; i >= 0; i--) ring.push((nz - 1) * n + i); for (let j = nz - 2; j > 0; j--) ring.push(j * n); ring.push(0);
    for (let r = 0; r < ring.length - 1; r++) {
      const a = ring[r], b = ring[r + 1], base = pos.length / 3;
      pos.push(pos[a * 3], pos[a * 3 + 1] - skirt, pos[a * 3 + 2], pos[b * 3], pos[b * 3 + 1] - skirt, pos[b * 3 + 2]);
      nor.push(nor[a * 3], nor[a * 3 + 1], nor[a * 3 + 2], nor[b * 3], nor[b * 3 + 1], nor[b * 3 + 2]); rel.push(rel[a], rel[b]); cur.push(cur[a], cur[b]);
      idx.push(a, base, b, b, base, base + 1, a, b, base, b, base + 1, base);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("aRel", new THREE.Float32BufferAttribute(rel, 1)); g.setAttribute("aCurv", new THREE.Float32BufferAttribute(cur, 1));
  g.setIndex(idx); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; return m;
}

// ───────── 水：淡青绿底、细细的网巾水纹（《千里江山图》的画法）、斜看时泛天光、太阳的碎金、船后的八字浪
const WATER_FS = `${COMMON}
  uniform float uWaterY, uBoatOn; uniform vec4 uBoat; varying vec3 vW;
  void main(){
    vec2 q = vW.xz; vec3 v = normalize(uCam - vW); float dist = length(uCam - vW);
    float fres = pow(1.0 - clamp(v.y, 0.0, 1.0), 4.0);
    vec3 deep = vec3(0.50, 0.62, 0.58), sky = vec3(0.86, 0.85, 0.78);
    vec3 col = mix(deep, sky, 0.25 + 0.6 * fres);
    col = mix(col, col * 0.9, fbm3(q * 0.004 + uTime * 0.01) * 0.5);
    // 网巾纹：细线，近处清楚，远了渐淡
    float wob = fbm3(q * 0.03 + vec2(uTime * 0.08, 0.0)) * 7.0;
    float ln = abs(sin((q.y * 0.55 + sin(q.x * 0.11 + wob) * 1.6 + wob) ));
    float lines = smoothstep(0.86, 0.985, ln) * (1.0 - smoothstep(60.0, 520.0, dist));
    col = mix(col, vec3(0.22, 0.36, 0.38), lines * 0.38);
    // 碎金
    float sp = vnoise(q * 0.25 + vec2(uTime * 0.6, uTime * 0.3)) * vnoise(q * 0.4 - uTime * 0.4);
    vec3 r = reflect(-v, vec3(0.0, 1.0, 0.0)); float sun = pow(max(dot(r, uSun), 0.0), 60.0);
    col += vec3(1.0, 0.9, 0.7) * sun * smoothstep(0.25, 0.6, sp) * 0.9 * uDay;
    // 船后的八字浪
    if (uBoatOn > 0.5) {
      vec2 rel = q - uBoat.xy, dir = uBoat.zw, side = vec2(-dir.y, dir.x);
      float along = -dot(rel, dir), lat = abs(dot(rel, side));
      float fade = (1.0 - smoothstep(0.0, 140.0, along)) * step(-4.0, along);
      float arm = 1.0 - smoothstep(0.4, 1.4 + along * 0.03, abs(lat - 1.2 - along * 0.34));
      float trail = (1.0 - smoothstep(0.6, 1.6 + along * 0.025, lat)) * (0.5 + 0.5 * vnoise(vec2(along * 0.4, lat) - uTime * 2.0));
      col = mix(col, vec3(0.95, 0.94, 0.88), clamp(arm * 0.7 + trail * 0.45, 0.0, 1.0) * fade);
    }
    gl_FragColor = vec4(fogMix(col, vW), 1.0);
  }`;
export function waterMesh(U, size, geom = null) {
  const g = geom ?? new THREE.PlaneGeometry(size, size, 1, 1); if (!geom) g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: U, vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`, fragmentShader: WATER_FS }));
  if (!geom) m.position.y = U.uWaterY.value; m.frustumCulled = false; return m;
}

// ───────── 河：沿着河道的一条水带（宽度、水面高度逐点给），水纹顺着水流方向，两岸软边
const RIVER_FS = `${COMMON}
  uniform float uBoatOn; uniform vec4 uBoat; varying vec3 vW; varying vec2 vUv; varying float vWid;
  void main(){
    vec2 q = vW.xz; vec3 v = normalize(uCam - vW); float dist = length(uCam - vW);
    float edge = abs(vUv.x), a = 1.0 - smoothstep(0.78, 1.0, edge);
    float fres = pow(1.0 - clamp(v.y, 0.0, 1.0), 4.0);
    vec3 col = mix(vec3(0.53, 0.64, 0.6), vec3(0.85, 0.85, 0.78), 0.2 + 0.6 * fres);
    col = mix(col, vec3(0.62, 0.6, 0.48), smoothstep(0.55, 1.0, edge) * 0.5);
    // 网巾水纹：细、密、顺水流，近处才看得见
    float across = vUv.x * vWid * 0.5, along = vUv.y;
    float wob = (fbm3(vec2(along * 0.012 - uTime * 0.12, across * 0.03)) - 0.5) * 2.2;
    float ln = abs(sin(across * 1.55 + sin(along * 0.07 + across * 0.04 - uTime * 0.6) * 0.7 + wob));
    float lines = smoothstep(0.955, 0.995, ln) * (1.0 - smoothstep(60.0, 650.0, dist));
    col = mix(col, vec3(0.3, 0.42, 0.43), lines * 0.22);
    float sp = vnoise(q * 0.3 + vec2(uTime * 0.7, uTime * 0.2)) * vnoise(q * 0.45 - uTime * 0.5);
    vec3 r = reflect(-v, vec3(0.0, 1.0, 0.0)); float sun = pow(max(dot(r, uSun), 0.0), 50.0);
    col += vec3(1.0, 0.9, 0.7) * sun * smoothstep(0.22, 0.55, sp) * 0.8 * uDay;
    if (uBoatOn > 0.5) {
      vec2 rel = q - uBoat.xy, dir = uBoat.zw, side = vec2(-dir.y, dir.x);
      float al = -dot(rel, dir), lat = abs(dot(rel, side)), fade = (1.0 - smoothstep(0.0, 70.0, al)) * step(-4.0, al);
      float arm = 1.0 - smoothstep(0.25, 0.8 + al * 0.02, abs(lat - 1.1 - al * 0.3));
      float trail = (1.0 - smoothstep(0.5, 1.3 + al * 0.02, lat)) * (0.5 + 0.5 * vnoise(vec2(al * 0.4, lat) - uTime * 2.0));
      col = mix(col, vec3(0.93, 0.92, 0.86), clamp(arm * 0.45 + trail * 0.35, 0.0, 1.0) * fade);
    }
    gl_FragColor = vec4(fogMix(col, vW), a);
  }`;
/** rv：{ pts: [[x, z], …], ys: 水面高, ws: 宽 } */
export function riverMesh(U, rv, { lift = 0.25 } = {}) {
  const { pts, ys, ws } = rv, n = pts.length, pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), wid = new Float32Array(n * 2), idx = []; let s = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dx, dz) || 1, nx = -dz / d, nz = dx / d, w = ws[i] / 2;
    if (i) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    for (let k = 0; k < 2; k++) { const sg = k ? 1 : -1, j = i * 2 + k; pos.set([pts[i][0] + nx * w * sg, ys[i] + lift, pts[i][1] + nz * w * sg], j * 3); uv.set([sg, s], j * 2); wid[j] = ws[i]; }
    if (i < n - 1) { const j = i * 2; idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setAttribute("aWid", new THREE.BufferAttribute(wid, 1)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    vertexShader: `attribute float aWid; varying vec3 vW; varying vec2 vUv; varying float vWid; void main(){ vUv = uv; vWid = aWid; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: RIVER_FS,
  }));
  m.renderOrder = 1; m.frustumCulled = false; return m;
}

// ───────── 天：上淡下暖，太阳那边亮一点；远处和霭连成一片
export function skyDome(U) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(24000, 48, 24), new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: true,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${COMMON} varying vec3 vD; void main(){
      float y = clamp(vD.y, 0.0, 1.0); vec3 top = uSkyTop, hor = uHazeCol;
      vec3 c = mix(hor, top, pow(y, 0.55));
      float s = max(dot(vD, uSun), 0.0); c += uSunGlow * pow(s, 8.0) + uSunGlow * 0.6 * pow(s, 64.0) + uSunGlow * 2.5 * smoothstep(0.9993, 0.9997, s);
      c = mix(c, c * 0.96, fbm3(vec2(atan(vD.z, vD.x) * 3.0, vD.y * 12.0) + uTime * 0.01) * (1.0 - y));
      gl_FragColor = vec4(c, 1.0); }`,
  }));
  m.frustumCulled = false; m.renderOrder = -10; return m;
}

// ───────── 路：一条贴着地形的石板路（两边虚化进土里）
export function roadMesh(U, pts, ys, { half = 3.4, lift = 0.4 } = {}) {
  const n = pts.length, pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), idx = []; let s = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dx, dz) || 1, nx = -dz / d, nz = dx / d;
    if (i) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    for (let k = 0; k < 2; k++) { const sg = k ? 1 : -1, j = i * 2 + k; pos.set([pts[i][0] + nx * half * sg, ys[i] + lift, pts[i][1] + nz * half * sg], j * 3); uv.set([sg, s], j * 2); }
    if (i < n - 1) { const j = i * 2; idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    vertexShader: `varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${COMMON} varying vec3 vW; varying vec2 vUv; void main(){
      float a = 1.0 - smoothstep(0.55, 1.0, abs(vUv.x));
      vec2 c = vec2(vUv.y / 0.9, vUv.x * 2.2); vec2 ci = floor(c), cf = fract(c) - 0.5;
      float stone = 0.86 + 0.14 * hash12(ci), joint = smoothstep(0.36, 0.5, max(abs(cf.x), abs(cf.y)));
      vec3 col = vec3(0.83, 0.76, 0.6) * stone; col = mix(col, vec3(0.45, 0.38, 0.28), joint * 0.45);
      col = mix(col, vec3(0.62, 0.52, 0.36), smoothstep(0.4, 0.95, abs(vUv.x)));
      float lit = smoothstep(-0.3, 0.7, uSun.y); col *= mix(0.8, 1.05, lit);
      gl_FragColor = vec4(fogMix(col, vW), a); }`,
  }));
  m.renderOrder = 2; m.frustumCulled = false; return m;
}

// ───────── 树：一株株画出来（松、杂树、柏、竹、灌木），贴在竖着的卡片上（只绕竖轴转向镜头）
const TC = 384, TR = 576;   // 每棵树一格的像素
function paintPine(g, R) {
  const bx = TC * (0.44 + R() * 0.12), top = TR * (0.06 + R() * 0.06);
  const trunk = smooth([[bx, TR], [bx + (R() - 0.5) * 50, TR * 0.72], [bx + (R() - 0.5) * 80, TR * 0.44], [bx + (R() - 0.5) * 50, top + 40]], 10);
  stroke(g, trunk, 24, 7, "#6b4d31"); stroke(g, trunk.map(([x, y]) => [x - 6, y]), 5, 1.4, "rgba(28,20,12,.9)");
  g.strokeStyle = "rgba(40,26,14,.6)"; g.lineWidth = 1.4; for (let i = 0; i < 26; i++) { const [x, y] = trunk[Math.floor(R() * trunk.length * 0.8)]; g.beginPath(); g.ellipse(x + (R() - 0.5) * 8, y, 4, 2.4, 0, 0, Math.PI * 2); g.stroke(); }
  const xAt = (y) => trunk[Math.min(trunk.length - 1, Math.round(((TR - y) / (TR - top)) * (trunk.length - 1)))][0];
  const tiers = 5 + Math.floor(R() * 3);
  for (let k = 0; k < tiers; k++) {
    const t = k / (tiers - 1), y = lerp(TR * 0.6, top + 24, t), tx = xAt(y);
    for (const sd of k === tiers - 1 ? [0] : [-1, 1]) {
      if (sd && R() < 0.18) continue;
      const len = TC * lerp(0.3, 0.1, t) * (0.7 + R() * 0.6), cx = tx + sd * len, cy = y - 6 + (R() - 0.5) * 16, rx = len * 0.55 + 26, ry = 20 + R() * 12;
      if (sd) stroke(g, smooth([[tx, y + 10], [tx + sd * len * 0.5, y + 4 + (R() - 0.5) * 10], [cx, cy + 6]], 4), 8, 3, "#4a3422");
      g.fillStyle = `rgba(${36 + R() * 14},${64 + R() * 16},${50 + R() * 10},.5)`; g.beginPath(); g.ellipse(cx, cy - ry * 0.2, rx * 0.95, ry * 0.75, 0, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 64; i++) {
        const a = Math.PI * (0.98 + R() * 1.04), r = rx * (0.55 + R() * 0.5), r0 = rx * (0.05 + R() * 0.15);
        g.strokeStyle = R() < 0.15 ? `rgba(${100 + R() * 40},${150 + R() * 30},${120 + R() * 20},.7)` : `rgba(${14 + R() * 14},${28 + R() * 16},${20 + R() * 10},.82)`; g.lineWidth = 1.2 + R() * 0.9;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.5); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * ry * (0.6 + R() * 0.55)); g.stroke();
      }
    }
  }
}
function paintBroad(g, R, { tone = 0 } = {}) {
  // 杂树：短而粗的干、分两三杈，树冠宽、扁、边缘不齐，用一簇簇点叶（个字点、胡椒点）堆出来，上亮下暗
  const bx = TC * (0.44 + R() * 0.12), lean = (R() - 0.5) * 50;
  const trunk = smooth([[bx, TR], [bx + lean * 0.35, TR * 0.86], [bx + lean * 0.75, TR * 0.66]], 6);
  stroke(g, trunk, 30, 15, "#584029"); stroke(g, trunk.map(([x, y]) => [x - 7, y]), 5, 2, "rgba(26,18,10,.85)");
  const [ex, ey] = trunk[trunk.length - 1];
  for (const a of [-0.75, 0.05, 0.8]) stroke(g, smooth([[ex, ey], [ex + Math.sin(a) * 60, ey - 50], [ex + Math.sin(a) * 125, ey - 85 - R() * 35]], 4), 12, 3, "#48331f");
  const cx0 = ex, cy0 = TR * 0.38, rx = 150 + R() * 25, ry = 112 + R() * 20, ph = R() * 6;
  const inside = (x, y) => { const dx = (x - cx0) / rx, dy = (y - cy0) / (y > cy0 ? ry * 0.7 : ry), a = Math.atan2(dy, dx); return dx * dx + dy * dy < 1 + 0.22 * Math.sin(a * 5 + ph) + 0.12 * Math.sin(a * 9 + ph * 2); };
  const base = tone ? [62, 96, 64] : [40, 70, 52];
  for (let k = 0; k < 14; k++) { const x = cx0 + (R() - 0.5) * rx * 1.6, y = cy0 + (R() - 0.62) * ry * 1.5; if (!inside(x, y)) continue; g.fillStyle = `rgba(${base[0] + 34},${base[1] + 44},${base[2] + 30},.28)`; g.beginPath(); g.arc(x, y, 46 + R() * 40, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 1400; i++) {
    const x = cx0 + (R() * 2 - 1) * rx * 1.15, y = cy0 + (R() * 2 - 1) * ry * 1.15; if (!inside(x, y)) continue;
    const up = (cy0 - y) / ry, light = up > 0.15 && R() < 0.35 + up * 0.4;
    g.fillStyle = light ? `rgba(${118 + R() * 40},${156 + R() * 30},${112 + R() * 20},.62)` : `rgba(${base[0] - 26 + R() * 16},${base[1] - 36 + R() * 18},${base[2] - 30 + R() * 12},${0.55 + 0.3 * (1 - up)})`;
    if (R() < 0.3) { g.save(); g.translate(x, y); g.rotate((R() - 0.5) * 0.6); g.strokeStyle = g.fillStyle; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(-6, 8); g.moveTo(0, 0); g.lineTo(0, 9); g.moveTo(0, 0); g.lineTo(6, 8); g.stroke(); g.restore(); }
    else { g.beginPath(); g.ellipse(x, y, 4 + R() * 4, 2.4 + R() * 1.8, (R() - 0.5) * 0.8, 0, Math.PI * 2); g.fill(); }
  }
}
function paintCypress(g, R) {
  const bx = TC * 0.5; stroke(g, [[bx, TR], [bx + 4, TR * 0.55]], 18, 9, "#5a4029");
  for (let k = 0; k < 13; k++) {
    const t = k / 12, y = lerp(TR * 0.8, TR * 0.07, t), w = lerp(70, 22, t) * (0.8 + R() * 0.4);
    g.fillStyle = `rgba(${30 + R() * 10},${54 + R() * 14},${46 + R() * 10},.55)`; g.beginPath(); g.ellipse(bx + (R() - 0.5) * 14, y, w, 34, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 26; i++) { const x = bx + (R() - 0.5) * w * 1.9, yy = y + (R() - 0.5) * 50; g.strokeStyle = `rgba(${12 + R() * 14},${24 + R() * 14},${18 + R() * 8},.8)`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + (x - bx) * 0.12, yy + 12); g.stroke(); }
  }
}
function paintBamboo(g, R) {
  for (let c = 0; c < 6; c++) {
    const x0 = TC * (0.3 + R() * 0.4), lean = (R() - 0.5) * 70, topY = TR * (0.08 + R() * 0.2);
    const pts = smooth([[x0, TR], [x0 + lean * 0.4, (TR + topY) / 2], [x0 + lean, topY]], 6);
    stroke(g, pts, 9, 5, c % 2 ? "#5f7348" : "#4c5f3a");
    for (let k = 1; k < 8; k++) { const [x, y] = pts[Math.round((k / 8) * (pts.length - 1))]; g.fillStyle = "rgba(20,26,14,.8)"; g.fillRect(x - 6, y, 12, 2.5); }
    for (let k = 0; k < 9; k++) {
      const [x, y] = pts[Math.round((0.35 + 0.65 * R()) * (pts.length - 1))];
      for (let l = 0; l < 4; l++) { const a = -Math.PI / 2 + (R() - 0.5) * 2.6, L = 26 + R() * 22; g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = `rgba(${26 + R() * 20},${48 + R() * 24},${30 + R() * 12},.88)`; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * 0.5, -5, L, 0); g.quadraticCurveTo(L * 0.5, 4, 0, 0); g.fill(); g.restore(); }
    }
  }
}
function paintShrub(g, R) {
  const cx = TC * 0.5, cy = TR * 0.8;
  for (let w = 0; w < 6; w++) { g.fillStyle = "rgba(90,130,96,.25)"; g.beginPath(); g.arc(cx + (R() - 0.5) * 200, cy + (R() - 0.5) * 40, 50 + R() * 30, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 260; i++) { const u = (R() + R() + R() - 1.5) / 1.5, x = cx + u * 170, y = cy + (R() - 0.65) * 120; g.fillStyle = `rgba(${16 + R() * 18},${28 + R() * 20},${18 + R() * 10},.72)`; g.beginPath(); g.ellipse(x, y, 5 + R() * 4, 2.5 + R() * 1.5, (R() - 0.5), 0, Math.PI * 2); g.fill(); }
  g.clearRect(0, TR - 4, TC, 4);
}
export const TREE_KINDS = ["pine", "pine2", "broad", "broad2", "broad3", "cypress", "bamboo", "shrub"];
export function treeAtlas() {
  const c = mk(TC * 4, TR * 2), g = c.getContext("2d");
  TREE_KINDS.forEach((k, i) => {
    g.save(); g.translate((i % 4) * TC, Math.floor(i / 4) * TR); g.beginPath(); g.rect(0, 0, TC, TR); g.clip();
    const R = rng(100 + i * 17);
    if (k.startsWith("pine")) paintPine(g, R); else if (k.startsWith("broad")) paintBroad(g, R, { tone: k === "broad2" ? 1 : 0 }); else if (k === "cypress") paintCypress(g, R); else if (k === "bamboo") paintBamboo(g, R); else paintShrub(g, R);
    g.restore();
  });
  return c;
}
/** 一片树：list = [[x, y, z, 高, 种类序号, 色调 0–1], …] */
export function forest(U, atlasTex, list) {
  const base = new THREE.PlaneGeometry(1, 1); base.translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
  const n = list.length, a = new Float32Array(n * 4), b = new Float32Array(n * 2);
  list.forEach(([x, y, z, h, k, tn], i) => { a.set([x, y, z, h], i * 4); b.set([k, tn], i * 2); });
  g.setAttribute("aInst", new THREE.InstancedBufferAttribute(a, 4)); g.setAttribute("aVar", new THREE.InstancedBufferAttribute(b, 2)); g.instanceCount = n;
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
    uniforms: { ...U, map: { value: atlasTex } },
    vertexShader: `attribute vec4 aInst; attribute vec2 aVar; varying vec2 vUv; varying vec3 vW; varying float vTone;
      void main(){
        vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
        float w = aInst.w * ${(TC / TR).toFixed(4)};
        vec3 p = aInst.xyz + right * position.x * w + vec3(0.0, position.y * aInst.w, 0.0);
        float col = mod(aVar.x, 4.0), row = floor(aVar.x / 4.0);
        vUv = vec2((col + uv.x) / 4.0, (uv.y + 1.0 - row) / 2.0);
        vW = p; vTone = aVar.y; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `${COMMON} uniform sampler2D map; varying vec2 vUv; varying vec3 vW; varying float vTone;
      void main(){ vec4 c = texture2D(map, vUv); if (c.a < 0.42) discard;
        vec3 col = c.rgb * mix(vec3(0.92, 0.95, 0.9), vec3(1.08, 1.06, 0.98), vTone);
        col *= mix(0.78, 1.04, smoothstep(-0.2, 0.6, uSun.y)) * mix(vec3(1.0), uLitCol, 0.6);
        gl_FragColor = vec4(fogMix(col, vW), 1.0); }`,
  }));
  m.frustumCulled = false; return m;
}

// ───────── 竖着的剪影卡片（人马、船夫）：一张横条帧图，卡片沿着前进方向摆
export class Card {
  constructor(U, sheetTex, frames, { w = 6, h = 6, foot = 0.08, cols = frames } = {}) {
    const g = new THREE.PlaneGeometry(w, h); g.translate(0, h * (0.5 - foot), 0);
    this.cols = cols; this.rows = Math.ceil(frames / cols);
    this.u = { ...U, map: { value: sheetTex }, uFrame: { value: new THREE.Vector4(0, 0, 1 / cols, 1 / this.rows) } };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: this.u, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `${COMMON} uniform sampler2D map; uniform vec4 uFrame; varying vec2 vUv; varying vec3 vW;
        void main(){ vec4 c = texture2D(map, vec2(uFrame.x + vUv.x * uFrame.z, uFrame.y + vUv.y * uFrame.w)); if (c.a < 0.45) discard; gl_FragColor = vec4(fogMix(c.rgb, vW), 1.0); }`,
    }));
    this.mesh.frustumCulled = false; this.frames = frames;
  }
  /** 放在 (x, y, z)，朝 (dx, dz) 方向，第 f 帧。给了 camera 就改成“只绕竖轴转向镜头”的剪影（永远看到侧面），按前进方向在屏幕上朝左还是朝右翻过来 */
  place(x, y, z, dx, dz, f, camera = null) {
    this.mesh.position.set(x, y, z); const k = Math.floor(f) % this.frames, c = k % this.cols, r = Math.floor(k / this.cols); this.u.uFrame.value.x = c / this.cols; this.u.uFrame.value.y = 1 - (r + 1) / this.rows;
    if (!camera) { this.mesh.rotation.set(0, -Math.atan2(dz, dx), 0); this.mesh.scale.x = 1; return; }
    const th = Math.atan2(camera.position.x - x, camera.position.z - z);
    this.mesh.rotation.set(0, th, 0); this.mesh.scale.x = dx * Math.cos(th) - dz * Math.sin(th) >= 0 ? 1 : -1;
  }
}
/** 帧图：n 帧，每帧 size×size；cols 列（默认排成一行；帧多时排成方阵，免得贴图太宽超出显卡上限） */
export function sheetTex(n, size, draw, { h = size, cols = n } = {}) { const rows = Math.ceil(n / cols), c = mk(size * cols, h * rows), g = c.getContext("2d"); for (let i = 0; i < n; i++) { g.save(); g.translate((i % cols) * size, Math.floor(i / cols) * h); g.beginPath(); g.rect(0, 0, size, h); g.clip(); draw(g, i / n, size); g.restore(); } return tex(c); }

// ───────── 一团团的尘土 / 烟：朝向镜头的软圆片，每帧在 CPU 上摆
export class Puffs {
  constructor(U, n, { color = "#d8c49a" } = {}) {
    const c = mk(128, 128), g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(0.5, "rgba(255,255,255,.4)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const base = new THREE.PlaneGeometry(1, 1), geo = new THREE.InstancedBufferGeometry(); geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv;
    this.a = new Float32Array(n * 4); this.b = new Float32Array(n);
    geo.setAttribute("aInst", new THREE.InstancedBufferAttribute(this.a, 4)); geo.setAttribute("aAlpha", new THREE.InstancedBufferAttribute(this.b, 1)); geo.instanceCount = n; this.geo = geo; this.n = n;
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { ...U, map: { value: tex(c) }, uColor: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false,
      vertexShader: `attribute vec4 aInst; attribute float aAlpha; varying vec2 vUv; varying vec3 vW; varying float vA;
        void main(){ vUv = uv; vA = aAlpha; vec3 r = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), u = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 p = aInst.xyz + (r * position.x + u * position.y) * aInst.w; vW = p; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `${COMMON} uniform sampler2D map; uniform vec3 uColor; varying vec2 vUv; varying vec3 vW; varying float vA;
        void main(){ float a = texture2D(map, vUv).a * vA; if (a < 0.01) discard; gl_FragColor = vec4(fogMix(uColor, vW), a); }`,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 20;
  }
  set(list /* [[x, y, z, size, alpha], …] */) { for (let i = 0; i < this.n; i++) { const p = list[i]; if (p) { this.a.set(p.slice(0, 4), i * 4); this.b[i] = p[4]; } else this.b[i] = 0; } this.geo.attributes.aInst.needsUpdate = true; this.geo.attributes.aAlpha.needsUpdate = true; }
}

// ───────── 简单物件的着色（船身、篷、竹筒）：受光暖、背光青灰、雾
export function paintMaterial(U, color, map = null) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uColor: { value: new THREE.Color(color) }, map: { value: map }, uHasMap: { value: map ? 1 : 0 } }, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vW, vN; varying vec2 vUv; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${COMMON} uniform vec3 uColor; uniform sampler2D map; uniform float uHasMap; varying vec3 vW, vN; varying vec2 vUv;
      void main(){ vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; float lit = smoothstep(-0.3, 0.75, dot(n, uSun));
        vec3 col = uColor; if (uHasMap > 0.5) col *= texture2D(map, vUv).rgb;
        col *= mix(uShadeCol * 0.85, uLitCol, lit); gl_FragColor = vec4(fogMix(col, vW), 1.0); }`,
  });
}

/** 小船（乌篷）：船身、甲板、竹篷、船头一捆红封的竹筒；长 L 米，船头朝 +x */
export function boatModel(U, { L = 11, B = 2.5, D = 1.0 } = {}) {
  const grp = new THREE.Group(), nu = 40, nv = 16, pos = [], idx = [], uv = [];
  const wAt = (u) => (B / 2) * Math.pow(Math.sin(Math.PI * (0.03 + 0.94 * u)), 0.6), dAt = (u) => D * (0.3 + 0.7 * Math.pow(Math.sin(Math.PI * u), 0.7)), sAt = (u) => D * (0.2 + 1.1 * Math.pow(Math.abs(2 * u - 1), 3));
  for (let i = 0; i <= nu; i++) { const u = i / nu; for (let j = 0; j <= nv; j++) { const f = (j / nv) * Math.PI; pos.push((u - 0.5) * L, sAt(u) - Math.sin(f) * dAt(u), -Math.cos(f) * wAt(u)); uv.push(u, j / nv); } }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const hg = new THREE.BufferGeometry(); hg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); hg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); hg.setIndex(idx); hg.computeVertexNormals();
  const plank = mk(256, 64), pg = plank.getContext("2d"); pg.fillStyle = "#6a4a30"; pg.fillRect(0, 0, 256, 64); for (let k = 0; k < 8; k++) { pg.fillStyle = k % 2 ? "rgba(40,26,14,.35)" : "rgba(140,100,60,.25)"; pg.fillRect(0, k * 8, 256, 7); pg.fillStyle = "rgba(20,12,6,.6)"; pg.fillRect(0, k * 8 + 7, 256, 1); }
  grp.add(new THREE.Mesh(hg, paintMaterial(U, "#ffffff", tex(plank))));
  // 甲板
  const deck = new THREE.Shape(); for (let i = 0; i <= 30; i++) { const u = 0.04 + (i / 30) * 0.92; deck[i ? "lineTo" : "moveTo"]((u - 0.5) * L, wAt(u) * 0.92); } for (let i = 30; i >= 0; i--) { const u = 0.04 + (i / 30) * 0.92; deck.lineTo((u - 0.5) * L, -wAt(u) * 0.92); }
  const dg = new THREE.ShapeGeometry(deck); dg.rotateX(Math.PI / 2); const dm = new THREE.Mesh(dg, paintMaterial(U, "#7a5a3a")); dm.position.y = D * 0.18; grp.add(dm);
  // 竹篷
  const mat = mk(256, 256), mg = mat.getContext("2d"); mg.fillStyle = "#3e3022"; mg.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 8) for (let x = 0; x < 256; x += 8) { mg.fillStyle = (x + y) % 16 ? "rgba(150,118,70,.45)" : "rgba(90,70,40,.5)"; mg.fillRect(x + 1, y + 1, 6, 6); }
  const rr = wAt(0.5) * 0.98, cg = new THREE.CylinderGeometry(rr, rr, L * 0.34, 20, 1, true, 0, Math.PI); cg.rotateZ(Math.PI / 2);
  const cm = new THREE.Mesh(cg, paintMaterial(U, "#ffffff", tex(mat))); cm.position.set(-L * 0.04, D * 0.25, 0); grp.add(cm);
  // 船头：一捆竹筒，红布封口
  const tubeG = new THREE.CylinderGeometry(0.16, 0.16, 1.3, 10); tubeG.rotateZ(Math.PI / 2);
  for (let k = 0; k < 4; k++) { const t = new THREE.Mesh(tubeG, paintMaterial(U, k % 2 ? "#a8a060" : "#93904f")); t.position.set(L * 0.25, D * 0.38 + (k > 1 ? 0.28 : 0), (k % 2 ? 0.17 : -0.17)); grp.add(t); }
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.75), paintMaterial(U, "#c43a2a")); cloth.position.set(L * 0.25, D * 0.5, 0); grp.add(cloth);
  grp.traverse((o) => { o.frustumCulled = false; });
  return grp;
}

// ───────── 后期：按深度勾山的轮廓墨线（线粗细带一点起伏，像毛笔），再叠一层绢纹
export class InkPost {
  constructor({ ink = 0.8, silk = 1, inkCol = "#2a221a", fadeFar = 9000 } = {}) {
    const w = Math.round(W * SS), h = Math.round(H * SS);
    this.rt = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, depthTexture: new THREE.DepthTexture(w, h) });
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture }, uRes: { value: new THREE.Vector2(w, h) }, uNear: { value: 1 }, uFar: { value: 1000 }, uInk: { value: ink }, uSilk: { value: silk }, uInkCol: { value: new THREE.Color(inkCol) }, uFadeFar: { value: fadeFar }, uSS: { value: SS }, uThr: { value: 0.05 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `#include <packing>
        uniform sampler2D tColor, tDepth; uniform vec2 uRes; uniform float uNear, uFar, uInk, uSilk, uFadeFar, uSS, uThr; uniform vec3 uInkCol; varying vec2 vUv;
        float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y); }
        float dist(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
        void main(){
          vec3 col = texture2D(tColor, vUv).rgb;
          vec2 px = 1.0 / uRes; float d0 = dist(vUv), e = 0.0;
          float r = uSS * (0.7 + 1.1 * vnoise(vUv * uRes / (26.0 * uSS)));
          for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398; float dn = dist(vUv + vec2(cos(a), sin(a)) * r * px); e = max(e, (dn - d0) / d0); }
          float edge = smoothstep(uThr, uThr * 2.2, e) * (1.0 - smoothstep(uFadeFar * 0.35, uFadeFar, d0));
          col = mix(col, uInkCol, edge * uInk);
          vec2 sp = vUv * vec2(${W}.0, ${H}.0);
          float weave = 0.5 + 0.5 * sin(sp.x * 1.5708) * sin(sp.y * 1.5708);
          col *= 1.0 - uSilk * (0.025 * weave + 0.035 * vnoise(sp * 0.35) + 0.02 * vnoise(sp * vec2(0.02, 0.6)));
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.scene = new THREE.Scene(); this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat)); this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  render(renderer, scene, camera, target) {
    renderer.setRenderTarget(this.rt); renderer.setClearColor(0xe9dfc6, 1); renderer.clear(); renderer.render(scene, camera);
    this.mat.uniforms.uNear.value = camera.near; this.mat.uniforms.uFar.value = camera.far;
    renderer.setRenderTarget(target); renderer.render(this.scene, this.cam);
  }
}
