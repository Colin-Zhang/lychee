// 出封面：node tools/cover.mjs [3x4,9x16,4x3,16x9,16x6] → out/cover-<比例>.png（画法在 cover.html）
import puppeteer from "puppeteer-core";
import { serve } from "../serve.mjs";
const SIZES = { "9x16": [1080, 1920], "3x4": [1080, 1440], "4x3": [1440, 1080], "16x9": [1920, 1080], "16x6": [1920, 720] };
const list = (process.argv[2] || Object.keys(SIZES).join(",")).split(",");
const { srv, port } = await serve(0);
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/chromium-browser", headless: "new", args: ["--no-sandbox"], protocolTimeout: 900000 });
for (const r of list) {
  const [w, h] = SIZES[r], p = await b.newPage(); await p.setViewport({ width: w, height: h });
  p.on("pageerror", (e) => console.log("[pageerror]", e.message));
  await p.goto(`http://127.0.0.1:${port}/cover.html?r=${r}`, { timeout: 0 });
  await p.waitForFunction("window.ready === true || window.failed", { timeout: 900000, polling: 300 });
  if (await p.evaluate(() => window.failed)) { console.log(r, "failed:", await p.evaluate(() => String(window.failed))); continue; }
  const t0 = Date.now(); await p.evaluate(() => window.setFrame());
  await (await p.$("#c")).screenshot({ path: `out/cover-${r}.png` }); console.log(r, `${w}×${h}`, ((Date.now() - t0) / 1000).toFixed(1) + "s"); await p.close();
}
await b.close(); srv.close();
