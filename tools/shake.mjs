// 量航拍镜头抖不抖：node tools/shake.mjs meiling,ganjiang（立体场景名，逗号隔开）
// 逐帧（30 帧/秒）取镜头朝向，算角速度；hf = 角速度去掉 9 帧滑动平均后的高频部分（°/s，越小越稳，0.5 以下看不出抖），amax = 最大角加速度（°/s²）
import puppeteer from "puppeteer-core";
import { serve } from "../serve.mjs";
const { srv, port } = await serve(0);
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/chromium-browser", headless: "new", args: ["--no-sandbox", "--ignore-gpu-blocklist", "--enable-webgl", ...(process.platform === "linux" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [])], protocolTimeout: 900000 });
const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1080 });
p.on("pageerror", (e) => console.log("[pageerror]", e.message));
for (const scene of (process.argv[2] || "meiling").split(",")) {
  await p.goto(`http://127.0.0.1:${port}/special-test.html?scene=${scene}&dem=3`, { timeout: 0 });
  await p.waitForFunction("window.ready === true || window.failed", { timeout: 900000, polling: 500 });
  const r = await p.evaluate(() => {
    const st = window.__st, cam = st.camera, f = [];
    for (let i = 0; i <= Math.round(st.DUR * 30); i++) { st.shot(i / 30); cam.updateMatrixWorld(); const e = cam.matrixWorld.elements; f.push([-e[8], -e[9], -e[10]]); }
    const ang = (a, b) => (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180) / Math.PI;
    const w = []; for (let i = 1; i < f.length; i++) w.push(ang(f[i - 1], f[i]) * 30);
    const acc = []; for (let i = 1; i < w.length; i++) acc.push(Math.abs(w[i] - w[i - 1]) * 30);
    const hf = w.map((v, i) => { const lo = w.slice(Math.max(0, i - 4), i + 5); return v - lo.reduce((a, b) => a + b, 0) / lo.length; }).slice(6, -6);
    return { dur: st.DUR, hf: Math.sqrt(hf.reduce((q, v) => q + v * v, 0) / hf.length).toFixed(2), amax: Math.max(...acc.slice(6, -6)).toFixed(0), wmax: Math.max(...w).toFixed(1) };
  });
  console.log(scene, JSON.stringify(r));
}
await b.close(); srv.close();
