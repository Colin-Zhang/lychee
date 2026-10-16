// 渲几张静帧：node stills.mjs 1,3,5 [--page=index.html] [--lite] [--q=dem=3]（文件名 out/<页面名>-<时间>.jpg）
import puppeteer from "puppeteer-core";
import { serve } from "./serve.mjs";
const { srv, port } = await serve(0);
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/chromium-browser", headless: "new", args: ["--no-sandbox", "--ignore-gpu-blocklist", "--enable-webgl", ...(process.platform === "linux" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [])], protocolTimeout: 900000 });
const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1080 });
p.on("pageerror", (e) => console.log("[pageerror]", e.message)); p.on("console", (m) => { if (m.type() === "error" && !/404/.test(m.text())) console.log("[console]", m.text().slice(0, 200)); else if (m.type() === "log") console.log("[log]", m.text().slice(0, 200)); });
const extra = process.argv.find((a) => a.startsWith("--q="))?.slice(4) || "";
const lite = (process.argv.includes("--lite") ? "?ky=150&res=0.5" : "?x=1") + (extra ? "&" + extra : "");
const t0 = Date.now();
const page = process.argv.find((a) => a.startsWith("--page="))?.slice(7) || "index.html", tag = page.replace(/-test.html$|.html$/, "");
await p.goto(`http://127.0.0.1:${port}/${page}${lite}`, { timeout: 0 });
await p.waitForFunction("window.ready === true || window.failed", { timeout: 900000, polling: 1000 });
if (await p.evaluate(() => window.failed)) { console.log("page failed:", await p.evaluate(() => String(window.failed))); process.exit(1); }
console.log("ready", ((Date.now() - t0) / 1000).toFixed(1), "s");
for (const t of process.argv[2].split(",").map(Number)) { const a = Date.now(); await p.evaluate((t) => window.setFrame(t), t); await p.screenshot({ path: `out/${tag === "flight" ? "fl" : tag}-${t}.jpg`, type: "jpeg", quality: 88 }); console.log(`t=${t} ${((Date.now() - a) / 1000).toFixed(2)}s`); }
await b.close(); srv.close();
