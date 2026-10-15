import puppeteer from "puppeteer-core";
import { serve } from "./serve.mjs";
const { srv, port } = await serve(0);
const b = await puppeteer.launch({ executablePath: "/usr/bin/chromium-browser", headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1080 });
p.on("pageerror", (e) => console.error(e.message));
const t0 = Date.now();
await p.goto(`http://127.0.0.1:${port}/map-test.html`); await p.waitForFunction("window.ready === true", { timeout: 180000 });
console.log("底图画完", (Date.now() - t0) / 1000, "秒");
const shots = [["full", null], ["meiguan", [114.3, 25.6, 0.85]], ["yangtze", [112.6, 30.3, 0.6]]];
for (const [name, v] of shots) {
  await p.evaluate((v) => { if (!v) { const z = Math.min(1920 / window.MW, 1080 / window.MH); return window.view(window.MW / 2, window.MH / 2, z); } const [x, y] = window.P(v[0], v[1]); return window.view(x, y, v[2]); }, v);
  await p.screenshot({ path: `out/map-${name}.jpg`, type: "jpeg", quality: 90 });
}
await b.close(); srv.close();
