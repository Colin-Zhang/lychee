// 马（剪影，侧面朝右）：按真实的袭步（gallop）画——四蹄依次落地（右后、左后、右前、左前），然后四蹄腾空收在肚子下面；
// 落地时身子往下压、前蹄着地时头低下去，腾空时身子抬起来；鬃毛和尾巴顺风飘。骑手俯身、踩着马镫，背上一捆红布扎口的竹筒，后面拖一条红绸。
// 单位：马的“格”，地面 y=0，往上为负；鬐甲（肩顶）高约 108 格，鼻尖到尾根约 190 格。
import { smooth, stroke, fillPath } from "./art.js";

const lerp = (a, b, k) => a + (b - a) * k, clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const eio = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const rot = ([x, y], a, [cx, cy]) => { const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; };

const STANCE = 0.36;   // 每条腿着地占一个周期的比例
// 一条腿在周期里的姿势：a 大腿 / 前臂的摆角（0 = 竖直向下，正 = 往前），flex 关节弯曲
function leg(u, front) {
  if (u < STANCE) { const k = u / STANCE; return { a: lerp(0.44, -0.66, k), flex: (front ? 0.1 : 0.16) * Math.sin(Math.PI * k) }; }
  const v = (u - STANCE) / (1 - STANCE);
  return { a: -0.66 + 1.18 * eio(v) - 0.08 * ss(0.82, 1, v), flex: (front ? 1.55 : 1.15) * Math.sin(Math.PI * Math.min(1, v * 1.12)) };
}
// 一条腿的关节位置（马身坐标，原点在肚子正中）：返回 [髋 / 肩, 膝 / 飞节, 球节, 蹄]
const HIPS = { RH: [-48, -16], LH: [-46, -14], RF: [42, -12], LF: [44, -10] };
function legChain(hip, l, front, pitch, stand) {
  const a = l.a + pitch, f = l.flex, L1 = front ? 36 : 38, L2 = front ? 30 : 34, L3 = 10;
  let a1 = front ? a : a - 0.28, a2 = front ? a - f : a + 0.42 + f * 0.8, a3 = front ? a2 + 0.5 + f * 0.25 : a2 + 0.45;
  if (stand) { a1 = front ? a : a - 0.25; a2 = front ? a - f : a + 0.32; a3 = a2 + 0.35; }
  const K = [hip[0] + Math.sin(a1) * L1, hip[1] + Math.cos(a1) * L1], F = [K[0] + Math.sin(a2) * L2, K[1] + Math.cos(a2) * L2], H = [F[0] + Math.sin(a3) * L3, F[1] + Math.cos(a3) * L3];
  return { K, F, H, a3 };
}
// 落地：着地的那几条腿，蹄子正好踩在地上（身子跟着一起一伏）；四蹄腾空时比前后两次着地都高一点
const SHIFT = (() => {
  const n = 96, raw = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const pose = horsePose(i / n), base = -60 + pose.bob; let low = null;
    for (const k of Object.keys(HIPS)) { const u = ((i / n - { RH: 0, LH: 0.1, RF: 0.27, LF: 0.37 }[k]) % 1 + 1) % 1; if (u >= STANCE) continue; const hip = rot([HIPS[k][0], HIPS[k][1] + base], pose.pitch, [0, base]); const c = legChain(hip, pose.legs[k], k.endsWith("F"), pose.pitch, false); low = Math.max(low ?? -1e9, c.H[1] + 3.6); }
    raw[i] = low == null ? null : -low;
  }
  // 腾空的那几帧：在前后两次着地之间插值，再抬高一点
  for (let i = 0; i < n; i++) if (raw[i] == null) { let a = i, b = i; while (raw[(a - 1 + n) % n] == null) a--; while (raw[(b + 1) % n] == null) b++; const ia = (a - 1 + n) % n, ib = (b + 1) % n, k = (i - a + 1) / (b - a + 2); raw[i] = lerp(raw[ia], raw[ib], k) - 7 * Math.sin(Math.PI * k); }
  const sm = raw.map((_, i) => (raw[(i - 1 + n) % n] + 2 * raw[i] + raw[(i + 1) % n]) / 4);
  return (p) => { const f = (((p % 1) + 1) % 1) * n, i = Math.floor(f), k = f - i; return lerp(sm[i % n], sm[(i + 1) % n], k); };
})();
/** 袭步姿势（phase 0–1）。stand = true 时是站着的马 */
export function horsePose(phase, { stand = false } = {}) {
  const p = ((phase % 1) + 1) % 1;
  if (stand) return { bob: 0, pitch: 0, neck: 0.05, legs: { RH: { a: -0.05, flex: 0.04 }, LH: { a: 0.08, flex: 0.06 }, RF: { a: 0.04, flex: 0.02 }, LF: { a: -0.04, flex: 0.03 } }, stand: true, p };
  const off = { RH: 0.0, LH: 0.1, RF: 0.27, LF: 0.37 };
  const legs = {}; for (const [k, o] of Object.entries(off)) legs[k] = leg((p - o + 1) % 1, k.endsWith("F"));
  const susp = ss(0.72, 0.8, p) * (1 - ss(0.94, 1.0, p));                         // 四蹄腾空
  return { bob: -7 * susp + 3 * Math.sin(2 * Math.PI * (p - 0.2)), pitch: 0.05 * Math.sin(2 * Math.PI * (p - 0.12)), neck: 0.14 * Math.sin(2 * Math.PI * (p - 0.33)), legs, p };
}

// 身体轮廓（静止时，原点在肚子正中、离地 60 格；往上为负）
const BODY = [[-66, -30], [-55, -40], [-30, -38], [-6, -33], [16, -37], [30, -44], [40, -46]];      // 尾根 → 臀 → 背 → 鬐甲
const NECK_TOP = [[48, -55], [60, -72], [72, -90], [80, -101]];                                     // 鬃线 → 项
const HEAD = [[84, -108], [87, -104], [94, -98], [106, -84], [114, -72], [113, -65], [104, -62], [96, -67], [88, -74]];   // 耳 → 额 → 鼻 → 嘴 → 下颌
const NECK_BOT = [[74, -70], [64, -52], [60, -30], [57, -14]];                                      // 喉 → 胸
const BELLY = [[48, -2], [26, 5], [-6, 7], [-30, 4], [-46, 0], [-60, -8], [-69, -20]];               // 胸底 → 肚 → 后膝 → 臀

/** 画一匹马。x, y：地面上马身正中的位置；s：缩放；pose：horsePose()；color：近侧，far：远侧的腿 */
export function drawHorse(g, x, y, s, pose, { color = "#1a1410", far = "#3a3028", rim = "rgba(255,206,150,.55)", saddle = "#6e3a24" } = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const dy = pose.stand ? 0 : SHIFT(pose.p), base = [0, -60 + pose.bob + dy], P = (pt) => rot([pt[0] + base[0], pt[1] + base[1]], pose.pitch, [base[0], base[1]]);
  const pivot = [48, -40], neckPts = (arr) => arr.map((p) => rot(p, pose.neck * 0.9, pivot));
  const outline = [...BODY, ...neckPts(NECK_TOP), ...neckPts(HEAD), ...neckPts(NECK_BOT), ...BELLY].map(P);
  const L = (hip, l, front, col, w) => {
    // 一条腿：前腿 前臂→膝→管→球节→蹄；后腿 胫→飞节→管→球节→蹄（飞节朝后）
    const H = P(hip), { K, F, H: Hf, a3 } = legChain(H, l, front, pose.pitch, pose.stand);
    g.fillStyle = col;
    stroke(g, [H, K], 15 * w, 8 * w, col); stroke(g, [K, F], 7 * w, 5.5 * w, col); stroke(g, [F, Hf], 6 * w, 6 * w, col);
    g.beginPath(); g.arc(K[0], K[1], 4.5 * w, 0, Math.PI * 2); g.fill();                         // 膝 / 飞节
    g.beginPath(); g.ellipse(Hf[0] + 2, Hf[1] + 1, 6.5 * w, 3.6 * w, a3 * 0.6, 0, Math.PI * 2); g.fill();   // 蹄
  };
  // 远侧两条腿（淡一点）→ 尾巴 → 身体 → 近侧两条腿
  L(HIPS.RH, pose.legs.RH, false, far, 0.95); L(HIPS.RF, pose.legs.RF, true, far, 0.95);
  const tw = pose.stand ? 0 : Math.sin(pose.p * Math.PI * 2 + 1.2);
  const tail = [[-64, -32], [-80, -36 + tw * 2], [-98, -32 + tw * 5], [-116, -24 + tw * 8], [-130, -14 + tw * 10]].map((p, i) => (pose.stand ? [p[0] + i * 6, p[1] + i * i * 3.5] : p)).map(P);
  for (let k = 0; k < 5; k++) stroke(g, smooth(tail.map(([tx, ty], i) => [tx, ty + (k - 2) * i * 1.4]), 6), 9 - k, 1.2, color);
  if (rim) { g.save(); g.translate(-1.6, -1.8); fillPath(g, smooth(outline, 4, true), rim); g.restore(); }
  fillPath(g, smooth(outline, 4, true), color);
  // 鬃毛：顺着脖子往后飘
  const crest = neckPts(NECK_TOP).map(P);
  for (let i = 0; i < 10; i++) {
    const k = i / 9, j = Math.min(2, Math.floor(k * 2.999)), f = k * 3 - j, cx = lerp(crest[j][0], crest[j + 1][0], f), cy = lerp(crest[j][1], crest[j + 1][1], f), wv = Math.sin(pose.p * Math.PI * 4 + i * 0.8) * 2;
    stroke(g, smooth([[cx + 2, cy + 1], [cx - 8, cy - 2 + wv * 0.5], [cx - 18, cy + 1 + wv], [cx - 26, cy + 6 + wv * 1.3]], 4), 5.5, 0.8, color);
  }
  L(HIPS.LH, pose.legs.LH, false, color, 1); L(HIPS.LF, pose.legs.LF, true, color, 1);
  // 鞍
  if (saddle) { const S1 = P([-12, -36]), S2 = P([14, -38]); g.fillStyle = saddle; g.beginPath(); g.moveTo(S1[0], S1[1]); g.quadraticCurveTo((S1[0] + S2[0]) / 2, Math.min(S1[1], S2[1]) - 10, S2[0], S2[1]); g.lineTo(S2[0] - 2, S2[1] + 8); g.lineTo(S1[0] + 2, S1[1] + 8); g.closePath(); g.fill(); }
  const eye = P(rot([92, -94], pose.neck * 0.9, pivot)); g.fillStyle = "rgba(255,220,180,.35)"; g.beginPath(); g.arc(eye[0], eye[1], 1.6, 0, Math.PI * 2); g.fill();
  g.restore();
  return { saddle: [x + P([0, -40])[0] * s, y + P([0, -40])[1] * s], reins: [x + P(rot([84, -80], pose.neck * 0.9, pivot))[0] * s, y + P(rot([84, -80], pose.neck * 0.9, pivot))[1] * s] };
}

/** 骑手 + 马（袭步）。和旧的 riderArt 一样的参数：x, y 是地面上马的正中，s 是缩放（240 格 ≈ 画布宽） */
export function drawRider(g, x, y, s, phase, { color = "#1a1410", far = "#3a3028", accent = "#b8342a", robe = "#2a2018", cargo = "tube", rim = "rgba(255,206,150,.5)" } = {}) {
  const pose = horsePose(phase), k = s * 0.95;
  const info = drawHorse(g, x, y, k, pose, { color, far, rim });
  g.save(); g.translate(info.saddle[0], info.saddle[1]); g.scale(k, k);
  const sway = Math.sin(phase * Math.PI * 4) * 1.5, lean = 0.62 + 0.05 * Math.sin(phase * Math.PI * 2);
  // 腿：大腿往前、小腿往下踩镫
  stroke(g, [[0, -4], [16, 6], [10, 26]], 10, 7, color); fillPath(g, [[6, 26], [16, 26], [16, 29], [5, 29]], color);
  // 袍子下摆往后飘
  const fl = Math.sin(phase * Math.PI * 4 + 0.6) * 3;
  fillPath(g, smooth([[4, -8], [-14, -6 + fl * 0.4], [-28, 2 + fl], [-18, 8], [2, 4]], 4, true), robe);
  // 身子前倾、头、幞头
  const hip = [0, -6], sh = [hip[0] + Math.sin(lean) * 34, hip[1] - Math.cos(lean) * 34 + sway * 0.3];
  stroke(g, [hip, sh], 15, 12, color);
  const head = [sh[0] + Math.sin(lean - 0.2) * 12, sh[1] - Math.cos(lean - 0.2) * 12];
  g.fillStyle = color; g.beginPath(); g.arc(head[0], head[1], 7.5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(head[0] - 1, head[1] - 5, 8.5, 4.8, -0.3, Math.PI, Math.PI * 2.05); g.fill();
  const ws = Math.sin(phase * Math.PI * 4) * 3;
  stroke(g, smooth([[head[0] - 7, head[1] - 3], [head[0] - 18, head[1] - 6 + ws], [head[0] - 28, head[1] - 2 + ws * 1.4]], 4), 2.6, 1, color);   // 幞头的脚
  // 手臂往前握缰绳
  const rx = (info.reins[0] - info.saddle[0]) / k, ry = (info.reins[1] - info.saddle[1]) / k;
  stroke(g, [sh, [sh[0] + 12, sh[1] + 10], [rx - 6, ry + 2]], 6, 4, color);
  g.strokeStyle = "rgba(26,20,16,.75)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(rx - 6, ry + 2); g.quadraticCurveTo((rx + sh[0]) / 2, ry + 10, rx, ry); g.stroke();
  // 背上的竹筒（红布扎口、朱红封泥）和红绸
  if (cargo === "tube") {
    const back = [hip[0] + Math.sin(lean) * 14 - 10, hip[1] - Math.cos(lean) * 14 - 4], ax = Math.sin(lean - 0.25), ay = -Math.cos(lean - 0.25);
    for (let i = 0; i < 3; i++) { const o = (i - 1) * 5, p0 = [back[0] - ax * 18 - ay * o * 0.3, back[1] - ay * 18 + o], p1 = [back[0] + ax * 20 - ay * o * 0.3, back[1] + ay * 20 + o]; stroke(g, [p0, p1], 6, 6, i === 1 ? "#b3a865" : "#9d9452"); g.fillStyle = accent; g.beginPath(); g.arc(p1[0], p1[1], 3.3, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = accent; g.save(); g.translate(back[0], back[1]); g.rotate(lean - 0.25 + Math.PI / 2); g.fillRect(-3, -9, 6, 18); g.restore();
    const top = [back[0] + ax * 20, back[1] + ay * 20], f2 = Math.sin(phase * Math.PI * 4 + 1) * 4;
    stroke(g, smooth([top, [top[0] - 16, top[1] - 4 + f2], [top[0] - 34, top[1] + 2 + f2 * 1.4], [top[0] - 54, top[1] - 2 + f2 * 2]], 6), 4.5, 1.2, accent);
  }
  g.restore();
}

/** 站着的马（备好鞍），没有骑手 */
export function drawStandHorse(g, x, y, s, { color = "#1a1410", far = "#3a3028", rim = "rgba(255,206,150,.45)", t = 0 } = {}) {
  const pose = horsePose(0, { stand: true }); pose.neck = 0.05 + 0.03 * Math.sin(t * 1.3); pose.p = t * 0.15;
  return drawHorse(g, x, y, s, pose, { color, far, rim });
}

/** 倒在路边的马（侧卧）：身子贴着地、脖子顺着地面伸出去、头侧放在地上、眼睛闭着；四条腿僵直地伸向镜头这边；尾巴软软地拖在地上；鞍还在（荔枝已经被下一匹马带走了）。
 *  x, y：地面上马身正中；s：缩放（和 drawHorse 同一套格子）；breath：0–1 最后一点起伏（默认不动） */
const DOWN = [
  [-66, -24], [-56, -34], [-32, -33], [-6, -30], [18, -33], [34, -38], [46, -39],                 // 尾根 → 臀 → 背 → 鬐甲
  [60, -36], [76, -31], [90, -27], [100, -25],                                                     // 鬃线顺着地面往前低下去 → 项
  [106, -26], [116, -22], [128, -16], [137, -11], [143, -8], [147, -3], [146, 3], [140, 6],          // 额 → 鼻梁 → 鼻头（钝）→ 嘴
  [132, 6], [122, 7], [112, 8], [104, 6], [100, 1], [94, 2],                                       // 下巴 → 圆圆的腮 → 喉
  [78, 4], [60, 7],                                                                                  // 脖子底 → 胸
  [40, 10], [18, 13], [-8, 13], [-32, 11], [-48, 6], [-60, -2], [-68, -12],                         // 肚子贴地、鼓着 → 后膝 → 臀
];
export function drawFallenHorse(g, x, y, s, { color = "#1a1410", far = "#3a3028", rim = "rgba(255,206,150,.45)", saddle = "#6e3a24", breath = 0 } = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const outline = DOWN.map(([px, py]) => [px, py < 0 ? py * (1 + breath * 0.03) : py]);
  // 一条伸直的腿：起点 → 关节 → 球节 → 蹄（角度 0 = 朝下，正 = 朝前），长度和跑马一样
  const L = (o, a1, a2, a3, front, col, w) => {
    const L1 = front ? 34 : 34, L2 = front ? 28 : 30, L3 = 10;
    const K = [o[0] + Math.sin(a1) * L1, o[1] + Math.cos(a1) * L1], F = [K[0] + Math.sin(a2) * L2, K[1] + Math.cos(a2) * L2], Hf = [F[0] + Math.sin(a3) * L3, F[1] + Math.cos(a3) * L3];
    g.fillStyle = col;
    stroke(g, [o, K], 13 * w, 7.5 * w, col); stroke(g, [K, F], 6.5 * w, 5.5 * w, col); stroke(g, [F, Hf], 6 * w, 6 * w, col);
    g.beginPath(); g.arc(K[0], K[1], 4.5 * w, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(Hf[0] + Math.sin(a3) * 3, Hf[1] + Math.cos(a3) * 2, 6.5 * w, 3.8 * w, Math.PI / 2 - a3, 0, Math.PI * 2); g.fill();
  };
  // 地上一片淡影 → 远侧两条腿（淡）→ 尾巴 → 身子 → 鬃 → 近侧两条腿
  { const sh = g.createRadialGradient(10, 14, 6, 10, 14, 150); sh.addColorStop(0, "rgba(30,22,16,.32)"); sh.addColorStop(1, "rgba(30,22,16,0)"); g.save(); g.scale(1, 0.16); g.fillStyle = sh; g.beginPath(); g.arc(10, 14 / 0.16, 150, 0, Math.PI * 2); g.fill(); g.restore(); }
  L([-54, 0], 0.1, 0.72, 1.15, false, far, 0.95); L([38, 4], 0.9, 0.82, 1.25, true, far, 0.95);
  const tail = [[-65, -22], [-78, -14], [-92, -5], [-108, 1], [-126, 4], [-142, 5]];
  for (let k = 0; k < 5; k++) stroke(g, smooth(tail.map(([tx, ty], i) => [tx - i * k * 0.5, ty + (k - 2) * i * 0.7]), 6), 9 - k, 1.4, color);
  if (rim) { g.save(); g.translate(-1.4, -1.8); fillPath(g, smooth(outline, 4, true), rim); g.restore(); }
  fillPath(g, smooth(outline, 4, true), color);
  // 耳朵顺着脖子往后倒；鬃毛不再飘，几缕软软地搭在脖子上
  fillPath(g, smooth([[105, -25], [97, -31], [84, -37], [91, -29], [99, -23]], 3, true), color);
  for (let i = 0; i < 5; i++) { const k = i / 4, cx = lerp(52, 92, k), cy = lerp(-38.5, -27, k) - 0.5; stroke(g, smooth([[cx + 2, cy + 1], [cx - 6, cy - 2.5], [cx - 14, cy - 1.5], [cx - 20, cy + 2]], 4), 3.6, 0.7, color); }
  L([-40, 6], 0.4, 1.0, 1.35, false, color, 1); L([48, 7], 1.05, 0.95, 1.4, true, color, 1);
  if (saddle) { const S1 = [-14, -31], S2 = [12, -32]; g.fillStyle = saddle; g.beginPath(); g.moveTo(S1[0], S1[1]); g.quadraticCurveTo((S1[0] + S2[0]) / 2, Math.min(S1[1], S2[1]) - 10, S2[0], S2[1]); g.lineTo(S2[0] - 2, S2[1] + 8); g.lineTo(S1[0] + 2, S1[1] + 8); g.closePath(); g.fill(); }
  // 闭着的眼：一道细弧
  g.strokeStyle = "rgba(255,220,180,.45)"; g.lineWidth = 1; g.beginPath(); g.arc(116, -14, 2.4, 0.25, Math.PI - 0.25); g.stroke();
  g.restore();
}
