// 第四稿的路线（地图像素坐标）：广州 → 韶州 → 大庾岭 → 大余 → 章水 → 虔州 → 赣江 → 江州 → 长江（上溯）→ 鄂州 → 汉水（上溯）→ 襄州 → 武关道 → 商州 → 蓝田 → 长安。
// 水路段直接沿用底图上画河的那条曲线（同样的分形、同样的种子），红线正好压在河上。
import { P, fractal } from "./map.js";
import { RIVERS } from "./geo.js";

const riverPx = (name) => { const ri = RIVERS.findIndex((r) => r[0] === name); return fractal(RIVERS[ri][2].map(([a, b]) => P(a, b)), 4, 0.35, 50 + ri); };
const nearest = (q, [x, y]) => { let bi = 0, bd = Infinity; q.forEach(([a, b], i) => { const d = (a - x) ** 2 + (b - y) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; };
const sub = (q, from, to) => { const i = nearest(q, P(...from)), j = nearest(q, P(...to)); return i <= j ? q.slice(i, j + 1) : q.slice(j, i + 1).reverse(); };

/** 沿途的地名（经纬度） */
export const STOPS = { 广州: [113.26, 23.13], 韶州: [113.6, 24.81], 大庾岭: [114.32, 25.3], 虔州: [114.93, 25.83], 洪州: [115.86, 28.68], 江州: [116.0, 29.71], 鄂州: [114.3, 30.6], 襄州: [112.14, 32.04], 武关: [110.7, 33.55], 商州: [109.94, 33.87], 长安: [108.94, 34.34] };

/** → { pts: [[x, y], …]（地图像素），kinds: 0 陆 / 1 水, at(名字) → 这一站在路线上的长度比例 } */
export function journey() {
  const land1 = fractal([[113.26, 23.13], [113.03, 23.7], [113.4, 24.18], [113.6, 24.81], [114.06, 24.95], [114.31, 25.12], [114.32, 25.3], [114.36, 25.4]].map(([a, b]) => P(a, b)), 3, 0.22, 71);
  const zhang = fractal([[114.36, 25.4], [114.62, 25.58], [114.93, 25.83]].map(([a, b]) => P(a, b)), 3, 0.3, 72);
  const gan = sub(riverPx("赣江"), [114.93, 25.83], [116.0, 29.7]);
  const jiang = sub(riverPx("长江"), [116.0, 29.7], [114.3, 30.6]);
  const han = sub(riverPx("汉水"), [114.3, 30.6], [112.14, 32.04]);
  const land2 = fractal([[112.14, 32.04], [112.09, 32.69], [111.84, 33.05], [110.7, 33.55], [109.94, 33.87], [109.32, 34.15], [108.94, 34.34]].map(([a, b]) => P(a, b)), 3, 0.22, 73);
  const pts = [], kinds = [];
  for (const [q, k] of [[land1, 0], [zhang, 1], [gan, 1], [jiang, 1], [han, 1], [land2, 0]]) q.forEach((p) => { pts.push(p); kinds.push(k); });
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  return { pts, kinds, length: L, at: (name) => cum[nearest(pts, P(...STOPS[name]))] / L };
}
