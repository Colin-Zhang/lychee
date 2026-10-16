// 立体场景的俯视检查：node tools/landmap.mjs <场景名> [stride] → out/_land-<场景>.json；再 python3 tools/landmap.py <场景名> 画成 out/_landmap-<场景>.jpg
// （晕渲 + 河 + 大水面 + 山路（每公里一个刻度、标海拔）+ 航线），挑镜头位置用。场景名见 src/places.js
import fs from "fs";
import { loadDEM } from "../src/dem.js";
import { buildLand } from "../src/land.js";
import { PLACE_CFG } from "../src/places.js";
const name = process.argv[2] || "meiling", cfg = { ...PLACE_CFG[name], stride: Number(process.argv[3] || 3) };
const rd = (f) => fs.readFileSync(new URL("../" + f.replace(/^\.\//, ""), import.meta.url));
const t0 = Date.now();
const L = buildLand(await loadDEM(cfg.dem, { read: rd }), await loadDEM(cfg.far, { read: rd }), cfg);
const { F, RV, road, roadH, sTop, boat2, boatY, top, port, V, waterY, slope } = L;
const R = (v) => Math.round(v);
fs.writeFileSync(new URL(`../out/_land-${name}.json`, import.meta.url), JSON.stringify({ nx: F.nx, nz: F.nz, x0: F.x0, z0: F.z0, d: F.d, V, waterY, h: Array.from(F.h, R),
  rivers: RV.map((r) => ({ pts: r.pts.filter((_, i) => i % 2 === 0).map(([x, z]) => [R(x), R(z)]), w: R(Math.max(...r.ws)) })),
  road: road ? road.map(([x, z]) => [R(x), R(z)]) : null, roadH: roadH ? Array.from(roadH, (v) => R(v / V)) : null, sTop, top, boat: boat2 ? boat2.map(([x, z]) => [R(x), R(z)]) : null, boatY: boatY ? Array.from(boatY, (v) => R(v / V)) : null, port, slope: slope ? { reach: slope.reach } : null }));
console.log(name, "grid", F.nx, "x", F.nz, "d", F.d.toFixed(0), "build", Date.now() - t0, "ms");
if (road) console.log(" road", road.length * 6, "m; top", R(roadH[top] / V), "m at s", sTop, "start", R(roadH[0] / V), "end", R(roadH[roadH.length - 1] / V));
if (boat2) console.log(" boat", R(boat2.length * 8), "m; water", R(boatY[0] / V), "→", R(boatY[boatY.length - 1] / V), "m");
