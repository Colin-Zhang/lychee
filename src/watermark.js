// 账号水印（右上角，全片常驻）：和片子一个调子——字幕那套思源宋体，暖白字压一层柔影（亮的绢面、暗的夜景上都看得清），
// 右边一方朱红小印“钳沿”（和古地图题签上的印同一种），不用频道其他片子那种青绿圆体。
import { seal } from "./art.js";

let SEAL = null;
/** g：2D 画布；W：画面宽；a：整体不透明度 */
export function drawWatermark(g, W, { a = 1 } = {}) {
  if (!SEAL) SEAL = seal("钳沿", 160, { white: true });
  const s = 40, x1 = W - 38, cy = 50;   // 小印的右边、竖直中心
  g.save(); g.globalAlpha = a * 0.92;
  g.shadowColor = "rgba(20,10,4,.45)"; g.shadowBlur = 6; g.drawImage(SEAL, x1 - s, cy - s / 2, s, s);
  g.font = '700 27px "SerifSC"'; g.letterSpacing = "2px"; g.textAlign = "right"; g.textBaseline = "middle";
  g.shadowColor = "rgba(20,10,4,.75)"; g.shadowBlur = 10; g.shadowOffsetY = 1;
  g.fillStyle = "rgba(248,240,222,.94)"; g.fillText("@钳沿AI实验室", x1 - s - 12, cy + 1);
  g.restore();
}
