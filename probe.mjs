// 探针：打开页面 25 秒，打印加载失败的文件、页面里的报错、当前状态
import puppeteer from "puppeteer-core";
import { serve } from "./serve.mjs";
const { srv, port } = await serve(0);
const b = await puppeteer.launch({ executablePath: "/usr/bin/chromium-browser", headless: "new", args: ["--no-sandbox", "--ignore-gpu-blocklist", "--enable-webgl", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"], protocolTimeout: 300000 });
const p = await b.newPage();
await p.evaluateOnNewDocument(() => { window.__errs = []; addEventListener("error", (e) => window.__errs.push("error: " + (e.message || e.target?.src || e.target?.href)), true); addEventListener("unhandledrejection", (e) => window.__errs.push("reject: " + (e.reason?.stack || e.reason))); });
p.on("requestfailed", (r) => console.log("failed:", r.url()));
p.on("response", (r) => { if (r.status() >= 400) console.log("HTTP", r.status(), r.url()); });
p.on("console", (m) => console.log("[console]", m.type(), m.text().slice(0, 300)));
p.on("pageerror", (e) => console.log("[pageerror]", e.message));
await p.goto(`http://127.0.0.1:${port}/index.html?render=1`, { timeout: 0 });
await new Promise((r) => setTimeout(r, Number(process.argv[2] || 25000)));
console.log(await p.evaluate(() => JSON.stringify({ errs: window.__errs, status: document.getElementById("status")?.textContent, ready: window.ready, res: performance.getEntriesByType("resource").map((e) => e.name.split("/").slice(-2).join("/")) }, null, 1)));
await b.close(); srv.close();
