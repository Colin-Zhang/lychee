// 逐帧渲染：node render.mjs [--fps 30] [--from 0] [--to 10] [--out out/lychee.mp4] [--every 1]
//   --every 10  每 10 帧取一帧（快速看效果）；--frames-only 只出 jpg 不合成视频
//   Chrome 路径：环境变量 CHROME_PATH；不设就按系统找常见位置（Windows 的 Chrome / Edge、macOS、Linux）
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { serve } from "./serve.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const FPS = Number(arg("fps", 30)), FROM = Number(arg("from", 0)), EVERY = Number(arg("every", 1));
const OUT = arg("out", "out/lychee.mp4"), FRAMES_ONLY = process.argv.includes("--frames-only");
// --lite：低配检查（地图、插画分辨率减半），只用来看构图和时间，不是成片画质
const LITE = process.argv.includes("--lite") ? "&ky=150&res=0.5" : "";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium", "/snap/bin/chromium",
].filter(Boolean);
const chrome = CANDIDATES.find((p) => existsSync(p));
if (!chrome) { console.error("找不到 Chrome / Edge，设一下 CHROME_PATH"); process.exit(1); }

const { srv, port } = await serve(0);
// 有显卡就用显卡；Linux 服务器没显卡时走 SwiftShader 软件渲染（慢一些，但画面一样）
const args = ["--no-sandbox", "--ignore-gpu-blocklist", "--enable-webgl", "--hide-scrollbars"];
if (process.platform === "linux" && !process.env.USE_GPU) args.push("--use-angle=swiftshader", "--enable-unsafe-swiftshader");
const browser = await puppeteer.launch({ executablePath: chrome, headless: "new", args, protocolTimeout: 1800000 });
const page = await browser.newPage();
page.on("console", (m) => { if (m.type() === "error") console.error("[page]", m.text()); });
page.on("pageerror", (e) => console.error("[page error]", e.message));
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${port}/index.html?render=1${LITE}`, { waitUntil: "load", timeout: 0 });
const tl = Date.now(); await page.waitForFunction("window.ready === true", { timeout: 1800000, polling: 1000 }); console.log(`布景画完，用时 ${((Date.now() - tl) / 1000).toFixed(0)} 秒`);
await page.evaluate(() => document.fonts.ready);
const DUR = await page.evaluate(() => window.DUR);
const TO = Number(arg("to", DUR));

const dir = join("out", "frames"); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const n0 = Math.round(FROM * FPS), n1 = Math.round(TO * FPS);
const t0 = Date.now(); let k = 0;
for (let n = n0; n < n1; n += EVERY) {
  await page.evaluate((t) => window.setFrame(t), n / FPS);
  await page.screenshot({ path: join(dir, `f${String(k++).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  if (k % 30 === 0) { const per = (Date.now() - t0) / k / 1000; console.log(`${k}/${Math.ceil((n1 - n0) / EVERY)} 帧 · 每帧 ${per.toFixed(2)} 秒 · 还要约 ${Math.round((per * ((n1 - n0) / EVERY - k)) / 60)} 分钟`); }
}
await browser.close(); srv.close();
console.log(`出了 ${k} 帧，用时 ${((Date.now() - t0) / 1000).toFixed(0)} 秒 → ${dir}`);
if (!FRAMES_ONLY) {
  mkdirSync("out", { recursive: true });
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-framerate", String(FPS / EVERY), "-i", join(dir, "f%05d.jpg"), "-c:v", "libx264", "-crf", "17", "-preset", "slow", "-pix_fmt", "yuv420p", OUT], { stdio: "inherit" });
  if (r.status === 0) console.log("视频 →", OUT); else console.error("ffmpeg 合成失败（装了 ffmpeg 吗？），帧在", dir);
}
