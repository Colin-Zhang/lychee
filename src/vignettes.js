// 插画布景（全部原创画面）：每个布景是几层平面（远近视差）+ 会动的小东西，镜头轻推轻移。update(t) 用的是全片时间。
import * as THREE from "three";
import { Stage, tex, revealMaterial, basic, W, H } from "./engine.js";
import { mk, silk, seal, brushText, lychee, riderArt, figureArt, treeArt, stumpArt, saplingArt, stroke, smooth, rng, VERM, INK } from "./art.js";
import { SW, SH, RES, skyLayer, farLayer, midLayer, groundLayer, cityPlan, documentArt, jarDiagram, gateScene, peeledScene, scaleScene, orchardBack } from "./scenes2d.js";

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const lerp = (a, b, k) => a + (b - a) * k;
// 插画画布按 RES 倍的分辨率画（逻辑坐标仍是 2560×1440），省内存
const canvasOf = (draw, w = SW, h = SH, res = w === SW && h === SH ? RES : 1) => { const c = mk(Math.round(w * res), Math.round(h * res)), g = c.getContext("2d"); g.scale(res, res); draw(g, c); return c; };
const T = (c) => tex(c, { mip: false, free: true });
const plane = (map, w, h, opacity = 1) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic(map, opacity));
/** 骑手帧：一张 12 帧的横条 */
function riderSheet(opt) { const n = 12, s = 384, c = mk(s * n, s), g = c.getContext("2d"); for (let i = 0; i < n; i++) riderArt(g, i * s + s * 0.5, s * 0.92, s / 240, i / n, opt); const t = tex(c); t.repeat.set(1 / n, 1); return { t, n }; }
/** 红尘：一团粒子，每颗有出生时刻、位置、漂移（只由时间决定） */
class RedDust {
  constructor(n, { color = [176, 82, 52], size = 70 } = {}) {
    this.n = n; const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute("aA", new THREE.BufferAttribute(new Float32Array(n), 1)); g.setAttribute("aS", new THREE.BufferAttribute(new Float32Array(n), 1));
    const dot = mk(64, 64), dg = dot.getContext("2d"), gr = dg.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); dg.fillStyle = gr; dg.fillRect(0, 0, 64, 64);
    this.mat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex(dot) }, uCol: { value: new THREE.Color(`rgb(${color.join(",")})`) }, uSize: { value: size } },
      vertexShader: `attribute float aA, aS; varying float vA; uniform float uSize; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * aS * (1500.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 uCol; varying float vA; void main(){ float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(uCol, a * vA); }`, transparent: true, depthWrite: false });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.R = Array.from({ length: n * 4 }, (_, i) => (Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1).map((v) => Math.abs(v));
  }
  /** src(tb) 返回出生时刻 tb 时的发射点（世界坐标）和大小比例 */
  update(t, t0, t1, src, life = 2.6, amount = 1) {
    const pos = this.points.geometry.attributes.position.array, A = this.points.geometry.attributes.aA.array, Sz = this.points.geometry.attributes.aS.array, R = this.R;
    for (let i = 0; i < this.n; i++) {
      const tb = t0 + (t1 - t0) * (i / this.n), age = t - tb;
      if (age < 0 || age > life) { A[i] = 0; continue; }
      const k = age / life, s = src(tb);
      pos[i * 3] = s.p.x + (R[i * 4] - 0.5) * 160 * s.k * (0.3 + k) - s.k * 40 * k; pos[i * 3 + 1] = s.p.y + (R[i * 4 + 1] * 90 * k + 10) * s.k; pos[i * 3 + 2] = s.p.z + 5 + R[i * 4 + 2] * 20;
      A[i] = amount * 0.55 * Math.sin(Math.min(1, k * 4) * Math.PI * 0.5) * (1 - k); Sz[i] = s.k * (0.5 + k * 1.6) * (0.6 + R[i * 4 + 3] * 0.8);
    }
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.aA.needsUpdate = true; this.points.geometry.attributes.aS.needsUpdate = true;
  }
}

// ───────── 开场 / 结尾：山水、黄土路、一骑红尘、滚出来的荔枝 ─────────
export function buildRoad() {
  const st = new Stage(30), M = 1.14;
  const skyDay = T(canvasOf((g) => skyLayer(g, { dusk: 0 }))), skyDusk = T(canvasOf((g) => skyLayer(g, { dusk: 1 })));
  const skyMat = new THREE.ShaderMaterial({ uniforms: { tA: { value: skyDay }, tB: { value: skyDusk }, uMix: { value: 0 } }, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform sampler2D tA, tB; uniform float uMix; varying vec2 vUv; void main(){ gl_FragColor = vec4(mix(texture2D(tA, vUv).rgb, texture2D(tB, vUv).rgb, uMix), 1.0); }` });
  st.layer(skyMat, -1400, M + 0.1);
  st.layer(basic(T(canvasOf((g) => farLayer(g)))), -900, M + 0.06);
  st.layer(basic(T(canvasOf((g) => midLayer(g)))), -420, M + 0.03);
  let center; const groundC = canvasOf((g) => { center = groundLayer(g); });
  st.layer(basic(T(groundC)), 0, M);
  const sheet = riderSheet({});
  const riderMat = new THREE.MeshBasicMaterial({ map: sheet.t, transparent: true, depthWrite: false });
  const rider = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), riderMat); rider.geometry.translate(0, 0.42, 0); st.scene.add(rider);
  const lycheeTex = T(lychee(640, { ripe: 1, seed: 11 }));
  const ly = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic(lycheeTex)); st.scene.add(ly);
  const dust = new RedDust(520); st.scene.add(dust.points);
  const hz = SH * 0.66;
  // 路的中线：r=0 天边 → r=1 脚下
  const roadAt = (r) => { const f = clamp(r) * (center.length - 1), i = Math.min(center.length - 2, Math.floor(f)), k = f - i; const x = lerp(center[i][0], center[i + 1][0], k), y = lerp(center[i][1], center[i + 1][1], k); return { x, y, depth: clamp((y - hz) / (SH - hz)) }; };
  const toW = (x, y, z = 2) => st.px(x, y, z, M);
  const pxs = st.pxScale(0, M);
  const riderAt = (t, a, b) => roadAt(lerp(0.66, 0.02, easeOut(seg(t, a, b))));
  st.update = (t) => {
    const ending = t > 100;
    skyMat.uniforms.uMix.value = ending ? 0.55 : 0;
    const a = ending ? 130.9 : 0.2, b = ending ? 136.2 : 6.2;
    const rp = riderAt(t, a, b), rk = lerp(28, 330, Math.pow(rp.depth, 1.15));
    rider.visible = t < b + 0.1;
    rider.scale.set(rk * pxs, rk * pxs, 1); rider.position.copy(toW(rp.x, rp.y, 3));
    sheet.t.offset.x = (Math.floor(t * 15) % sheet.n) / sheet.n;
    rider.material.opacity = 1 - seg(rp.depth, 0.03, 0.0) * 0;
    dust.update(t, a, b + 0.2, (tb) => { const q = riderAt(tb, a, b); const k = lerp(0.12, 1.4, Math.pow(q.depth, 1.1)); return { p: toW(q.x - 60 * k, q.y - 6 * k, 4), k: k * pxs * 3.2 }; }, 3.0, ending ? 1 : 1 - seg(t, 7.5, 9.5));
    // 荔枝：骑手跑远时从尘里滚出来，停在脚下
    ly.visible = !ending && t > 2.6;
    if (ly.visible) {
      const u = easeOut(seg(t, 2.6, 7.2)), r0 = roadAt(0.36), x = lerp(r0.x + 20, SW * 0.47, u), y = lerp(r0.y, SH * 0.86, u), d = clamp((y - hz) / (SH - hz)), size = lerp(26, 210, Math.pow(d, 1.2));
      ly.scale.set(size * pxs * 1.9, size * pxs * 1.9, 1); ly.position.copy(toW(x, y - size * 0.55, 6)); ly.rotation.z = -u * 9.5 + Math.sin(t * 3) * 0.02 * (1 - u);
    }
    // 镜头：开场慢慢推近；第 3 句推到荔枝跟前
    const lyW = toW(SW * 0.47, SH * 0.86 - 210 * 0.55, 6);
    if (!ending) {
      const k = ease(seg(t, 8.3, 12.4));
      st.camera.position.set(lerp(Math.sin(t * 0.2) * 20, lyW.x, k), lerp(0, lyW.y + 10, k), lerp(st.D, 640, k));
      st.camera.lookAt(lerp(0, lyW.x, k), lerp(0, lyW.y, k), 0);
      st.look = { blur: 0.002 + 0.006 * k, focus: lerp(0.62, 0.5, k), band: lerp(0.22, 0.12, k) };
    } else { st.camera.position.set(0, 0, lerp(st.D, st.D * 0.9, seg(t, 130.6, 136))); st.camera.lookAt(0, 0, 0); st.look = { blur: 0.002, focus: 0.62, band: 0.22 }; }
  };
  return st;
}

// ───────── 长安城坊图（墨洇出来）＋“天宝十四载”印 ─────────
export function buildCity() {
  const st = new Stage(30);
  const cityT = T(canvasOf((g) => cityPlan(g)));
  const mat = revealMaterial(cityT); st.layer(mat, 0, 1.12);
  const stamp = canvasOf((g) => { g.fillStyle = "rgba(178,40,32,.9)"; g.fillRect(10, 10, 180, 620); g.strokeStyle = "#efe1bd"; g.lineWidth = 4; g.strokeRect(24, 24, 152, 592); brushText(g, "天宝十四载", 100, 90, 104, { vertical: true, color: "#f3e6c8" }); }, 200, 640);
  const sp = plane(tex(stamp), 1, 1); st.scene.add(sp);
  st.update = (t) => {
    mat.uniforms.uReveal.value = easeOut(seg(t, 12.2, 14.6));
    const k = seg(t, 13.3, 13.6), p = st.px(2260, 560, 10);
    sp.visible = t > 13.3; const s = st.pxScale(10) * lerp(1.5, 1, easeOut(k)); sp.scale.set(200 * s, 640 * s, 1); sp.position.copy(p); sp.material.opacity = k;
    const u = seg(t, 12.0, 16.0); st.camera.position.set(lerp(-40, 40, u), lerp(20, -10, u), lerp(st.D, st.D * 0.92, u)); st.camera.lookAt(0, 0, 0); st.camera.rotation.z += lerp(-0.02, 0.01, u);
    st.look = { blur: 0.0025, focus: 0.5, band: 0.3 };
  };
  return st;
}

// ───────── 公文：手卷展开、李善德的剪影、朱笔圈出程限 ─────────
export function buildDoc() {
  const st = new Stage(30);
  let doc; const deskC = canvasOf((g) => { doc = documentArt(g); });
  st.layer(basic(T(deskC)), -60, 1.14);
  const paperT = tex(doc.paper);
  const pw = doc.pw, ph = doc.ph, s = st.pxScale(0, 1.12);
  const paperMat = new THREE.ShaderMaterial({ uniforms: { map: { value: paperT }, uOpen: { value: 0 } }, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform sampler2D map; uniform float uOpen; varying vec2 vUv; void main(){ if (vUv.x < 1.0 - uOpen) discard; vec4 c = texture2D(map, vUv); float sh = smoothstep(0.0, 0.03, vUv.x - (1.0 - uOpen)); c.rgb *= 0.75 + 0.25 * sh; gl_FragColor = c; }`, transparent: true });
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(pw * s, ph * s), paperMat); paper.position.copy(st.px(doc.px + pw / 2, doc.py + ph / 2, 0)); st.scene.add(paper);
  const rodC = canvasOf((g) => { const gr = g.createLinearGradient(0, 0, 60, 0); gr.addColorStop(0, "#3a2416"); gr.addColorStop(0.5, "#7a5234"); gr.addColorStop(1, "#2a180e"); g.fillStyle = gr; g.fillRect(10, 30, 40, 1000); g.fillStyle = "#6f9a86"; g.fillRect(4, 0, 52, 40); g.fillRect(4, 1020, 52, 40); }, 60, 1060);
  const rodT = tex(rodC), rodL = plane(rodT, 60 * s, 1060 * s * 0.98), rodR = plane(rodT, 60 * s, 1060 * s * 0.98); st.scene.add(rodL, rodR);
  rodR.position.copy(st.px(doc.px + pw + 10, doc.py + ph / 2, 2));
  const figC = canvasOf((g) => figureArt(g, 300, 590, 5.0, "bow", 0, { color: "#1b130c" }), 600, 620);
  const fig = plane(tex(figC), 600 * s * 0.85, 620 * s * 0.85); st.scene.add(fig);
  // 朱圈（每帧重画）
  const ringC = mk(pw, ph), rg = ringC.getContext("2d"), ringT = tex(ringC, { mip: false });
  const rings = new THREE.Mesh(new THREE.PlaneGeometry(pw * s, ph * s), basic(ringT)); rings.position.copy(st.px(doc.px + pw / 2, doc.py + ph / 2, 1)); st.scene.add(rings);
  const colOf = (txt) => doc.cols.find((c) => c.txt === txt);
  let lastK = -1;
  const drawRings = (k1, k2) => {
    const key = Math.round(k1 * 60) * 100 + Math.round(k2 * 60); if (key === lastK) return; lastK = key;
    rg.clearRect(0, 0, pw, ph);
    const ring = (c, k, seed) => { if (k <= 0) return; const n = [...c.txt].length, cx = c.x, cy = c.y + ((n - 1) * c.size * 1.08) / 2, rx = c.size * 0.8, ry = (n * c.size * 1.08) / 2 + c.size * 0.4; const R = rng(seed); rg.strokeStyle = "rgba(184,40,30,.85)"; rg.lineCap = "round"; rg.lineWidth = 9; rg.beginPath(); const end = k * Math.PI * 2.15; for (let a = 0; a <= end; a += 0.04) { const rr = 1 + (R() - 0.5) * 0.02; const x = cx + Math.cos(a - 1.7) * rx * rr, y = cy + Math.sin(a - 1.7) * ry * rr; a ? rg.lineTo(x, y) : rg.moveTo(x, y); } rg.stroke(); };
    ring(colOf("程限六月初一"), k1, 3); ring(colOf("岭南鲜荔枝"), k2, 5);
    ringT.needsUpdate = true;
  };
  st.update = (t) => {
    const open = easeOut(seg(t, 15.7, 17.1)); paperMat.uniforms.uOpen.value = open;
    rodL.position.copy(st.px(doc.px + pw * (1 - open) - 10, doc.py + ph / 2, 2));
    const fk = easeOut(seg(t, 17.1, 17.8)); fig.visible = fk > 0; fig.position.copy(st.px(330, 1240 + (1 - fk) * 60, 8)); fig.material.opacity = fk;
    drawRings(ease(seg(t, 19.8, 20.6)), ease(seg(t, 20.8, 21.6)));
    const u = seg(t, 15.4, 23.2), push = ease(seg(t, 19.4, 22.8));
    st.camera.position.set(lerp(0, 60, u) + push * 120, lerp(0, -10, u) + push * 60, lerp(st.D, st.D * 0.92, u) - push * 380); st.camera.lookAt(push * 160, push * 70, 0);
    st.look = { blur: 0.002 + push * 0.003, focus: 0.45, band: 0.25 };
  };
  return st;
}

// ───────── 荔枝离枝：一日色变、二日香变、三日味变 ─────────
export function buildDecay() {
  const st = new Stage(30);
  const bg = canvasOf((g) => { silk(g, SW, SH, { tone: [228, 210, 168], seed: 71, vign: 0.42 }); const gr = g.createRadialGradient(SW * 0.5, SH * 0.5, 50, SW * 0.5, SH * 0.5, SW * 0.5); gr.addColorStop(0, "rgba(255,246,222,.35)"); gr.addColorStop(1, "rgba(255,246,222,0)"); g.fillStyle = gr; g.fillRect(0, 0, SW, SH); stroke(g, smooth([[SW * 0.2, 60], [SW * 0.4, 110], [SW * 0.5, 150], [SW * 0.62, 132], [SW * 0.85, 60]], 8), 30, 14, "#4a3420"); for (let i = 0; i < 9; i++) { const x = SW * (0.25 + i * 0.07); g.save(); g.translate(x, 110 + Math.sin(i) * 20); g.rotate(-0.6 + (i % 3) * 0.5); g.fillStyle = "#4f6e38"; g.beginPath(); g.ellipse(0, 50, 22, 70, 0, 0, Math.PI * 2); g.fill(); g.restore(); } });
  st.layer(basic(T(bg)), -80, 1.14);
  const states = [0, 1, 2, 3].map((a) => T(lychee(768, { ripe: 1, age: a, seed: 21 })));
  const lyMat = new THREE.ShaderMaterial({ uniforms: { t0: { value: states[0] }, t1: { value: states[1] }, t2: { value: states[2] }, t3: { value: states[3] }, uAge: { value: 0 } }, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D t0, t1, t2, t3; uniform float uAge; varying vec2 vUv; void main(){ vec4 a = texture2D(t0, vUv), b = texture2D(t1, vUv), c = texture2D(t2, vUv), d = texture2D(t3, vUv); vec4 o = uAge < 1.0 ? mix(a, b, uAge) : uAge < 2.0 ? mix(b, c, uAge - 1.0) : mix(c, d, uAge - 2.0); gl_FragColor = o; }`, transparent: true, depthWrite: false });
  const s = st.pxScale(0, 1.12), lySize = 1100 * s;
  const ly = new THREE.Mesh(new THREE.PlaneGeometry(lySize, lySize), lyMat); st.scene.add(ly);
  const slash = plane(tex(canvasOf((g) => { stroke(g, smooth([[40, 200], [300, 120], [560, 40]], 8), 4, 26, "rgba(255,250,236,1)"); }, 600, 240)), 600 * s, 240 * s, 0); st.scene.add(slash);
  const wisp = plane(tex(canvasOf((g) => { g.strokeStyle = "rgba(255,248,230,.9)"; g.lineWidth = 7; g.lineCap = "round"; for (let k = 0; k < 3; k++) { g.beginPath(); for (let i = 0; i <= 40; i++) { const y = 560 - i * 13, x = 200 + k * 110 + Math.sin(i * 0.35 + k) * 34; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } }, 600, 600)), 600 * s, 600 * s, 0); st.scene.add(wisp);
  const words = [["色变", 24.3], ["香变", 26.7], ["味变", 28.1]].map(([w, t0], i) => { const m = plane(tex(canvasOf((g) => brushText(g, w, 120, 260, 180, { vertical: true, color: i === 0 ? VERM : INK }), 240, 560)), 240 * s, 560 * s, 0); m.position.copy(st.px(i === 1 ? 1880 : i === 0 ? 700 : 1960, 700 + (i === 2 ? 180 : 0), 10)); m.userData.t0 = t0; st.scene.add(m); return m; });
  const days = ["第一日", "第二日", "第三日"].map((d, i) => { const c = canvasOf((g) => { g.fillStyle = "rgba(178,40,32,.9)"; g.fillRect(8, 8, 164, 484); brushText(g, d, 90, 92, 120, { vertical: true, color: "#f3e6c8" }); }, 180, 500); const m = plane(tex(c), 180 * s * 0.8, 500 * s * 0.8, 0); m.position.copy(st.px(2300, 420, 12)); m.userData.t0 = [24.1, 26.5, 27.9][i]; st.scene.add(m); return m; });
  st.update = (t) => {
    const drop = easeOut(seg(t, 23.35, 23.95)), bounce = Math.sin(seg(t, 23.95, 24.4) * Math.PI) * 0.03;
    ly.position.copy(st.px(SW * 0.5, lerp(560, 760, drop) - bounce * 400, 4)); ly.rotation.z = drop * 0.14;
    const age = clamp(seg(t, 24.0, 24.8) + seg(t, 26.5, 27.3) + seg(t, 27.9, 28.7), 0, 3); lyMat.uniforms.uAge.value = age;
    ly.scale.setScalar(1 - seg(t, 27.9, 28.7) * 0.05);
    slash.position.copy(st.px(SW * 0.5, 300, 8)); slash.material.opacity = Math.sin(seg(t, 23.25, 23.6) * Math.PI);
    wisp.position.copy(st.px(SW * 0.5 + 40, 380, 6)); wisp.material.opacity = 0.55 * seg(t, 23.9, 24.4) * (1 - seg(t, 26.4, 27.2)); wisp.position.y += Math.sin(t * 1.4) * 8;
    words.forEach((m) => (m.material.opacity = easeOut(seg(t, m.userData.t0, m.userData.t0 + 0.5))));
    days.forEach((m, i) => { const t0 = m.userData.t0, t1 = i < 2 ? days[i + 1].userData.t0 : 99; m.material.opacity = seg(t, t0, t0 + 0.25) * (1 - seg(t, t1, t1 + 0.15)); m.scale.setScalar(lerp(1.4, 1, easeOut(seg(t, t0, t0 + 0.25)))); });
    const u = seg(t, 22.6, 30.2); st.camera.position.set(lerp(-30, 30, u), lerp(10, -20, u), lerp(st.D, st.D * 0.84, ease(u))); st.camera.lookAt(0, -40 * u, 0);
    st.look = { blur: 0.0045, focus: 0.52, band: 0.2 };
  };
  return st;
}

// ───────── 双层瓮剖面图（第 15–19 句）─────────
export function buildJar() {
  const st = new Stage(30);
  const c = mk(SW * RES, SH * RES), g = c.getContext("2d"), t0 = tex(c, { mip: false });
  const mat = revealMaterial(t0); st.layer(mat, 0, 1.12);
  const dim = st.layer(new THREE.MeshBasicMaterial({ color: 0x120a05, transparent: true, opacity: 0, depthWrite: false }), 20, 1.2);
  let last = "";
  st.update = (t) => {
    const p = {
      soil: seg(t, 58.1, 58.8), water: seg(t, 58.7, 59.4), branch: ease(seg(t, 59.3, 60.1)), basket: seg(t, 60.0, 60.5), labels: seg(t, 60.2, 60.8),
      ripe: lerp(0.12, 1, ease(seg(t, 61.4, 63.8))), wilt: seg(t, 64.6, 65.7), pick: seg(t, 65.8, 66.9), salt: seg(t, 66.3, 67.5), fruitsIn: seg(t, 66.8, 67.6), labels2: seg(t, 67.2, 67.9), title2: t > 66.7 ? 1 : 0,
      ice: seg(t, 68.7, 70.5), labels3: seg(t, 69.6, 70.2),
    };
    const key = JSON.stringify(p) + (p.ice > 0.2 ? Math.floor(t * 30) : 0) + (p.water > 0 ? Math.floor(t * 10) : 0);
    if (key !== last) { g.setTransform(RES, 0, 0, RES, 0, 0); jarDiagram(g, p, t); t0.needsUpdate = true; last = key; }
    mat.uniforms.uReveal.value = easeOut(seg(t, 56.9, 58.1));
    dim.material.opacity = 0.5 * seg(t, 71.8, 72.4);
    // 镜头：第 16 句推到果子跟前，之后拉回
    const f = st.px(980, 300, 0), push = ease(seg(t, 61.0, 62.2)) * (1 - ease(seg(t, 64.2, 65.2)));
    st.camera.position.set(lerp(0, f.x, push), lerp(0, f.y, push), lerp(st.D, st.D * 0.45, push)); st.camera.lookAt(lerp(0, f.x, push), lerp(0, f.y, push), 0);
    st.look = { blur: 0.0018 + push * 0.004, focus: 0.5, band: 0.2 };
  };
  return st;
}

// ───────── 春明门：只有一骑、两坛 ─────────
export function buildGate() {
  const st = new Stage(30);
  let info; const bgC = canvasOf((g) => { info = gateScene(g); });
  st.layer(basic(T(bgC)), 0, 1.12);
  const sheet = riderSheet({ jars: 2 }), s = st.pxScale(0, 1.12);
  const rider = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: sheet.t, transparent: true, depthWrite: false })); rider.geometry.translate(0, 0.42, 0); st.scene.add(rider);
  const dust = new RedDust(300, { color: [170, 120, 80], size: 60 }); st.scene.add(dust.points);
  const xAt = (tt) => lerp(2760, info.gx + 30, easeOut(seg(tt, 100.0, 103.3)));
  st.update = (t) => {
    const x = xAt(t), y = info.wallBot + 120, size = 360;
    rider.scale.set(-size * s, size * s, 1); rider.position.copy(st.px(x, y, 4)); sheet.t.offset.x = (Math.floor(t * 15) % sheet.n) / sheet.n;
    rider.material.opacity = 1 - seg(t, 103.0, 103.5); rider.visible = t < 103.6;
    dust.update(t, 99.8, 103.4, (tb) => ({ p: st.px(xAt(tb) + 80, y - 10, 5), k: s * 3.4 }), 2.4, 1 - seg(t, 103.6, 104.4));
    const u = seg(t, 99.2, 104.6); st.camera.position.set(lerp(160, -40, u), lerp(-30, 10, u), lerp(st.D, st.D * 0.88, ease(u))); st.camera.lookAt(lerp(120, -30, u), lerp(-40, 0, u), 0);
    st.look = { blur: 0.003, focus: 0.62, band: 0.22 };
  };
  return st;
}

// ───────── 剥开的荔枝 ─────────
export function buildPeel() {
  const st = new Stage(30);
  let info; const c = canvasOf((g) => { info = peeledScene(g); });
  st.layer(basic(T(c)), 0, 1.12);
  const gl = canvasOf((g) => { const gr = g.createLinearGradient(0, 0, 400, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 400, 400); }, 400, 400);
  const s = st.pxScale(0, 1.12), gleam = new THREE.Mesh(new THREE.PlaneGeometry(120 * s, 300 * s), new THREE.MeshBasicMaterial({ map: tex(gl), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); gleam.rotation.z = -0.5; st.scene.add(gleam);
  st.update = (t) => {
    const k = seg(t, 108.6, 109.8); gleam.position.copy(st.px(info.fx - 140 + k * 280, info.fy - 20, 3)); gleam.material.opacity = Math.sin(k * Math.PI) * 0.6;
    const f = st.px(info.fx + 60, info.fy + 40, 0), u = ease(seg(t, 107.8, 111.2));
    st.camera.position.set(lerp(0, f.x * 0.6, u), lerp(0, f.y * 0.6, u), lerp(st.D, st.D * 0.7, u)); st.camera.lookAt(lerp(0, f.x * 0.6, u), lerp(0, f.y * 0.6, u), 0);
    st.look = { blur: 0.005, focus: 0.5, band: 0.18 };
  };
  return st;
}

// ───────── 天平 ─────────
export function buildScale() {
  const st = new Stage(30);
  const c = mk(SW * RES, SH * RES), g = c.getContext("2d"), t0 = tex(c, { mip: false });
  st.layer(basic(t0), 0, 1.12);
  let last = "";
  st.update = (t) => {
    const bump = Math.sin(seg(t, 112.2, 112.7) * Math.PI);
    const p = { lychee: easeOut(seg(t, 111.4, 111.8)), camel: easeOut(seg(t, 112.0, 112.4)), tilt: 0.45 * ease(seg(t, 111.7, 112.1)) - 0.35 * bump + 0.55 * ease(seg(t, 112.6, 113.4)), labels: seg(t, 113.0, 113.6) };
    const key = Object.values(p).map((v) => v.toFixed(3)).join(",");
    if (key !== last) { g.setTransform(RES, 0, 0, RES, 0, 0); scaleScene(g, p); t0.needsUpdate = true; last = key; }
    const u = seg(t, 110.6, 115.0); st.camera.position.set(0, lerp(-20, 20, u), lerp(st.D, st.D * 0.9, ease(u))); st.camera.lookAt(0, 0, 0);
    st.look = { blur: 0.002, focus: 0.5, band: 0.3 };
  };
  return st;
}

// ───────── 荔枝园：被砍（第 30 句）、补种（第 32 句）─────────
export function buildOrchard() {
  const st = new Stage(30);
  let info; const bgC = canvasOf((g) => { info = orchardBack(g); });
  st.layer(basic(T(bgC)), -500, 1.16);
  const treeT = [1, 2, 3].map((sd) => tex(canvasOf((g) => treeArt(g, 256, 500, 1.8, sd), 512, 512)));
  const stumpT = tex(canvasOf((g) => stumpArt(g, 128, 240, 3.2), 256, 256));
  const sapT = tex(canvasOf((g) => saplingArt(g, 128, 250, 4.6), 256, 256));
  const R = rng(9), trees = [];
  const rows = [[-380, 0.62, 9], [-180, 0.7, 8], [20, 0.8, 7]];
  rows.forEach(([z, vy, n], ri) => { for (let i = 0; i < n; i++) { const u = (i + 0.5 + (R() - 0.5) * 0.4) / n; const base = st.at(lerp(0.06, 0.94, u), vy + (R() - 0.5) * 0.02, z); const size = st.pxScale(z, 1.12) * (ri === 2 ? 560 : ri === 1 ? 470 : 400); const tr = new THREE.Mesh(new THREE.PlaneGeometry(size, size), basic(treeT[(i + ri) % 3])); tr.geometry.translate(0, size * 0.5 - size * 0.02, 0); tr.position.copy(base); st.scene.add(tr); const sp = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.5, size * 0.5), basic(stumpT, 0)); sp.geometry.translate(0, size * 0.25 - size * 0.06, 0); sp.position.copy(base).add(new THREE.Vector3(0, 0, 1)); st.scene.add(sp); const sa = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.42, size * 0.42), basic(sapT, 0)); sa.geometry.translate(0, size * 0.21 - size * 0.04, 0); sa.position.copy(base).add(new THREE.Vector3(size * 0.22, 0, 2)); st.scene.add(sa); trees.push({ tr, sp, sa, tc: 115.3 + R() * 2.2, tp: 123.1 + R() * 2.0, dir: R() < 0.5 ? -1 : 1 }); } });
  const sealA = plane(tex(seal("三十亩", 300, { white: true })), 1, 1, 0), sealB = plane(tex(seal("两年", 300, { white: true })), 1, 1, 0); st.scene.add(sealA, sealB);
  const farmer = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic(tex(canvasOf((g) => figureArt(g, 256, 490, 4.2, "plant", 0, { color: "#1b130c" }), 512, 512)), 0)); st.scene.add(farmer);
  st.update = (t) => {
    const replant = t > 120;
    trees.forEach(({ tr, sp, sa, tc, tp, dir }) => {
      const k = replant ? 1 : seg(t, tc, tc + 0.6);
      tr.visible = k < 1; tr.rotation.z = dir * ease(k) * 1.45; tr.material.opacity = 1 - seg(k, 0.6, 1);
      sp.material.opacity = replant ? 1 : seg(t, tc + 0.25, tc + 0.5);
      const ks = replant ? easeOut(seg(t, tp, tp + 0.7)) : 0; sa.material.opacity = ks; sa.scale.setScalar(Math.max(0.01, ks));
    });
    const sz = st.pxScale(30, 1.12);
    const ka = seg(t, 115.7, 116.0), kb = seg(t, 116.6, 116.9);
    sealA.visible = !replant; sealA.material.opacity = ka; sealA.scale.setScalar(300 * sz * 0.8 * lerp(1.5, 1, easeOut(ka))); sealA.position.copy(st.px(330, 330, 30));
    sealB.visible = !replant; sealB.material.opacity = kb; sealB.scale.setScalar(300 * sz * 0.7 * lerp(1.5, 1, easeOut(kb))); sealB.position.copy(st.px(330, 640, 30));
    farmer.visible = replant; farmer.material.opacity = seg(t, 122.6, 123.2); farmer.scale.setScalar(sz * 520); farmer.position.copy(st.px(1180, 1180 + Math.sin(t * 2.2) * 6, 40));
    const u = replant ? seg(t, 122.2, 126.4) : seg(t, 114.4, 119.0);
    st.camera.position.set(lerp(-80, 80, u), lerp(30, 0, u), lerp(st.D, st.D * 0.9, u)); st.camera.lookAt(lerp(-40, 40, u), 0, 0);
    st.look = { blur: 0.0035, focus: 0.66, band: 0.2 };
    void info;
  };
  return st;
}
