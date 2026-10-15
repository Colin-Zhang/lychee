// 调试：打开页面，打印所有控制台输出和错误，等布景画完（或超时），报告用时和内存
import puppeteer from "puppeteer-core";
import { serve } from "./serve.mjs";
const { srv, port } = await serve(0);
const b = await puppeteer.launch({ executablePath: "/usr/bin/chromium-browser", headless: "new", args: ["--no-sandbox", "--ignore-gpu-blocklist", "--enable-webgl", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"], protocolTimeout: 900000 });
const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1080 });
const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(1);
p.on("console", (m) => { if (!/404/.test(m.text())) console.log(T(), "[console]", m.type(), m.text().slice(0, 300)); });
p.on("pageerror", (e) => console.log(T(), "[pageerror]", e.message));
p.on("error", (e) => console.log(T(), "[crash]", e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?render=1${process.env.LITE ? "&ky=150&res=0.5" : ""}`, { timeout: 0 });
for (let i = 0; i < 120; i++) { const st = await p.evaluate(() => [window.ready === true, document.getElementById("status")?.textContent]).catch((e) => [false, "eval failed: " + e.message]); if (st[0]) { console.log(T(), "ready"); break; } if (i % 5 === 0) console.log(T(), "status:", st[1]); await new Promise((r) => setTimeout(r, 3000)); }
const times = (process.argv[2] || "").split(",").filter(Boolean).map(Number);
for (const t of times) { const a = Date.now(); await p.evaluate((t) => window.setFrame(t), t); await p.screenshot({ path: `out/dbg-${t}.jpg`, type: "jpeg", quality: 88 }); console.log(T(), `frame ${t} in ${((Date.now() - a) / 1000).toFixed(2)}s`); }
await b.close(); srv.close();
