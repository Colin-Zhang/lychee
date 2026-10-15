// 地图布景：四块底图贴在桌面上；镜头斜着贴近地图飞（推、拉、跟着线头走）；叙事标记全在这里：
// 起止印、五千四百四十七里的预览线、逐格点亮、五岭长江秦岭、天下驿站网、三日红线、李善德南下、四条试走的路、正式上路（马 / 船、驿站点、地名朱印、第 N 日签、梅关背瓮的挑夫）、
// 九成九坏在路上（压暗、变灰）、贬回岭南、叛军南下与西逃、最后一次亮线。
import * as THREE from "three";
import { drawMap, MW, MH, P, CELL } from "./map.js";
import { ROUTE, ROADS, LI_SOUTH, TRIAL_ROUTES, REBELS, FLIGHT, RANGES, RIVERS } from "./geo.js";
import { InkLine, Dots } from "./inkline.js";
import { renderer, tex, Stage, W, H } from "./engine.js";
import { mk, seal, brushText, riderArt, boatArt, porterArt, figureArt, rng, VERM, INK } from "./art.js";

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const soft = (x) => 0.7 * x + 0.3 * ease(x);
const lerp = (a, b, k) => a + (b - a) * k;
const win = (t, a, b, fi = 0.4, fo = 0.4) => Math.min(seg(t, a, a + fi), 1 - seg(t, b - fo, b));
const W3 = (x, y, h = 0) => new THREE.Vector3(x - MW / 2, h, y - MH / 2);
const PX = (lon, lat) => P(lon, lat);

// ───────── 精灵帧（马、船、挑夫、步行的人）：一张横条贴图，按帧换 UV ─────────
function sheet(n, size, draw) { const c = mk(size * n, size), g = c.getContext("2d"); for (let i = 0; i < n; i++) { g.save(); g.translate(i * size, 0); draw(g, i / n, size); g.restore(); } const t = tex(c, { mip: true }); t.repeat.set(1 / n, 1); return { t, n }; }
function flatLabel(canvas, order = 20) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(canvas), transparent: true, depthTest: false, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = order; m.userData.aspect = canvas.width / canvas.height; m.visible = false; return m;
}
function textCanvas(txt, size, { color = INK, vertical = false, pad = 0.3 } = {}) {
  const n = [...txt].length, w = vertical ? size * (1 + pad * 2) : size * (n * 1.02 + pad * 2), h = vertical ? size * (n * 1.06 + pad * 2) : size * (1 + pad * 2);
  const c = mk(Math.ceil(w), Math.ceil(h)), g = c.getContext("2d");
  g.shadowColor = "rgba(239,226,190,.95)"; g.shadowBlur = size * 0.25;
  if (vertical) brushText(g, txt, w / 2, size * (pad + 0.55), size, { color, vertical: true }); else brushText(g, txt, w / 2, h / 2, size, { color });
  return c;
}
function ringCanvas(size = 256) { const c = mk(size, size), g = c.getContext("2d"), R = rng(4); g.strokeStyle = VERM; g.lineCap = "round"; for (let k = 0; k < 3; k++) { g.lineWidth = size * (0.05 - k * 0.012); g.globalAlpha = 0.9 - k * 0.25; g.beginPath(); for (let i = 0; i <= 60; i++) { const a = (i / 60) * Math.PI * 2.08 - 0.3, r = size * (0.4 + (R() - 0.5) * 0.02); i ? g.lineTo(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r) : g.moveTo(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r); } g.stroke(); } return c; }
function blobCanvas() { const c = mk(128, 64), g = c.getContext("2d"); const gr = g.createRadialGradient(64, 32, 2, 64, 32, 60); gr.addColorStop(0, "rgba(30,20,10,.45)"); gr.addColorStop(1, "rgba(30,20,10,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 64); return c; }
function flameCanvas() { const c = mk(128, 192), g = c.getContext("2d"); const gr = g.createRadialGradient(64, 140, 4, 64, 120, 90); gr.addColorStop(0, "rgba(255,240,180,1)"); gr.addColorStop(0.3, "rgba(255,150,60,.95)"); gr.addColorStop(0.7, "rgba(200,50,30,.6)"); gr.addColorStop(1, "rgba(120,20,10,0)"); g.fillStyle = gr; g.beginPath(); g.moveTo(64, 10); g.bezierCurveTo(100, 70, 120, 120, 96, 170); g.quadraticCurveTo(64, 192, 32, 170); g.bezierCurveTo(8, 120, 28, 70, 64, 10); g.fill(); return c; }

export function buildMap() {
  const set = new Stage(32); set.camera.far = 60000; set.camera.near = 20;
  const { scene, camera } = set;
  // ── 桌面（地图外面露出来的地方）
  const wood = mk(512, 512), wg = wood.getContext("2d"), WR = rng(3);
  wg.fillStyle = "#2a1b10"; wg.fillRect(0, 0, 512, 512); for (let i = 0; i < 140; i++) { const y = WR() * 512; wg.strokeStyle = `rgba(${60 + WR() * 30},${36 + WR() * 20},${18},${0.25 + WR() * 0.2})`; wg.lineWidth = 1 + WR() * 3; wg.beginPath(); wg.moveTo(0, y); for (let x = 0; x <= 512; x += 32) wg.lineTo(x, y + Math.sin(x / 70 + i) * 4); wg.stroke(); }
  const woodT = tex(wood, { wrap: true }); woodT.repeat.set(14, 10);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(MW * 4, MH * 4), new THREE.MeshBasicMaterial({ map: woodT })); table.rotation.x = -Math.PI / 2; table.position.y = -8; scene.add(table);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(MW * 1.06, MH * 1.08), new THREE.MeshBasicMaterial({ map: tex(blobCanvas()), transparent: true, opacity: 0.9, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.set(30, -4, 50); scene.add(shadow);
  // ── 底图：分四块画，画一块传一块，传完释放
  const TW = Math.ceil(MW / 2), TH = Math.ceil(MH / 2);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const c = mk(TW, TH), g = c.getContext("2d"); g.translate(-i * TW, -j * TH); drawMap(g);
    const t = tex(c, { mip: true, free: true });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH), new THREE.MeshBasicMaterial({ map: t })); m.rotation.x = -Math.PI / 2; m.position.set(i * TW + TW / 2 - MW / 2, 0, j * TH + TH / 2 - MH / 2); scene.add(m);
  }
  // ── 压暗用的一层（九成九坏在路上）
  const dim = new THREE.Mesh(new THREE.PlaneGeometry(MW * 1.2, MH * 1.2), new THREE.MeshBasicMaterial({ color: 0x140c06, transparent: true, opacity: 0, depthTest: false, depthWrite: false })); dim.rotation.x = -Math.PI / 2; dim.position.y = 2; dim.renderOrder = 5; scene.add(dim);

  // ── 路线与各种线
  const routePx = ROUTE.map(([a, b]) => PX(a, b)), kinds = ROUTE.map((r) => r[2]);
  const route = new InkLine(routePx, { kinds, seed: 3, order: 14 });
  const preview = new InkLine(routePx, { colL: "#4a3e33", colW: "#4a3e33", dashAll: true, seed: 5, order: 11 });
  const grey = new InkLine(routePx, { colL: "#5a4e43", colW: "#5a4e43", dashAll: true, seed: 6, order: 11 });   // 三日之外剩下的路
  const three = new InkLine(routePx, { kinds, seed: 7, order: 13, dashW: false });
  const liSouth = new InkLine(LI_SOUTH.map(([a, b]) => PX(a, b)), { colL: "#3f352c", colW: "#3f352c", dashAll: true, seed: 9, order: 12 });
  const trialCols = ["#4f6b78", "#7a6a4c", "#5c5a72", "#6a7448"];
  const trials = TRIAL_ROUTES.map((r, i) => new InkLine(r.map(([a, b]) => PX(a, b)), { colL: trialCols[i], colW: trialCols[i], seed: 20 + i, order: 12, wobble: 4 }));
  const finalPreview = new InkLine(routePx, { colL: VERM, colW: VERM, dashAll: true, seed: 8, order: 12 });
  const exile = new InkLine([...routePx].reverse(), { colL: "#3f352c", colW: "#3f352c", dashAll: true, seed: 31, order: 15 });
  const rebels = new InkLine(REBELS.map(([a, b]) => PX(a, b)), { colL: "#2a120c", colW: "#2a120c", seed: 33, order: 15, wobble: 5 });
  const flight = new InkLine(FLIGHT.map(([a, b]) => PX(a, b)), { colL: "#b0801e", colW: "#b0801e", dashAll: true, seed: 35, order: 15 });
  const band = (pts, col, seed) => new InkLine(pts.map(([a, b]) => PX(a, b)), { colL: col, colW: col, seed, order: 9, wobble: 10, step: 14 });
  const RG = (name) => RANGES.find((r) => r[0] === name)[1], RV = (name) => RIVERS.find((r) => r[0] === name)[2];
  const hazards = [band(RG("五岭"), "#8a4f2a", 41), band(RV("长江").slice(7, 17), "#2f6c8c", 42), band(RG("秦岭"), "#8a4f2a", 43)];
  [route, preview, grey, three, liSouth, ...trials, finalPreview, exile, rebels, flight, ...hazards].forEach((l) => scene.add(l.mesh));

  // ── 驿站点：正式路线每三十里一点；天下驿道网
  const L = route.length, nSt = Math.round(5447 / 30);
  const stations = new Dots(Array.from({ length: nSt + 1 }, (_, k) => { const p = route.at(k / nSt); return [p.x, p.y, k / nSt]; }), { size: 9, order: 16 });
  const ca = PX(108.94, 34.34), net = [];
  ROADS.forEach(([, pts]) => { const q = pts.map(([a, b]) => PX(a, b)); for (let i = 0; i < q.length - 1; i++) { const [x0, y0] = q[i], [x1, y1] = q[i + 1], d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(d / (0.3 * CELL))); for (let k = 0; k < n; k++) { const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n; net.push([x, y, Math.hypot(x - ca[0], y - ca[1])]); } } });
  const maxD = Math.max(...net.map((n) => n[2])); net.forEach((n) => (n[2] /= maxD));
  const network = new Dots(net, { size: 8, fill: "#f6e7c4", ring: "#9a3a2c", order: 15 });
  scene.add(stations.points, network.points);

  // ── 格子：路线经过的格（按经过的先后）
  const cells = [], seen = new Set();
  for (let s = 0; s <= 1; s += 0.0015) { const p = route.at(s), key = `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)}`; if (!seen.has(key)) { seen.add(key); cells.push([Math.floor(p.x / CELL), Math.floor(p.y / CELL)]); } }
  const cellMat = new THREE.MeshBasicMaterial({ color: 0xb8342a, transparent: true, opacity: 0.2, depthTest: false, depthWrite: false });
  const cellEdge = new THREE.LineBasicMaterial({ color: 0x9a2a20, transparent: true, opacity: 0.8, depthTest: false });
  const cellMeshes = cells.map(([i, j]) => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.PlaneGeometry(CELL, CELL), cellMat.clone()); m.rotation.x = -Math.PI / 2; m.renderOrder = 8; g.add(m); const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(CELL, CELL)), cellEdge.clone()); e.rotation.x = -Math.PI / 2; e.renderOrder = 8; g.add(e); g.position.copy(W3((i + 0.5) * CELL, (j + 0.5) * CELL, 3)); g.visible = false; scene.add(g); return g; });

  // ── 印章、地名朱圈、第 N 日签、文字
  const ringT = ringCanvas();
  const mkStamp = (canvas, x, y, size) => { const m = flatLabel(canvas, 22); m.userData.px = [x, y]; m.userData.size = size; scene.add(m); return m; };
  const zh = PX(113.59, 23.55);
  const sealStart = mkStamp(seal("起", 220, { white: true }), zh[0] + 70, zh[1] + 40, 70);
  const sealEnd = mkStamp(seal("终", 220, { white: true }), ca[0] - 80, ca[1] - 60, 70);
  const sealArrive = mkStamp(seal("至", 260, { white: true }), ca[0] - 90, ca[1] - 70, 96);
  const sealThree = mkStamp(seal("三日", 220, { white: true }), 0, 0, 80);
  const sealDing = mkStamp(seal("定", 220, { white: true }), 0, 0, 74);
  const hazardSeals = [["五岭", 112.0, 24.55], ["长江", 116.6, 31.1], ["秦岭", 108.6, 33.4]].map(([t, a, b]) => { const p = PX(a, b); return mkStamp(seal(t, 220, { white: true }), p[0], p[1], 82); });
  const trialSeals = ["一", "二", "三", "四"].map((t) => mkStamp(seal(t, 200, { white: true }), 0, 0, 56));
  const labelLi = mkStamp(textCanvas("五千四百四十七里", 120, { color: "#3f352c" }), 0, 0, 72);
  const labelRest = mkStamp(textCanvas("尚余八日之程", 110, { color: "#4a3e33" }), 0, 0, 62);
  const labelWest = mkStamp(seal("西幸", 220, { white: true }), PX(104.3, 30.9)[0] - 90, PX(104.3, 30.9)[1] - 40, 70);
  const named = route.pts.length && ROUTE.map((r, i) => ({ name: r[3], i })).filter((r) => r.name);
  // 每个地名在线上的位置（比例）：找线上离它最近的点
  const nearestProg = (x, y, line) => { let best = 0, bd = 1e18, s = 0; for (let i = 0; i < line.pts.length; i++) { if (i) s += Math.hypot(line.pts[i][0] - line.pts[i - 1][0], line.pts[i][1] - line.pts[i - 1][1]); const d = (line.pts[i][0] - x) ** 2 + (line.pts[i][1] - y) ** 2; if (d < bd) { bd = d; best = s; } } return best / line.length; };
  const placeRings = named.map(({ name, i }) => { const p = routePx[i], m = mkStamp(ringT, p[0], p[1], 64); m.userData.prog = nearestProg(p[0], p[1], route); m.userData.name = name; return m; });
  const dayTags = Array.from({ length: 11 }, (_, k) => { const prog = (k + 1) / 11, p = route.at(prog), nx = -p.dy, ny = p.dx, d = Math.hypot(nx, ny) || 1; const m = mkStamp(seal(`${["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一"][k]}日`, 200, { white: true }), p.x + (nx / d) * 70, p.y + (ny / d) * 70, 52); m.userData.prog = prog; return m; });
  const progMeiguan = nearestProg(...PX(114.32, 25.33), route), progDan = nearestProg(...PX(110.88, 33.53), route);
  const zhRing = mkStamp(ringT, zh[0], zh[1], 70);

  // ── 小剪影：马、船、挑夫、人（始终面向镜头，脚下一块影子）
  const riderS = sheet(12, 256, (g, ph, s) => riderArt(g, s * 0.5, s * 0.92, s / 240, ph));
  const greyRiderS = sheet(12, 256, (g, ph, s) => riderArt(g, s * 0.5, s * 0.92, s / 240, ph, { color: "#3f352c", far: "#6a5e52", robe: "#4a3e33", accent: "#6a5e52" }));
  const boatS = sheet(4, 256, (g, ph, s) => boatArt(g, s * 0.5, s * 0.86, s / 180, ph));
  const porterS = sheet(8, 256, (g, ph, s) => porterArt(g, s * 0.5, s * 0.92, s / 150, ph));
  const walkS = sheet(8, 256, (g, ph, s) => figureArt(g, s * 0.5, s * 0.95, s / 110, "walk", ph, { color: "#3f352c" }));
  const blobT = tex(blobCanvas());
  const icon = (sh) => { const mat = new THREE.SpriteMaterial({ map: sh.t.clone(), transparent: true, depthTest: false, depthWrite: false }); mat.map.repeat.set(1 / sh.n, 1); mat.map.needsUpdate = true; const sp = new THREE.Sprite(mat); sp.center.set(0.5, 0.06); sp.renderOrder = 30; sp.visible = false; const bl = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthTest: false, depthWrite: false })); bl.rotation.x = -Math.PI / 2; bl.renderOrder = 29; bl.visible = false; scene.add(sp, bl); return { sp, bl, n: sh.n }; };
  const horse = icon(riderS), boat = icon(boatS), liIcon = icon(greyRiderS), exileIcon = icon(walkS), flightIcon = icon(greyRiderS);
  const porters = Array.from({ length: 6 }, () => icon(porterS));
  const porterPath = [PX(114.18, 25.02), PX(114.27, 25.18), PX(114.32, 25.33), PX(114.36, 25.47)];
  // ── 火（叛军）
  const flameT = tex(flameCanvas());
  const fires = [[112.45, 34.62, 127.9], [110.25, 34.55, 128.5], [108.94, 34.34, 128.8]].map(([a, b, t0]) => { const p = PX(a, b); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameT, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })); sp.center.set(0.5, 0.1); sp.renderOrder = 28; sp.visible = false; sp.position.copy(W3(p[0], p[1], 6)); sp.userData.t0 = t0; scene.add(sp); return sp; });
  const arrowHead = (() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(-1, 0.55); s.lineTo(-0.75, 0); s.lineTo(-1, -0.55); s.closePath(); const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: 0x2a120c, transparent: true, depthTest: false, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 16; m.visible = false; scene.add(m); return m; })();

  // ───────── 镜头 ─────────
  const C = (lon, lat) => PX(lon, lat);
  const FULL = { c: C(111.7, 29.25), vis: 7800, tilt: 16, head: 0 };
  function placeCam(c, vis, tilt, head) {
    const D = vis / (2 * (W / H) * Math.tan((camera.fov * Math.PI) / 360)), th = (tilt * Math.PI) / 180, hd = (head * Math.PI) / 180;
    const T = W3(c[0], c[1], 0), off = new THREE.Vector3(0, D * Math.cos(th), D * Math.sin(th)).applyAxisAngle(new THREE.Vector3(0, 1, 0), hd);
    camera.position.copy(T).add(off); camera.up.copy(new THREE.Vector3(0, Math.sin(th), -Math.cos(th)).applyAxisAngle(new THREE.Vector3(0, 1, 0), hd)); camera.lookAt(T);
    set.look = { blur: clamp((tilt - 12) / 40) * 0.0065, focus: 0.5, band: 0.16 };
    set.wpx = vis / W;   // 一个屏幕像素大约是多少地图像素
  }
  const mixCam = (a, b, k) => ({ c: [lerp(a.c[0], b.c[0], k), lerp(a.c[1], b.c[1], k)], vis: Math.exp(lerp(Math.log(a.vis), Math.log(b.vis), k)), tilt: lerp(a.tilt, b.tilt, k), head: lerp(a.head, b.head, k) });
  const K = (lon, lat, vis, tilt, head = 0) => ({ c: C(lon, lat), vis, tilt, head });
  // 关键帧镜头：[[t, cam], …]（相邻两帧之间缓入缓出）
  const keyed = (t, keys) => { if (t <= keys[0][0]) return keys[0][1]; for (let i = 0; i < keys.length - 1; i++) if (t <= keys[i + 1][0]) return mixCam(keys[i][1], keys[i + 1][1], ease(seg(t, keys[i][0], keys[i + 1][0]))); return keys[keys.length - 1][1]; };
  const followCam = (line, prog, vis, tilt, head = 0, lead = 0.012) => { const p = line.at(clamp(prog)), q = line.at(clamp(prog + lead)); return { c: [lerp(p.x, q.x, 0.6), lerp(p.y, q.y, 0.6)], vis, tilt, head }; };

  // 正式路线的进度
  const sRoute = (t) => {
    if (t < 80.4) return 0;
    if (t < 83.5) return lerp(0, progMeiguan - 0.018, soft(seg(t, 80.4, 83.5)));
    if (t < 87.3) return lerp(progMeiguan - 0.018, progMeiguan + 0.016, seg(t, 83.5, 87.3));
    if (t < 91.9) return lerp(progMeiguan + 0.016, progDan, soft(seg(t, 87.3, 91.9)));
    if (t < 95.8) return lerp(progDan, 1, soft(seg(t, 91.9, 95.8)));
    return 1;
  };
  const liProg = (t) => soft(seg(t, 52.8, 55.3)), exileProg = (t) => soft(seg(t, 119.2, 121.8));
  const threeProg = (t) => (3 / 11) * soft(seg(t, 46.3, 48.4));

  function cameraAt(t) {
    if (t < 57.2) return keyed(t, [[29.4, K(113.75, 23.95, 2300, 40, -6)], [30.4, K(113.75, 23.95, 2300, 40, -6)], [33.0, FULL], [41.4, { ...FULL, vis: 7400 }], [45.6, K(111.0, 30.4, 7000, 18)], [46.6, K(114.0, 25.9, 4200, 36, -4)], [49.2, K(113.6, 26.6, 4400, 34, -3)], [50.8, FULL], [52.6, FULL],
      [55.3, K(113.5, 24.4, 3200, 38, -4)], [56.8, K(113.66, 23.75, 1500, 50, -6)]]);
    if (t < 80.3) return keyed(t, [[75.6, FULL], [80.0, { ...FULL, vis: 7300 }], [80.3, followCam(route, 0, 2700, 42, -6)]]);
    if (t < 100.1) {
      const pr = sRoute(t);
      if (t < 83.5) return followCam(route, pr, 2700, 42, -6);
      if (t < 87.3) { const a = followCam(route, sRoute(83.5), 2700, 42, -6), b = { c: C(114.29, 25.26), vis: 1250, tilt: 56, head: -10 }; return mixCam(a, b, ease(seg(t, 83.5, 84.5)) * (1 - ease(seg(t, 86.6, 87.4)))); }
      if (t < 91.9) return mixCam(followCam(route, pr, 2700, 42, -6), followCam(route, pr, 3900, 40, -4), ease(seg(t, 87.3, 88.3)));
      if (t < 95.8) return mixCam(followCam(route, pr, 3900, 40, -4), followCam(route, pr, 2900, 44, -2), ease(seg(t, 91.9, 92.9)));
      return mixCam(followCam(route, 1, 2900, 44, -2), FULL, ease(seg(t, 95.8, 97.8)));
    }
    if (t < 108.5) return { ...FULL, tilt: 12 };
    if (t < 123) { const p = exile.at(exileProg(t)); const a = K(109.6, 33.6, 3800, 34), b = { c: [p.x, p.y], vis: 3800, tilt: 34, head: 0 }, cz = K(113.66, 23.75, 1900, 44, -6); return t < 121.8 ? mixCam(a, b, ease(seg(t, 118.6, 119.6))) : mixCam(b, cz, ease(seg(t, 121.8, 122.8))); }
    if (t < 131.5) return keyed(t, [[125.8, K(110.4, 34.2, 5400, 26)], [128.6, K(109.8, 33.6, 5600, 26)], [130.6, K(107.4, 32.6, 5600, 28, 4)]]);
    return keyed(t, [[135.4, FULL], [141, { ...FULL, vis: 7200, tilt: 20 }]]);
  }

  // ───────── 每一帧 ─────────
  const stampK = (t, t0) => { const k = seg(t, t0, t0 + 0.28); return { s: lerp(1.7, 1, ease(k)), o: k, on: t >= t0 }; };
  function placeFlat(m, x, y, sizePx, wpx, k = { s: 1, o: 1, on: true }, h = 8, rot = 0) {
    m.visible = k.on && k.o > 0.003; if (!m.visible) return;
    const s = sizePx * wpx * k.s; m.scale.set(s * m.userData.aspect, s, 1); m.position.copy(W3(x, y, h)); m.rotation.z = rot; m.material.opacity = k.o;
  }
  function placeIcon(ic, x, y, sizePx, wpx, frame, opacity = 1, flip = false) {
    ic.sp.visible = ic.bl.visible = opacity > 0.01; if (!ic.sp.visible) return;
    const s = sizePx * wpx; ic.sp.scale.set(flip ? -s : s, s, 1); ic.sp.position.copy(W3(x, y, 10)); ic.sp.material.opacity = opacity;
    ic.sp.material.map.offset.x = (Math.floor(frame) % ic.n) / ic.n;
    ic.bl.scale.set(s * 0.8, s * 0.8, 1); ic.bl.position.copy(W3(x + s * 0.06, y + s * 0.04, 5)); ic.bl.material.opacity = 0.7 * opacity;
  }
  const hideAll = () => { [route, preview, grey, three, liSouth, ...trials, finalPreview, exile, rebels, flight, ...hazards].forEach((l) => (l.mesh.visible = false)); [stations, network].forEach((d) => (d.points.visible = false)); cellMeshes.forEach((c) => (c.visible = false)); scene.traverse((o) => { if (o.isSprite || (o.userData && o.userData.size)) o.visible = false; }); [horse, boat, liIcon, exileIcon, flightIcon, ...porters].forEach((ic) => (ic.bl.visible = false)); arrowHead.visible = false; };

  function update(t) {
    const cam = cameraAt(t); placeCam(cam.c, cam.vis, cam.tilt, cam.head);
    const wpx = set.wpx;
    hideAll();
    const hud = {};
    // —— 起止印、预览线（第 8 句）
    if (t < 46.2) {
      placeFlat(sealStart, sealStart.userData.px[0], sealStart.userData.px[1], 70, wpx, stampK(t, 30.8));
      placeFlat(sealEnd, sealEnd.userData.px[0], sealEnd.userData.px[1], 70, wpx, stampK(t, 32.6));
      const pv = soft(seg(t, 31.4, 33.4)), po = win(t, 31.3, 41.6, 0.3, 0.6);
      preview.set(pv, wpx, 3.2, po * 0.9);
      if (t > 32.5) { const mid = preview.at(0.52); const k = stampK(t, 32.9); k.o *= 1 - seg(t, 40.8, 41.4); placeFlat(labelLi, mid.x + 180, mid.y + 40, 60, wpx, k, 8); }
    }
    // —— 格子（第 9 句）
    if (t >= 34.0 && t < 41.8) {
      const n = Math.floor(cells.length * soft(seg(t, 34.2, 37.0)) + 0.001), o = 1 - seg(t, 41.0, 41.6);
      cellMeshes.forEach((c, i) => { c.visible = i < n && o > 0; if (c.visible) { const k = clamp((cells.length * soft(seg(t, 34.2, 37.0)) - i) * 1.5); c.children[0].material.opacity = 0.22 * o * k; c.children[1].material.opacity = 0.85 * o * k; } });
      hud.grid = Math.min(54, Math.round(54.47 * soft(seg(t, 34.2, 37.0)))) + (t > 37.0 ? 0.47 : 0);
    }
    // —— 五岭、长江、秦岭（第 10 句）
    if (t >= 37.9 && t < 46.4) {
      [38.0, 39.1, 40.2].forEach((t0, i) => { const k = soft(seg(t, t0, t0 + 0.9)), o = 1 - seg(t, 45.6, 46.3); hazards[i].set(k, wpx, 64, 0.42 * o); const sp = hazardSeals[i].userData.px; const sk = stampK(t, t0 + 0.6); sk.o *= o; placeFlat(hazardSeals[i], sp[0], sp[1], 78, wpx, sk); });
    }
    // —— 天下驿站（第 11 句）
    if (t >= 41.6 && t < 46.6) { network.set(soft(seg(t, 41.9, 45.0)), 1 - seg(t, 45.8, 46.5), 8); hud.yi = Math.round(1639 * soft(seg(t, 41.9, 45.0))); }
    // —— 三日红线（第 12、13 句）
    if (t >= 46.0 && t < 52.9) {
      const pr = threeProg(t), o = 1 - seg(t, 52.2, 52.8);
      three.set(pr, wpx, 6, o); three.mat.uniforms.uHead.value = 260;
      const p = three.at(pr);
      if (t < 48.6) placeIcon(horse, p.x, p.y, 92, wpx, t * 14, o, p.dx < 0);
      const sk = stampK(t, 48.5); sk.o *= o; placeFlat(sealThree, p.x + 70, p.y - 30, 78, wpx, sk);
      grey.set(1, wpx, 3.5, win(t, 48.6, 52.6, 0.5, 0.4) * 0.85, 3 / 11);
      if (t > 49.6) { const mid = grey.at(0.62); const k = stampK(t, 49.9); k.o *= 1 - seg(t, 52.0, 52.6); placeFlat(labelRest, mid.x - 260, mid.y, 58, wpx, k); }
      hud.day = Math.max(1, Math.ceil((pr / (3 / 11)) * 3 - 0.0001)); hud.li = Math.round(5447 * pr); hud.counter = t < 49.5;
    }
    // —— 李善德南下（第 14 句）
    if (t >= 52.6 && t < 57.2) {
      const pr = liProg(t); liSouth.set(pr, wpx, 3.6, 0.9);
      const p = liSouth.at(pr); if (t < 55.5) placeIcon(liIcon, p.x, p.y, 84, wpx, t * 14, 1, p.dx < 0);
      placeFlat(zhRing, zh[0], zh[1], 70, wpx, stampK(t, 55.4));
    }
    // —— 四条试走的路（第 20 句）
    if (t >= 76.2 && t < 80.4) {
      trials.forEach((l, i) => { const k = soft(seg(t, 76.6 + i * 0.12, 78.6 + i * 0.12)), o = 1 - seg(t, 78.9, 79.5); l.set(k, wpx, 4.5, 0.9 * o); const mpt = l.at(0.55 + i * 0.05); const sk = stampK(t, 77.6 + i * 0.15); sk.o *= o; placeFlat(trialSeals[i], mpt.x, mpt.y, 52, wpx, sk); });
      finalPreview.set(soft(seg(t, 79.2, 79.9)), wpx, 3, 0.75);
      const mid = route.at(0.5); placeFlat(sealDing, mid.x + 80, mid.y, 70, wpx, stampK(t, 79.7));
    }
    // —— 正式上路（第 21–25 句）及以后：路线一直留着
    if (t >= 80.2) {
      const pr = sRoute(t);
      let ro = 1, grey01 = 0, pulse = -1;
      if (t >= 104.0 && t < 108.5) { grey01 = seg(t, 104.8, 106.6) * 0.85; }
      if (t >= 118.4 && t < 131.5) ro = 0.45;
      if (t >= 135.4) { pulse = route.length * soft(seg(t, 136.4, 139.6)); if (t > 139.6) pulse = -1; }
      route.set(pr, wpx, t >= 135.4 ? 7 : 6.5, ro); route.mat.uniforms.uHead.value = t < 96 ? 300 : 0; route.mat.uniforms.uGrey.value = grey01; route.mat.uniforms.uPulse.value = pulse; route.mat.uniforms.uPulseLen.value = 420;
      if (t < 100) {
        stations.set(pr, 1, 8);
        placeRings.forEach((m) => { if (pr >= m.userData.prog - 0.001) placeFlat(m, m.userData.px[0], m.userData.px[1], 62, wpx, stampK(t, m.userData.t0)); });
        dayTags.forEach((m) => placeFlat(m, m.userData.px[0], m.userData.px[1], 50, wpx, stampK(t, m.userData.t0)));
        if (t < 95.9) { const p = route.at(pr), water = kindAt(pr) === "w"; placeIcon(water ? boat : horse, p.x, p.y, water ? 104 : 96, wpx, t * (water ? 3 : 14), 1, p.dx < 0); }
        placeFlat(sealArrive, sealArrive.userData.px[0], sealArrive.userData.px[1], 96, wpx, stampK(t, 95.9));
        // 梅关：背瓮的挑夫一个接一个翻过去
        if (t >= 83.6 && t < 87.6) porters.forEach((ic, i) => { const u = seg(t, 83.8 + i * 0.42, 86.6 + i * 0.3); if (u <= 0 || u >= 1) return; const pp = along(porterPath, u); placeIcon(ic, pp[0], pp[1], 70, wpx, (t * 9 + i * 2), win(t, 83.8 + i * 0.42, 86.6 + i * 0.3, 0.2, 0.2)); });
        hud.day = Math.max(1, Math.ceil(pr * 11 - 0.0001)); hud.li = pr >= 1 ? 5447 : Math.round(5447 * pr / 10) * 10; hud.counter = true; hud.legend = true;
      } else if (t >= 135.4) { placeFlat(sealStart, sealStart.userData.px[0], sealStart.userData.px[1], 70, wpx, { s: 1, o: 1, on: true }); placeFlat(sealArrive, sealArrive.userData.px[0], sealArrive.userData.px[1], 96, wpx, { s: 1, o: 1, on: true }); }
    }
    // —— 九成九（第 27 句）：压暗
    dim.material.opacity = t >= 104.0 && t < 108.6 ? 0.42 * seg(t, 104.5, 105.3) : 0;
    // —— 贬回岭南（第 31 句）
    if (t >= 118.4 && t < 123) { const pr = exileProg(t); exile.set(pr, wpx, 3.6, 0.95); const p = exile.at(pr); if (t < 121.9) placeIcon(exileIcon, p.x, p.y, 76, wpx, t * 8, 1, p.dx < 0); placeFlat(zhRing, zh[0], zh[1], 70, wpx, stampK(t, 121.9)); }
    // —— 叛军、西逃（第 33 句）
    if (t >= 125.8 && t < 131.5) {
      const rk = soft(seg(t, 126.6, 128.4)); rebels.set(rk, wpx, 12, 0.92);
      if (rk > 0.02) { const p = rebels.at(rk), a = Math.atan2(p.dy, p.dx); arrowHead.visible = true; const s = 46 * wpx; arrowHead.scale.set(s, s, 1); arrowHead.position.copy(W3(p.x, p.y, 9)); arrowHead.rotation.z = -a; }
      fires.forEach((sp, i) => { const k = seg(t, sp.userData.t0, sp.userData.t0 + 0.4); if (k <= 0) return; sp.visible = true; const f = 1 + 0.12 * Math.sin(t * 17 + i * 2) + 0.06 * Math.sin(t * 31 + i); sp.scale.set(54 * wpx * f, 80 * wpx * f * k, 1); sp.material.opacity = 0.95 * k; });
      const fk = soft(seg(t, 128.8, 130.4)); flight.set(fk, wpx, 4.2, 0.95); const fp = flight.at(fk); if (fk > 0.01 && fk < 0.995) placeIcon(flightIcon, fp.x, fp.y, 72, wpx, t * 14, 1, fp.dx < 0);
      placeFlat(labelWest, labelWest.userData.px[0], labelWest.userData.px[1], 68, wpx, stampK(t, 130.2));
      hud.year = "天宝十五载";
    }
    return hud;
  }
  // 路线进度 → 时刻（地名朱圈、第 N 日签按线头到达的时刻盖下去）
  const tAt = (prog) => { let lo = 80.4, hi = 95.8; for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (sRoute(mid) < prog) lo = mid; else hi = mid; } return hi; };
  const routeProgs = ROUTE.map((r) => { const pp = PX(r[0], r[1]); return [nearestProg(pp[0], pp[1], route), r[2]]; });
  const kindAt = (prog) => { let best = "l"; for (const [pg, k] of routeProgs) if (pg <= prog + 1e-6) best = k; return best; };
  placeRings.forEach((m) => (m.userData.t0 = tAt(m.userData.prog))); dayTags.forEach((m) => (m.userData.t0 = tAt(m.userData.prog)));
  const along = (pts, u) => { const n = pts.length - 1, f = clamp(u) * n, i = Math.min(n - 1, Math.floor(f)), k = f - i; return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)]; };
  set.update = update;
  void renderer; void sheet;
  return set;
}
