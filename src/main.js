// 长安的荔枝（2 分 24 秒，只放中英字幕）：按时间轴挑出当前的布景，相邻布景之间墨晕开转场；屏幕上一层 2D 画布放计数章、图例、百坛存一、保鲜刻度、年份章、片尾。
// 每一帧只由时间 t 决定：window.setFrame(t)。
import { renderFrame } from "./engine.js";
import { buildMap } from "./mapset.js";
import { buildRoad, buildCity, buildDoc, buildDecay, buildJar, buildGate, buildPeel, buildScale, buildOrchard } from "./vignettes.js";
import { CAPS, CREDIT, SEGS, DUR } from "./timeline.js";
import { brushText, rng } from "./art.js";

const RENDER = new URLSearchParams(location.search).has("render");
await Promise.all([document.fonts.load('40px "Brush"'), document.fonts.load('40px "SerifSC"'), document.fonts.load('italic 30px "Garamond"')]);
const status = (s) => { const el = document.getElementById("status"); if (el) el.textContent = s; };

status("画地图…");
const BUILD = { road: buildRoad, city: buildCity, doc: buildDoc, decay: buildDecay, jar: buildJar, gate: buildGate, peel: buildPeel, scale: buildScale, orchard: buildOrchard };
const cache = { map: buildMap() };
status("");
/** 布景按需创建；渲染模式下，接下来 3 秒都用不到的插画布景就释放掉（地图常驻），省内存 */
function getSet(name) { if (!cache[name]) cache[name] = BUILD[name](); return cache[name]; }
function release(t) {
  if (!RENDER) return;
  const soon = new Set(SEGS.filter(([, a, b]) => b > t - 0.05 && a < t + 3).map(([n]) => n));
  for (const name of Object.keys(cache)) {
    if (name === "map" || soon.has(name)) continue;
    cache[name].scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) for (const mm of Array.isArray(m) ? m : [m]) { for (const v of Object.values(mm.uniforms || {})) if (v && v.value && v.value.isTexture) v.value.dispose(); if (mm.map) mm.map.dispose(); mm.dispose(); } });
    delete cache[name];
  }
}
const sets = new Proxy({}, { get: (_, k) => getSet(k) });

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const CN = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一"];

// ───────── 屏幕层（2D）─────────
const hud = document.getElementById("hud"), h = hud.getContext("2d");
const stampBox = (x, y, w, hh, big, small, alpha = 1) => {
  if (alpha <= 0) return;
  h.save(); h.globalAlpha = alpha;
  h.fillStyle = "rgba(239,226,194,.9)"; h.strokeStyle = "#b8342a"; h.lineWidth = 4; h.shadowColor = "rgba(0,0,0,.25)"; h.shadowBlur = 12;
  h.beginPath(); h.roundRect(x, y, w, hh, 6); h.fill(); h.shadowBlur = 0; h.stroke();
  brushText(h, big, x + w / 2, y + hh * 0.42, 46, { color: "#b8342a" });
  h.font = 'italic 17px "Garamond"'; h.fillStyle = "rgba(150,40,32,.85)"; h.textAlign = "center"; h.fillText(small, x + w / 2, y + hh - 16);
  h.restore();
};
const jarIcon = (x, y, s, col) => { h.fillStyle = col; h.beginPath(); h.moveTo(x - 6 * s, y - 12 * s); h.lineTo(x + 6 * s, y - 12 * s); h.quadraticCurveTo(x + 12 * s, y - 6 * s, x + 10 * s, y + 6 * s); h.quadraticCurveTo(x + 8 * s, y + 13 * s, x, y + 13 * s); h.quadraticCurveTo(x - 8 * s, y + 13 * s, x - 10 * s, y + 6 * s); h.quadraticCurveTo(x - 12 * s, y - 6 * s, x - 6 * s, y - 12 * s); h.fill(); h.fillRect(x - 7 * s, y - 15 * s, 14 * s, 3.5 * s); };
const JAR_ORDER = (() => { const R = rng(17), a = Array.from({ length: 100 }, (_, i) => i).filter((i) => i !== 57); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; })();

function drawHud(t, info) {
  h.clearRect(0, 0, 1920, 1080);
  const cAlpha = (a, b) => Math.min(seg(t, a, a + 0.3), 1 - seg(t, b - 0.3, b));
  // 计数章（右上）
  if (info.counter) { const a = t < 52 ? cAlpha(46.0, 49.6) : cAlpha(80.2, 99.4); stampBox(1558, 56, 150, 108, `第${CN[info.day] ?? info.day}日`, `Day ${info.day}`, a); stampBox(1724, 56, 150, 108, `${info.li}里`, `${info.li.toLocaleString("en")} li`, a); }
  if (info.grid !== undefined) stampBox(1724, 56, 150, 108, `${Math.floor(info.grid)}格`, `${Math.floor(info.grid)} squares`, cAlpha(34.0, 37.8));
  if (info.yi !== undefined) stampBox(1690, 56, 184, 108, `驿${info.yi}所`, `${info.yi} stations`, cAlpha(41.6, 46.0));
  // 图例（左上）
  if (info.legend) {
    const a = cAlpha(80.2, 99.4); h.save(); h.globalAlpha = a; h.fillStyle = "rgba(239,226,194,.88)"; h.beginPath(); h.roundRect(56, 56, 250, 112, 6); h.fill(); h.strokeStyle = "rgba(43,34,25,.6)"; h.lineWidth = 2; h.stroke();
    h.strokeStyle = "#b8342a"; h.lineWidth = 7; h.lineCap = "round"; h.beginPath(); h.moveTo(80, 92); h.lineTo(150, 92); h.stroke();
    h.strokeStyle = "#3d6f8a"; h.setLineDash([14, 10]); h.beginPath(); h.moveTo(80, 136); h.lineTo(150, 136); h.stroke(); h.setLineDash([]);
    brushText(h, "陆路换马", 226, 92, 34, { color: "#2b2219" }); brushText(h, "水路登舟", 226, 136, 34, { color: "#2b2219" }); h.restore();
  }
  // 年份章（叛军那段）
  if (info.year) { const a = cAlpha(126.4, 130.8); h.save(); h.globalAlpha = a; h.fillStyle = "rgba(178,40,32,.9)"; h.fillRect(70, 60, 92, 330); brushText(h, info.year, 116, 108, 56, { vertical: true, color: "#f3e6c8" }); h.restore(); }
  // 百坛存一（第 27 句）
  if (t >= 104.6 && t < 108.2) {
    const a = cAlpha(104.7, 108.0), x0 = 1180, y0 = 210, gap = 54;
    h.save(); h.globalAlpha = a; h.fillStyle = "rgba(239,226,194,.9)"; h.beginPath(); h.roundRect(x0 - 50, y0 - 60, gap * 10 + 60, gap * 10 + 130, 8); h.fill(); h.strokeStyle = "rgba(43,34,25,.6)"; h.lineWidth = 2; h.stroke();
    const k = ease(seg(t, 105.1, 107.1)), nGrey = Math.floor(k * 99);
    const grey = new Set(JAR_ORDER.slice(0, nGrey));
    for (let i = 0; i < 100; i++) { const x = x0 + (i % 10) * gap, y = y0 + Math.floor(i / 10) * gap; if (i === 57 && k > 0.9) { h.fillStyle = `rgba(255,190,120,${0.5 * (k - 0.9) * 10})`; h.beginPath(); h.arc(x, y, 26, 0, Math.PI * 2); h.fill(); } jarIcon(x, y, 1.25, grey.has(i) ? "rgba(120,110,98,.55)" : "#b8342a"); }
    brushText(h, "百坛之中 只存其一", x0 + gap * 4.5, y0 + gap * 10 + 20, 40, { color: "#2b2219" });
    h.restore();
  }
  // 保鲜刻度（第 19 句）
  if (t >= 71.8 && t < 76.0) {
    const a = cAlpha(71.9, 75.8), x0 = 300, y0 = 470, wd = 1320, day = wd / 11;
    h.save(); h.globalAlpha = a; h.fillStyle = "rgba(239,226,194,.94)"; h.beginPath(); h.roundRect(x0 - 70, y0 - 150, wd + 140, 330, 10); h.fill(); h.strokeStyle = "rgba(43,34,25,.6)"; h.lineWidth = 2; h.stroke();
    h.strokeStyle = "#2b2219"; h.lineWidth = 3; h.beginPath(); h.moveTo(x0, y0 + 60); h.lineTo(x0 + wd, y0 + 60); h.stroke();
    for (let d = 0; d <= 11; d++) { h.beginPath(); h.moveTo(x0 + d * day, y0 + 52); h.lineTo(x0 + d * day, y0 + 74); h.stroke(); if (d) brushText(h, CN[d], x0 + d * day, y0 + 102, 30, { color: "#2b2219" }); }
    const k1 = easeOut(seg(t, 72.2, 73.4)), k2 = easeOut(seg(t, 73.6, 74.8));
    h.fillStyle = "rgba(120,110,98,.6)"; h.fillRect(x0, y0, 3 * day, 44); brushText(h, "离枝三日", x0 + 1.5 * day, y0 - 34, 34, { color: "#5a4e43" });
    h.fillStyle = "#b8342a"; h.fillRect(x0, y0, 7 * day * Math.max(3 / 7, k1), 44); if (k1 > 0.2) brushText(h, "分枝植瓮 · 撑到第七日", x0 + 3.5 * day, y0 - 80, 36, { color: "#b8342a", alpha: seg(k1, 0.2, 0.6) });
    if (k2 > 0) { h.fillStyle = "#3d6f8a"; h.fillRect(x0 + 7 * day, y0, 4 * day * k2, 44); brushText(h, "盐洗隔水 · 再续四日", x0 + 9 * day, y0 - 80, 36, { color: "#3d6f8a", alpha: seg(k2, 0.2, 0.6) }); }
    if (k2 > 0.95) { const ka = seg(t, 74.8, 75.2); h.save(); h.globalAlpha = a * ka; h.fillStyle = "rgba(178,40,32,.92)"; h.fillRect(x0 + wd + 20, y0 - 30, 100, 100); brushText(h, "十一", x0 + wd + 70, y0 + 6, 40, { color: "#f3e6c8" }); brushText(h, "日", x0 + wd + 70, y0 + 46, 36, { color: "#f3e6c8" }); h.restore(); }
    h.restore();
  }
  // 片尾
  if (t >= CREDIT[0]) {
    const a = Math.min(seg(t, CREDIT[0], CREDIT[0] + 0.6), 1 - seg(t, CREDIT[1] - 0.4, CREDIT[1] + 0.3));
    h.save(); h.globalAlpha = a; h.fillStyle = "rgba(20,12,6,.55)"; h.fillRect(0, 0, 1920, 1080);
    brushText(h, CREDIT[2], 960, 500, 64, { color: "#f3e6c8" });
    h.font = 'italic 34px "Garamond"'; h.fillStyle = "rgba(243,230,200,.85)"; h.textAlign = "center"; h.fillText(CREDIT[3], 960, 580); h.restore();
  }
}

// ───────── 字幕 ─────────
const capB = document.querySelector("#cap b"), capI = document.querySelector("#cap i"), capEl = document.getElementById("cap");
function captions(t) {
  const c = CAPS.find(([a, b]) => t >= a && t < b);
  if (c) { const kin = easeOut(seg(t, c[0], c[0] + 0.5)), kout = seg(t, c[1] - 0.3, c[1]); capB.textContent = c[2]; capI.textContent = c[3]; capEl.style.opacity = Math.min(kin, 1 - kout); capEl.style.transform = `translateY(${(1 - kin) * 10}px)`; capEl.style.filter = `blur(${(1 - kin) * 6 + kout * 4}px)`; }
  else capEl.style.opacity = 0;
}

// ───────── 每一帧 ─────────
export function setFrame(t) {
  const act = SEGS.filter(([, a, b]) => t >= a && t < b);
  if (!act.length) act.push(SEGS[SEGS.length - 1]);
  const [A, B] = act;
  let info = {};
  const ua = sets[A[0]].update(t); if (A[0] === "map") info = ua || {};
  let mix = 0;
  if (B) { const ub = sets[B[0]].update(t); if (B[0] === "map") info = ub || {}; mix = clamp((t - B[1]) / (A[2] - B[1])); }
  const fade = Math.max(1 - seg(t, 0, 0.6), seg(t, DUR - 0.8, DUR));
  release(t);
  renderFrame(sets[A[0]], B ? sets[B[0]] : null, mix, { time: t, fade });
  drawHud(t, info);
  captions(t);
  hud.style.opacity = 1 - fade; capEl.style.visibility = fade > 0.98 ? "hidden" : "visible";
}

window.DUR = DUR;
window.setFrame = (t) => { setFrame(t); return true; };
const stage = document.getElementById("stage");
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
