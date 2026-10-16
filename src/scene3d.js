// 立体特殊场景（通用）：真实地形画成青绿山水 + 红线（走过实线、没走到虚线）+ 荔枝线头 + 骑手 / 船 + 古今地名 + 一个不切的航拍镜头。
// 每个场景只给两样东西：地面配置（places.js）和“看法”（look：天光、镜头关键帧、标签、额外的东西）。见 scenes3d.js。
import * as THREE from "three";
import { Stage, tex } from "./engine.js";
import { buildLand } from "./land.js";
import { rng, perlin, fbm, clamp, lerp, smoothstep } from "./landform.js";
import * as K from "./shanshui.js";
import { RouteRibbon } from "./route3d.js";
import { riderArt, boatmanArt, mk } from "./art.js";
import { Overlay } from "./labels.js";

const seg = (t, a, b) => clamp((t - a) / (b - a));
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// 单调三次插值（关键帧之间不过冲）
export function pchip(xs, ys) {
  const n = xs.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (xs[i + 1] - xs[i - 1])) / ((2 * xs[i + 1] - xs[i] - xs[i - 1]) / d[i - 1] + (xs[i + 1] + xs[i] - 2 * xs[i - 1]) / d[i]);
  m[0] = d[0] ?? 0; m[n - 1] = d[n - 2] ?? 0;
  return (x) => { if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1]; let i = 0; while (x > xs[i + 1]) i++; const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t; return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]; };
}

/**
 * dem / far：loadDEM 读进来的高程；cfg：places.js 里的一项（加 stride）；look：
 *   light：{ sun, fogCol, hazeCol, skyTop, sunGlow, litCol, shadeCol, base, span, fogY0（真实米）, fogA, fogB, fogFar }
 *   keys(R)：镜头关键帧 [[t, s, 后退, 高, 侧角°, u, v, 视角, 看守], …]（s 是线头在红线上的长度）；R 里有 sTop / sRoadEnd / sWater0 / len / sNear([经, 纬])
 *   labels(R)：[{ name, at: [经, 纬] 或 { s }, up, t0, t1, lead, side }]
 *   route：{ keep（只画最近多少米）, show（false 不画红线和线头）}；rider / boat：是否出现；trees：棵数
 *   extra(ctx)：返回 (t) => {} 每帧额外做的事（片尾的灯、红尘）
 */
export function buildScene3D(dem, far, cfg, look) {
  const st = new Stage(40); const { scene, camera } = st; camera.near = 3; camera.far = 70000;
  const L = buildLand(dem, far, cfg), { F, G, RV, road, roadH, RD, roadY, sTop, boat2, boatY, BD, rect, areaAt, V } = L, nx = F.nx;
  const lt = look.light || {};
  const U = K.worldUniforms({ waterY: L.waterY ?? 0, sun: lt.sun ?? [0.42, 0.52, 0.66] });
  U.uV.value = V; U.uBase.value = lt.base ?? 170; U.uSpan.value = lt.span ?? 650; U.uFogY0.value = (lt.fogY0 ?? lt.base ?? 170) * V; U.uFogB.value = lt.fogB ?? 1 / 190; U.uFogA.value = lt.fogA ?? 0.00075; U.uFogFar.value = lt.fogFar ?? 26000;
  const col = (k, v) => { if (lt[k]) U[v].value.set(lt[k]); };
  col("fogCol", "uFogCol"); col("hazeCol", "uHazeCol"); col("skyTop", "uSkyTop"); col("sunGlow", "uSunGlow"); col("litCol", "uLitCol"); col("shadeCol", "uShadeCol");
  const tm = K.terrainMaterial(U);
  scene.add(K.terrainMesh(F, tm, { skirt: 90, relR: 900, relK: 300, curK: 45 }), K.terrainMesh(G, tm, { hole: rect, sink: 140, relR: 2500, relK: 420, curK: 70 }));
  const sky = K.skyDome(U); scene.add(sky);
  RV.forEach((r) => scene.add(K.riverMesh(U, r)));
  // 大水面：平的（长江、鄱阳湖）或顺着航线倾斜的（赣江、汉水）
  if (L.waterY != null) scene.add(K.waterMesh(U, 140000));
  if (L.slope) {
    const step = 2, cols = Math.ceil(nx / step), rows = Math.ceil(F.nz / step), pos = new Float32Array(cols * rows * 3), ok = new Uint8Array(cols * rows), idx = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const x = F.x0 + i * step * F.d, z = F.z0 + j * step * F.d, l = L.slope.at(x, z), k = j * cols + i; pos.set([x, l ? l.y : -1e4, z], k * 3); ok[k] = l ? 1 : 0; }
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) { const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1; if (ok[a] && ok[b] && ok[c] && ok[d]) idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    scene.add(K.waterMesh(U, 0, g));
  }
  if (road) scene.add(K.roadMesh(U, road, roadH, { half: 3.2, lift: 0.35 }));
  // ── 树：只种在镜头会经过的一带
  const CG = 250, cw = Math.ceil((rect.x1 - rect.x0) / CG) + 1, ch = Math.ceil((rect.z1 - rect.z0) / CG) + 1, mask = new Uint8Array(cw * ch);
  const stamp = (pts, r) => { for (let i = 0; i < pts.length; i += 12) { const [x, z] = pts[i]; const n = Math.ceil(r / CG); for (let b = -n; b <= n; b++) for (let a = -n; a <= n; a++) { if (Math.hypot(a, b) * CG > r) continue; const p = Math.floor((x - rect.x0) / CG) + a, q = Math.floor((z - rect.z0) / CG) + b; if (p >= 0 && q >= 0 && p < cw && q < ch) mask[q * cw + p] = 1; } } };
  if (road) stamp(road, look.treeReach ?? 3000); if (boat2) stamp(boat2, look.treeReach ?? 2600);
  const Rn = rng(42), Nc = perlin(77), list = [], maxTrees = look.trees ?? 70000;
  for (let k = 0; k < maxTrees * 9 && list.length < maxTrees; k++) {
    const x = rect.x0 + Rn() * (rect.x1 - rect.x0), z = rect.z0 + Rn() * (rect.z1 - rect.z0);
    if (!mask[Math.floor((z - rect.z0) / CG) * cw + Math.floor((x - rect.x0) / CG)]) continue;
    if (areaAt(x, z) > 1.5) continue;
    const h = F.at(x, z); if (L.waterY != null && h < L.waterY + 1.5) continue; if (L.slope) { const l = L.slope.at(x, z); if (l && h < l.y + 1.5) continue; }
    const qr = RD ? RD.query(x, z, 28) : null; if (qr && qr.d < 7.5) continue;
    const sl = F.slope(x, z, 20);
    let p = (0.06 + 0.9 * smoothstep(0.05, 0.18, sl)) * (1 - smoothstep(0.95, 1.4, sl)) * (0.45 + 0.55 * smoothstep(-0.25, 0.15, fbm(Nc, x * 0.0012, z * 0.0012, 3)));
    if (qr && qr.d < 24) p = Math.max(p, 0.5);
    if (Rn() > p) continue;
    const e = h / V, hi = (lt.base ?? 170) + 430, mid = (lt.base ?? 170) + 150;
    const kind = e > hi ? (Rn() < 0.72 ? 0 : 1) : e > mid ? [0, 1, 2, 3, 0, 2, 4, 5][Math.floor(Rn() * 8)] : sl < 0.07 ? [6, 7, 4, 2, 3][Math.floor(Rn() * 5)] : [2, 3, 4, 0, 2, 3][Math.floor(Rn() * 6)];
    list.push([x, h - 0.6, z, kind === 7 ? 7 + Rn() * 5 : kind === 6 ? 12 + Rn() * 8 : kind >= 2 && kind <= 4 ? 13 + Rn() * 10 : 15 + Rn() * 14, kind, Rn()]);
  }
  if (list.length) scene.add(K.forest(U, tex(K.treeAtlas()), list));
  // ── 红线：山路在前、水路在后（有哪段画哪段）
  const rPts = road ? road.map(([x, z], i) => [x, roadH[i] + 0.9, z]) : [], wPts = boat2 ? boat2.map(([x, z], i) => [x, boatY[i] + 0.7, z]) : [];
  const route = new RouteRibbon([...rPts, ...wPts], { kinds: [...rPts.map(() => 0), ...wPts.map(() => 1)], world: 6, minPx: 5.5, maxPx: 9, edge: 0.2, halo: 0.8, haloA: 0.28, col: "#d93d2b", edgeCol: "#3e1209", haloCol: "#ffb080", glowCol: "#ffe6b8", ahead: 0.9, ghost: 0.55, depth: true, px: K.SS, order: 30 });
  const showRoute = look.route?.show !== false; if (showRoute) route.addTo(scene);
  const sRoadEnd = rPts.length ? route.cum[rPts.length - 1] : 0, sWater0 = wPts.length ? route.cum[rPts.length] : 0;
  // ── 骑手、影子、尘土
  const rider = road && look.rider !== false ? new K.Card(U, K.sheetTex(12, 512, (g, ph, s) => riderArt(g, s * 0.5, s * 0.92, s / 240, ph, { cargo: "tube" })), 12, { w: 8, h: 8, foot: 0.08 }) : null;
  const blob = mk(128, 64), bg = blob.getContext("2d"), gr = bg.createRadialGradient(64, 32, 2, 64, 32, 60); gr.addColorStop(0, "rgba(30,24,16,.5)"); gr.addColorStop(1, "rgba(30,24,16,0)"); bg.fillStyle = gr; bg.fillRect(0, 0, 128, 64);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 2.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex(blob), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 })); shadow.renderOrder = 5;
  const dust = new K.Puffs(U, 16, { color: look.dustCol ?? "#dccaa2" });
  if (rider) scene.add(rider.mesh, shadow, dust.mesh);
  // ── 船、船夫
  const boat = boat2 && look.boat !== false ? K.boatModel(U) : null, man = boat ? new K.Card(U, K.sheetTex(8, 256, (g, ph, s) => boatmanArt(g, s * 0.62, s * 0.7, s / 150, ph)), 8, { w: 4.4, h: 4.4, foot: 0.3 }) : null;
  if (boat) scene.add(boat, man.mesh);
  // ── 后期：勾墨线、绢纹
  const post = new K.InkPost({ ink: 0.72, fadeFar: 22000 });
  st.draw = (renderer, target) => post.render(renderer, scene, camera, target);

  const ground = (x, z) => { const inner = x > rect.x0 && x < rect.x1 && z > rect.z0 && z < rect.z1; let h = inner ? F.at(x, z) : G.at(x, z); if (L.waterY != null) h = Math.max(h, L.waterY); return h; };
  const roadAt = (s) => { const p = RD.at(s); return { x: p.x, z: p.z, y: roadY(s) }; };
  const dirAt = (s, r = 120) => { const a = RD.at(s - r), b = RD.at(s + r), dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1; return [dx / d, dz / d]; };
  const boatAt = (s) => { const p = BD.at(s), k = clamp(s / 8, 0, boatY.length - 1.001), i = Math.floor(k); return { x: p.x, z: p.z, y: lerp(boatY[i], boatY[i + 1], k - i) }; };
  const aim = (cam, P, u, v) => { camera.position.copy(cam); camera.up.set(0, 1, 0); camera.updateProjectionMatrix(); camera.lookAt(P); const ty = Math.tan((camera.fov * Math.PI) / 360); camera.rotateY(Math.atan(u * ty * camera.aspect)); camera.rotateX(Math.atan(-v * ty)); };
  // 红线上离某个经纬度最近的长度
  const sNear = ([lon, lat]) => { const [x, z] = L.proj(lon, lat); let bi = 0, bd = Infinity; route.pts.forEach((p, i) => { const d = (p[0] - x) ** 2 + (p[2] - z) ** 2; if (d < bd) { bd = d; bi = i; } }); return route.cum[bi]; };
  const R = { sTop, sRoadEnd, sWater0, len: route.length, sNear, L };
  // 平滑过的路线（定镜头朝向用）
  const SP = route.pts, SC = route.cum, nP = SP.length, sig = 45, smx = new Float32Array(nP), smz = new Float32Array(nP);
  { const ker = []; for (let k = -3 * sig; k <= 3 * sig; k++) ker.push(Math.exp(-(k * k) / (2 * sig * sig)));
    for (let i = 0; i < nP; i++) { let x = 0, z = 0, w = 0; for (let k = -3 * sig; k <= 3 * sig; k++) { const j = Math.min(nP - 1, Math.max(0, i + k)), ww = ker[k + 3 * sig]; x += SP[j][0] * ww; z += SP[j][2] * ww; w += ww; } smx[i] = x / w; smz[i] = z / w; } }
  const smAt = (s) => { let lo = 0, hi = nP - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (SC[m] < s) lo = m; else hi = m; } const f = clamp((s - SC[lo]) / (SC[hi] - SC[lo] || 1)); return [lerp(smx[lo], smx[hi], f), lerp(smz[lo], smz[hi], f)]; };
  const pathDir = (s) => { const a = smAt(s - 150), b = smAt(s + 150), dx = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dx, dz) || 1; return [dx / d, dz / d]; };
  const KEYS = look.keys(R), T = KEYS.map((k) => k[0]), colF = (i) => pchip(T, KEYS.map((k) => k[i] ?? 0));
  const S_ = colF(1), DIST = colF(2), HGT = colF(3), YAW = colF(4), UU = colF(5), VV = colF(6), FOV = colF(7), HOLD = colF(8);
  const DUR = T[T.length - 1];
  const groundMax = (x, z, r) => { let m = ground(x, z); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; m = Math.max(m, ground(x + Math.cos(a) * r, z + Math.sin(a) * r)); } return m; };
  const follow = (t) => {
    t = clamp(t, 0, DUR);
    const s = S_(t), h = route.at(s / route.length), [dx, dz] = pathDir(s), y = (YAW(t) * Math.PI) / 180, c = Math.cos(y), sn = Math.sin(y);
    const bx = -dx * c - dz * sn, bz = dx * sn - dz * c, cx = h.x + bx * DIST(t), cz = h.z + bz * DIST(t);
    return [cx, Math.max(h.y + HGT(t), groundMax(cx, cz, 170) + 45), cz];
  };
  const tHold = T[KEYS.findIndex((k) => (k[8] ?? 0) > 0)] ?? DUR, held = follow(tHold);
  const raw = (t) => { const f = follow(t), k = HOLD(clamp(t, 0, DUR)); if (k <= 0) return f; const dt = Math.max(0, t - tHold), [dx, dz] = pathDir(S_(tHold)); const o = [held[0] + dx * dt * 120, held[1] + dt * 35, held[2] + dz * dt * 120]; return [lerp(f[0], o[0], k), lerp(f[1], o[1], k), lerp(f[2], o[2], k)]; };
  const GW = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((k) => [k, Math.exp(-(k * k) / (2 * 2.6 * 2.6))]);
  const camAt = (t) => { let x = 0, y = 0, z = 0, w = 0; for (const [k, ww] of GW) { const p = raw(t + k * 0.07); x += p[0] * ww; y += p[1] * ww; z += p[2] * ww; w += ww; } return V3(x / w, y / w, z / w); };
  const occluded = (c, p) => { for (let i = 1; i < 48; i++) { const f = i / 48, x = lerp(c.x, p.x, f), z = lerp(c.z, p.z, f), y = lerp(c.y, p.y + 3, f); if (ground(x, z) > y + 2) return true; } return false; };
  const LABELS = (look.labels ? look.labels(R) : []).map((lb) => { let pos; if (Array.isArray(lb.at)) { const [x, z] = L.proj(...lb.at); pos = V3(x, ground(x, z) + (lb.up ?? 5), z); } else { const p = route.at(lb.at.s / route.length); pos = V3(p.x, p.y + (lb.up ?? 5), p.z); } return { ...lb, pos }; });
  const win = (t, a, b, f = 0.45) => Math.min(seg(t, a, a + f), 1 - seg(t, b - f, b));
  const placeRider = (t, s, speed) => {
    const p = roadAt(s), [dx, dz] = dirAt(s, 9);
    rider.mesh.visible = shadow.visible = true; rider.place(p.x, p.y + 0.05, p.z, dx, dz, t * 26, camera);
    shadow.position.set(p.x, p.y + 0.15, p.z); shadow.rotation.y = -Math.atan2(dz, dx);
    const P = [];
    for (let i = 0; i < 16; i++) { const tb = (Math.floor(t / 0.1) - i) * 0.1, age = t - tb; if (age < 0) continue; const q = roadAt(s - age * speed), w = (rng(Math.floor(tb * 10) + 99)() - 0.5) * 2; P.push([q.x - dz * w, q.y + 0.7 + age * 1.4, q.z + dx * w, 1.6 + age * 3, 0.36 * Math.pow(1 - age / 1.6, 2)]); }
    dust.set(P);
  };
  const ctx = { st, scene, camera, U, L, R, route, roadAt, boatAt, ground, S_, K, V3 };
  const extra = look.extra ? look.extra(ctx) : null;
  st.L = L; st.R = R; st.route = route; st.DUR = DUR; st.U = U;

  /** 一帧（本场景自己的时间 0–DUR） */
  st.shot = (t) => {
    U.uTime.value = t; U.uBoatOn.value = 0;
    if (rider) { rider.mesh.visible = shadow.visible = false; dust.set([]); }
    if (boat) boat.visible = man.mesh.visible = false;
    const s = S_(t), spd = Math.abs(S_(t + 0.05) - S_(t - 0.05)) / 0.1, h = route.at(s / route.length);
    const keep = look.route?.keep; route.set(clamp(s / route.length), { head: 90, dash: 14, from: keep ? clamp((s - keep) / route.length) : 0 });
    camera.fov = FOV(t); aim(camAt(t), V3(h.x, h.y + 2, h.z), UU(t), VV(t));
    const d0 = pathDir(S_(t - 0.3)), d1 = pathDir(S_(t + 0.3)), turn = Math.atan2(d0[0] * d1[1] - d0[1] * d1[0], d0[0] * d1[0] + d0[1] * d1[1]);
    camera.rotateZ(clamp(-turn * 0.3, -0.06, 0.06) * (1 - HOLD(t)));
    // 场景自己接管镜头（片尾远望骊山）：和跟拍之间平滑过渡
    const ovr = st.camOverride ? st.camOverride(t) : null;
    if (ovr) { const qa = camera.quaternion.clone(), pa = camera.position.clone(); camera.position.copy(ovr.pos); camera.lookAt(ovr.target); const qb = camera.quaternion.clone(); const b = ovr.blend ?? 1; camera.position.copy(pa.lerp(ovr.pos, b)); camera.quaternion.slerpQuaternions(qa, qb, b); }
    camera.updateMatrixWorld(); U.uCam.value.copy(camera.position); sky.position.copy(camera.position);
    if (rider && s <= sRoadEnd + 1 && t >= (look.riderFrom ?? 0)) placeRider(t, s, clamp(spd, 8, 40));
    if (boat && boat2 && s >= sWater0 - 1) {
      const sb = s - sWater0, b = boatAt(sb), q = boatAt(sb + 30), dx = q.x - b.x, dz = q.z - b.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, bob = Math.sin(t * 2.1) * 0.08;
      boat.visible = man.mesh.visible = true;
      boat.position.set(b.x, b.y + 0.35 + bob, b.z); boat.rotation.set(Math.sin(t * 1.7) * 0.015, -Math.atan2(uz, ux), Math.sin(t * 1.3) * 0.02);
      man.place(b.x - ux * 4.4, b.y + 0.7 + bob, b.z - uz * 4.4, ux, uz, t * 7, camera);
      U.uBoat.value.set(b.x, b.z, ux, uz); U.uBoatOn.value = 1;
    }
    if (extra) extra(t);
    st.look = { blur: 0.001, focus: 0.55, band: 0.32 };
    const ov = st.overlay; if (!ov) return;
    ov.clear();
    for (const lb of LABELS) { const a = win(t, lb.t0, lb.t1); if (a <= 0) continue; const p = Overlay.screen(lb.pos, camera); if (p) ov.label(lb.name, p[0], p[1], { a, lead: lb.lead ?? 90, rise: (1 - a) * 12, side: lb.side ?? 1, modern: lb.modern }); }
    if (!showRoute || look.route?.head === false) return;
    const hp = V3(h.x, h.y, h.z), q = Overlay.screen(hp, camera);
    if (q) {
      let stem = 30; if (rider && rider.mesh.visible) { const q2 = Overlay.screen(V3(h.x, h.y + 8.5, h.z), camera); if (q2) stem = Math.max(30, q[1] - q2[1] + 14); }
      if (boat && boat.visible) { const q2 = Overlay.screen(V3(h.x, h.y + 6, h.z), camera); if (q2) stem = Math.max(30, q[1] - q2[1] + 14); }
      const dir = camera.position.clone().sub(hp).normalize(); ov.head(q[0], q[1], t, { flat: clamp(Math.abs(dir.y) * 1.2, 0.25, 1), dim: occluded(camera.position, hp), size: 66, stem });
    }
  };
  return st;
}
