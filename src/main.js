// 荔枝怎么送到长安（第四稿，约 86 秒，只放中英字幕）：按时间轴挑出当前的布景，相邻布景之间墨晕开转场。
// 立体场景（真实地形的青绿山水）、古地图、插画布景各有自己的“本段时间”；最上面一层 2D：地名标签和线头（各布景自己的画布）、计数章、小地图、诗的出处、字幕。
// 每一帧只由时间 t 决定：window.setFrame(t)。
import * as THREE from "three";
import { renderer, renderFrame, W, H } from "./engine.js";
import { loadDEM } from "./dem.js";
import { PLACE_CFG } from "./places.js";
import { LOOKS } from "./scenes3d.js";
import { buildScene3D } from "./scene3d.js";
import { buildMap4, LI_TOTAL } from "./mapset4.js";
import { MW, MH } from "./map.js";
import { buildDecay4, buildPlate, buildBook, buildOrchard4, buildTube, buildStation, buildRide, buildFallen, buildPeel4 } from "./vignettes4.js";
import { CAPS, SEGS, DUR, POEM, MINI } from "./timeline.js";
import { Overlay } from "./labels.js";
import { brushText } from "./art.js";

const Q = new URLSearchParams(location.search), RENDER = Q.has("render"), STRIDE = Number(Q.get("dem") || 2);
await Promise.all([document.fonts.load('40px "Brush"'), document.fonts.load('40px "SerifSC"'), document.fonts.load('700 40px "SerifSC"'), document.fonts.load('30px "NotoSerif"'), document.fonts.load('italic 30px "Garamond"'), document.fonts.load('900 40px "WM"')]);
const status = (s) => { const el = document.getElementById("status"); if (el) el.textContent = s; };
const stage = document.getElementById("stage");

// ───────── 布景：按需创建；渲染模式下接下来 3 秒用不到的就释放 ─────────
status("读地形…");
const NAMES3D = ["meiling", "ganjiang", "jiujiang", "xiangyang", "languan", "lishan"];
const demNames = [...new Set(NAMES3D.flatMap((n) => [PLACE_CFG[n].dem, PLACE_CFG[n].far]))];
const DEM = Object.fromEntries(await Promise.all(demNames.map(async (n) => [n, await loadDEM(n)])));
const BUILD = { map: buildMap4, decay: buildDecay4, plate: buildPlate, book: buildBook, orchard: buildOrchard4, tube: buildTube, station: buildStation, ride: buildRide, fallen: buildFallen, peel: buildPeel4 };
for (const n of NAMES3D) BUILD[n] = () => { const cfg = { ...PLACE_CFG[n], stride: STRIDE }; return buildScene3D(DEM[cfg.dem], DEM[cfg.far], cfg, LOOKS[n]); };
const cache = {};
function getSet(name) {
  if (!cache[name]) {
    status(`画 ${name}…`); const st = BUILD[name]();
    if (NAMES3D.includes(name) || name === "map") { st.overlay = new Overlay(stage); st.overlay.c.style.zIndex = 2; }
    cache[name] = st; status("");
  }
  return cache[name];
}
function release(t) {
  if (!RENDER) return;
  const soon = new Set(SEGS.filter(([, a, b]) => b > t - 0.05 && a < t + 3).map(([n]) => n));
  for (const name of Object.keys(cache)) {
    if (name === "map" || soon.has(name)) continue;
    const st = cache[name];
    st.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) for (const mm of Array.isArray(m) ? m : [m]) { for (const v of Object.values(mm.uniforms || {})) if (v && v.value && v.value.isTexture) v.value.dispose(); if (mm.map) mm.map.dispose(); mm.dispose(); } });
    if (st.overlay) st.overlay.c.remove();
    delete cache[name];
  }
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), seg = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const CN = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
// 中文数字：5210 → 五千二百一十，210 → 二百一十，70 → 七十
const cnNum = (n, inner = false) => { if (n >= 1000) { const q = Math.floor(n / 1000), r = n % 1000; return `${CN[q]}千${r ? (r < 100 ? "零" : "") + cnNum(r, true) : ""}`; } if (n >= 100) { const b = Math.floor(n / 100), r = n % 100; return `${CN[b]}百${r ? (r < 10 ? "零" : "") + cnNum(r, true) : ""}`; } if (n >= 10) { const s = Math.floor(n / 10), r = n % 10; return `${s === 1 && !inner ? "" : CN[s]}十${r ? CN[r] : ""}`; } return CN[n]; };

// ───────── 角上的小地图（立体场景放映时告诉观众：现在走到哪了）─────────
const map = getSet("map");
const MINI_W = 384, MINI_H = Math.round((MINI_W * 9) / 16);
const miniCanvas = (() => {
  map.miniView(); const rt = new THREE.WebGLRenderTarget(MINI_W * 2, MINI_H * 2);
  renderer.setRenderTarget(rt); renderer.setClearColor(0x2a1a10, 1); renderer.clear(); renderer.render(map.scene, map.camera); renderer.setRenderTarget(null);
  const px = new Uint8Array(MINI_W * 2 * MINI_H * 2 * 4); renderer.readRenderTargetPixels(rt, 0, 0, MINI_W * 2, MINI_H * 2, px); rt.dispose();
  const c = document.createElement("canvas"); c.width = MINI_W * 2; c.height = MINI_H * 2; const g = c.getContext("2d"), img = g.createImageData(MINI_W * 2, MINI_H * 2);
  for (let y = 0; y < MINI_H * 2; y++) img.data.set(px.subarray((MINI_H * 2 - 1 - y) * MINI_W * 8, (MINI_H * 2 - y) * MINI_W * 8), y * MINI_W * 8);
  g.putImageData(img, 0, 0); return c;
})();
const miniPath = map.miniPath(), J = map.J;
// 小地图拍的是地图布景的全图视野（中心 0.5MW, 0.52MH，宽 0.98MW，16:9）；路线点（地图像素 / MW、/ MH）按同样的方式换到小图坐标
const miniXY = ([u, v]) => { const vis = 0.98 * MW, visH = (vis * 9) / 16; return [((u * MW - (0.5 * MW - vis / 2)) / vis) * MINI_W, ((v * MH - (0.52 * MH - visH / 2)) / visH) * MINI_H]; };

// ───────── 屏幕层（2D）─────────
const hud = document.getElementById("hud"), h = hud.getContext("2d");
const stampBox = (x, y, w, hh, big, small, alpha = 1, color = "#b8342a") => {
  if (alpha <= 0) return;
  h.save(); h.globalAlpha = alpha;
  h.fillStyle = "rgba(239,226,194,.92)"; h.strokeStyle = color; h.lineWidth = 4; h.shadowColor = "rgba(0,0,0,.25)"; h.shadowBlur = 12;
  h.beginPath(); h.roundRect(x, y, w, hh, 6); h.fill(); h.shadowBlur = 0; h.stroke();
  brushText(h, big, x + w / 2, y + hh * 0.42, big.length > 6 ? 36 : 44, { color });
  h.font = 'italic 19px "Garamond"'; h.fillStyle = "rgba(120,40,30,.9)"; h.textAlign = "center"; h.fillText(small, x + w / 2, y + hh - 16);
  h.restore();
};
function drawMini(t, prog, alpha) {
  if (alpha <= 0) return;
  const x0 = 56, y0 = 56;
  h.save(); h.globalAlpha = alpha;
  h.fillStyle = "rgba(30,20,12,.55)"; h.beginPath(); h.roundRect(x0 - 8, y0 - 8, MINI_W + 16, MINI_H + 16, 8); h.fill();
  h.drawImage(miniCanvas, x0, y0, MINI_W, MINI_H);
  h.strokeStyle = "rgba(239,226,194,.9)"; h.lineWidth = 2; h.strokeRect(x0, y0, MINI_W, MINI_H);
  const pts = miniPath.map(miniXY), k = Math.round(prog * (pts.length - 1));
  h.lineCap = "round"; h.lineJoin = "round";
  h.setLineDash([5, 5]); h.strokeStyle = "rgba(222,61,39,.75)"; h.lineWidth = 2; h.beginPath(); pts.slice(k).forEach(([x, y], i) => (i ? h.lineTo(x0 + x, y0 + y) : h.moveTo(x0 + x, y0 + y))); h.stroke(); h.setLineDash([]);
  h.strokeStyle = "#de3d27"; h.lineWidth = 4; h.beginPath(); pts.slice(0, k + 1).forEach(([x, y], i) => (i ? h.lineTo(x0 + x, y0 + y) : h.moveTo(x0 + x, y0 + y))); h.stroke();
  const [hx, hy] = pts[k], ph = (t * 1.2) % 1;
  h.strokeStyle = `rgba(222,61,39,${1 - ph})`; h.lineWidth = 2; h.beginPath(); h.arc(x0 + hx, y0 + hy, 6 + ph * 14, 0, Math.PI * 2); h.stroke();
  h.fillStyle = "#de3d27"; h.beginPath(); h.arc(x0 + hx, y0 + hy, 6, 0, Math.PI * 2); h.fill(); h.strokeStyle = "#f3e6c8"; h.lineWidth = 2; h.stroke();
  h.restore();
}
function drawHud(t, info, mini) {
  h.clearRect(0, 0, W, H);
  h.fillStyle = "rgba(0,0,0,0.004)"; h.fillRect(t % 2 < 1 ? 0 : 1, 0, 1, 1);   // 画布永远不是全空、每帧都有一点变化：浏览器截图时不会沿用上一帧的旧内容
  if (info.liA) stampBox(1604, 84, 270, 108, `${cnNum(info.total ? LI_TOTAL : info.li)}里`, `${(info.total ? LI_TOTAL : info.li).toLocaleString("en")} li`, info.liA);
  if (info.dayA) stampBox(1434, 84, 150, 108, `第${CN[info.day] ?? info.day}日`, `Day ${info.day}`, info.dayA);
  if (info.noteA) { h.save(); h.globalAlpha = info.noteA; h.font = '400 26px "SerifSC"'; h.fillStyle = "rgba(239,226,194,.95)"; h.textAlign = "right"; h.shadowColor = "rgba(0,0,0,.6)"; h.shadowBlur = 8; h.fillText("推算：五千二百里，日行约五百里", 1874, 228); h.restore(); }
  if (mini) drawMini(t, mini.prog, mini.a);
  // 账号水印：右上角、全片常驻（和频道其他片子同一个样式：青绿 #4e9597、思源圆体 Heavy；计数章往下让了 28 像素）
  h.save(); h.font = '900 40px "WM"'; h.fillStyle = "#4e9597"; h.textAlign = "right"; h.textBaseline = "top"; h.fillText("@钳沿AI实验室", W - 33, 21); h.restore();
  // 诗的出处（片尾右侧竖排）
  if (t >= POEM[0] - 0.2 && t < POEM[1] + 0.6) {
    const a = Math.min(seg(t, POEM[0], POEM[0] + 0.6), 1 - seg(t, POEM[1], POEM[1] + 0.6));
    h.save(); h.globalAlpha = a * 0.92; brushText(h, POEM[2], 1820, 300, 40, { vertical: true, color: "#f3e6c8" }); h.font = 'italic 20px "Garamond"'; h.fillStyle = "rgba(243,230,200,.8)"; h.textAlign = "right"; h.fillText(POEM[3], 1860, 900); h.restore();
  }
}

// ───────── 字幕 ─────────
const capB = document.querySelector("#cap b"), capI = document.querySelector("#cap i"), capEl = document.getElementById("cap");
function captions(t) {
  const c = CAPS.find(([a, b]) => t >= a && t < b);
  if (!c) { capEl.style.opacity = 0; return; }
  const [a, b, zh, en, opt = {}] = c, kin = easeOut(seg(t, a, a + 0.5)), kout = seg(t, b - 0.3, b);
  if (opt.parts) {
    // 一处一处加上去：后面没到的部分先透明
    const zp = zh.split(/(?<=，)/), ep = en.split(/(?<=, )/), n = opt.parts.filter((p) => t >= p).length;
    capB.innerHTML = zp.map((s, i) => `<span style="opacity:${i < n ? Math.min(1, (t - opt.parts[i]) / 0.4) : 0}">${s}</span>`).join("");
    capI.innerHTML = ep.map((s, i) => `<span style="opacity:${i < n ? Math.min(1, (t - opt.parts[i]) / 0.4) : 0}">${s}</span>`).join("");
  } else { capB.textContent = zh; capI.textContent = en; }
  capEl.classList.toggle("poem", !!opt.poem);
  capEl.style.opacity = Math.min(kin, 1 - kout); capEl.style.transform = `translateY(${(1 - kin) * 10}px)`; capEl.style.filter = `blur(${(1 - kin) * 6 + kout * 4}px)`;
}

// ───────── 每一帧 ─────────
function runSet(seg_, t) {
  const [name, a, , param] = seg_, st = getSet(name), lt = t - a;
  if (name === "map") { const info = st.update(lt, param); if (st.overlay) { st.overlay.clear(); st.draw2d(st.overlay, t); } return info || {}; }
  if (NAMES3D.includes(name)) { st.shot(Math.min(lt, st.DUR)); return {}; }
  st.update(lt); return {};
}
export function setFrame(t) {
  const act = SEGS.filter(([, a, b]) => t >= a && t < b);
  if (!act.length) act.push(SEGS[SEGS.length - 1]);
  const [A, B] = act;
  let info = runSet(A, t), mix = 0;
  if (B) { const ib = runSet(B, t); if (B[0] === "map") info = ib; mix = clamp((t - B[1]) / (A[2] - B[1])); }
  // 叠层：当前布景的标签层淡出、下一个淡入；别的都藏起来
  // 标签和线头：转场前半段只留旧画面的（淡出），后半段才出新画面的（淡入）——不会同时出现两个线头
  const sm = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  for (const [name, st] of Object.entries(cache)) if (st.overlay) st.overlay.c.style.opacity = name === A[0] ? 1 - sm(0, 0.45, mix) : B && name === B[0] ? sm(0.55, 1, mix) : 0;
  const fade = Math.max(1 - seg(t, 0, 0.6), seg(t, DUR - 1.0, DUR));
  release(t);
  const mode = B ? { ink: 0, mist: 1, fade: 2 }[B[4] ?? "ink"] : 0;
  renderFrame(getSet(A[0]), B ? getSet(B[0]) : null, mix, { time: t, fade, mode });
  // 小地图：立体的路上那几段才有
  let mini = null; const m3 = [A, B].filter(Boolean).find((s) => MINI[s[0]]);
  if (m3) { const [stop, d0, d1] = MINI[m3[0]], lt = (t - m3[1]) / (m3[2] - m3[1]); mini = { prog: clamp(J.at(stop) + d0 + (d1 - d0) * lt), a: Math.min(seg(t, 42.4, 42.9), 1 - seg(t, 59.2, 59.6)) }; }

  drawHud(t, info, mini);
  captions(t);
  hud.style.opacity = 1 - fade; capEl.style.visibility = fade > 0.98 ? "hidden" : "visible";
}

window.DUR = DUR;
window.setFrame = (t) => { setFrame(t); return true; };
if (!RENDER) {
  const bar = document.getElementById("bar"), sc = document.getElementById("scrub"), tv = document.getElementById("tv"), btn = document.getElementById("play");
  bar.style.display = "block";
  const fit = () => { const k = Math.min(innerWidth / 1920, (innerHeight - 34) / 1080); stage.style.transform = `scale(${k})`; };
  addEventListener("resize", fit); fit();
  let playing = true, t = 0, last = performance.now();
  btn.onclick = () => { playing = !playing; btn.textContent = playing ? "暂停" : "播放"; };
  sc.oninput = () => { t = sc.value * DUR; setFrame(t); };
  const loop = (now) => { if (playing) { t = (t + (now - last) / 1000) % DUR; sc.value = t / DUR; setFrame(t); tv.textContent = t.toFixed(2); } last = now; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
window.ready = true;
