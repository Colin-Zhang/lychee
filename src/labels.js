// 画面最上面的一层 2D 画布：地名标签（古名 + 今天的地方）和红线的线头（一颗荔枝 + 插针 + 地上一圈圈散开的红晕）。
// 三维里的点每帧投影到屏幕再画，字和线头不会随远近变糊、变小。
import * as THREE from "three";
import { W, H } from "./engine.js";
import { lycheeArt, mk } from "./art.js";

/** 古名 → 今天的地方 */
export const PLACES = {
  浈昌县: "今广东南雄", 大庾岭: "今江西大余、广东南雄交界", 大庾县: "今江西大余", 章水: "今章江，下游汇入赣江",
  广州: "今广东广州", 韶州: "今广东韶关", 虔州: "今江西赣州", 洪州: "今江西南昌", 江州: "今江西九江", 鄂州: "今湖北武汉",
  襄州: "今湖北襄阳", 武关: "今陕西丹凤", 商州: "今陕西商洛", 长安: "今陕西西安",
};

const INKC = "#231a12", PAPERC = "rgba(242,231,201,.96)";
function headIcon(age = 0) {
  const c = mk(160, 160), g = c.getContext("2d");
  const gr = g.createRadialGradient(80, 84, 8, 80, 84, 76); gr.addColorStop(0, "rgba(255,246,222,.95)"); gr.addColorStop(0.55, "rgba(255,240,210,.55)"); gr.addColorStop(1, "rgba(255,240,210,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 160, 160);
  lycheeArt(g, 80, 90, 34, { ripe: 1, age, seed: 7, leaf: true, stem: true });
  return c;
}

export class Overlay {
  constructor(parent) {
    this.c = document.createElement("canvas"); this.c.width = W; this.c.height = H;
    Object.assign(this.c.style, { position: "absolute", left: "0", top: "0", width: `${W}px`, height: `${H}px`, pointerEvents: "none" });
    parent.appendChild(this.c); this.g = this.c.getContext("2d"); this.icon = headIcon();
  }
  clear() { this.g.clearRect(0, 0, W, H); this.flip = !this.flip; this.g.fillStyle = "rgba(0,0,0,0.004)"; this.g.fillRect(this.flip ? 0 : 1, 0, 1, 1); }   // 永远留一个看不见的点（浏览器截图不沿用旧帧）
  /** 三维点 → 屏幕像素；在镜头后面返回 null */
  static screen(v, camera) {
    const p = v.clone().applyMatrix4(camera.matrixWorldInverse); if (p.z > -1) return null;
    const n = v.clone().project(camera); return [(n.x + 1) * 0.5 * W, (1 - n.y) * 0.5 * H];
  }
  /** 地名：锚点 (x, y) 一个墨点，竖一根细线上去，上面古名（毛笔）+ 今地名（宋体小字） */
  label(name, x, y, { a = 1, lead = 70, modern = PLACES[name], rise = 0, side = 1 } = {}) {
    if (a <= 0.01) return;
    const g = this.g;
    // 靠边时自动换方向：字会出上边就挂到点的下面，会出左右边就换到另一侧
    g.font = '60px "Brush"'; const w1 = g.measureText(name).width; g.font = '30px "NotoSerif"'; const w2 = modern ? g.measureText(modern).width : 0, tw = Math.max(w1, w2) + 20;
    if (side > 0 && x + tw > W - 20) side = -1; else if (side < 0 && x - tw < 20) side = 1;
    if (y - lead - rise - 96 < 16) lead = -(Math.abs(lead) * 0.6 + 96);
    const top = y - lead - rise, tx = x + side * 12;
    g.save(); g.globalAlpha = a; g.lineCap = "round";
    g.strokeStyle = PAPERC; g.lineWidth = 5; g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x, top); g.stroke();
    g.strokeStyle = "rgba(35,26,18,.9)"; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x, top); g.stroke();
    g.fillStyle = PAPERC; g.beginPath(); g.arc(x, y, 6.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#b8342a"; g.beginPath(); g.arc(x, y, 4.2, 0, Math.PI * 2); g.fill();
    g.textAlign = side > 0 ? "left" : "right"; g.textBaseline = "alphabetic";
    const t1 = () => { g.font = '60px "Brush"'; }, t2 = () => { g.font = '30px "NotoSerif", "SerifSC"'; };
    // 先画一层淡绢色的晕，字压在上面，什么底色上都看得清
    g.shadowColor = PAPERC; g.shadowBlur = 16; g.fillStyle = PAPERC;
    for (let k = 0; k < 2; k++) { t1(); g.fillText(name, tx, top - 36); if (modern) { t2(); g.fillText(modern, tx + side * 2, top + 1); } }
    g.shadowBlur = 0; g.fillStyle = INKC; t1(); g.fillText(name, tx, top - 36);
    if (modern) { t2(); g.fillStyle = "rgba(35,26,18,.92)"; g.fillText(modern, tx + side * 2, top + 1); }
    g.restore();
  }
  /** 只写今地名（古地图上已经画了古名的城，旁边补一行小字） */
  modern(text, x, y, { a = 1, dx = 16, dy = 34 } = {}) {
    if (a <= 0.01 || !text) return;
    const g = this.g; g.save(); g.globalAlpha = a; g.font = '27px "NotoSerif"'; g.textAlign = "left"; g.textBaseline = "middle";
    g.shadowColor = PAPERC; g.shadowBlur = 12; g.fillStyle = PAPERC; g.fillText(text, x + dx, y + dy); g.fillText(text, x + dx, y + dy);
    g.shadowBlur = 0; g.fillStyle = "rgba(35,26,18,.9)"; g.fillText(text, x + dx, y + dy);
    g.fillStyle = "#b8342a"; g.fillRect(x + dx - 9, y + dy - 1.5, 5, 3);
    g.restore();
  }
  /** 线头：地上的红晕（按视角压扁成椭圆）+ 插针 + 一颗荔枝。flat：0 侧看 → 1 正上方看；dim：被山挡住时变淡 */
  /** gap：针从离地多高（像素）开始画——骑手 / 船在线头上时，针让开人马，只在头顶上方 */
  head(x, y, t, { a = 1, flat = 0.5, dim = false, size = 56, stem = 30, rot = 0, gap = 0 } = {}) {
    if (a <= 0.01) return;
    const g = this.g; g.save(); g.globalAlpha = a * (dim ? 0.5 : 1);
    for (let k = 0; k < 2; k++) {
      const ph = (t * 0.85 + k * 0.5) % 1, r = 9 + ph * 40;
      g.strokeStyle = `rgba(214,58,38,${((1 - ph) * 0.85).toFixed(3)})`; g.lineWidth = 3.4 - ph * 2; g.beginPath(); g.ellipse(x, y, r, Math.max(2, r * flat), 0, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = "rgba(210,58,38,.9)"; g.beginPath(); g.ellipse(x, y, 4.5, Math.max(1.8, 4.5 * flat), 0, 0, Math.PI * 2); g.fill();
    const y0 = y - Math.min(gap, stem - 8);
    g.strokeStyle = PAPERC; g.lineWidth = 4.5; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y - stem); g.stroke();
    g.strokeStyle = "rgba(43,26,18,.92)"; g.lineWidth = 2; if (dim) g.setLineDash([4, 4]); g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y - stem); g.stroke(); g.setLineDash([]);
    const s = size * (1 + 0.05 * Math.sin(t * 6) * (1 - rot));
    if (rot > 0) { if (!this.rotIcon) this.rotIcon = headIcon(3); g.drawImage(this.icon, x - s * 0.5, y - stem - s * 0.82, s, s); g.globalAlpha = a * rot; g.drawImage(this.rotIcon, x - s * 0.5, y - stem - s * 0.82, s, s); }
    else g.drawImage(this.icon, x - s * 0.5, y - stem - s * 0.82, s, s);
    g.restore();
  }
}
