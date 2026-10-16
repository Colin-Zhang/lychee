#!/usr/bin/env python3
"""把 tools/landmap.mjs 输出的 out/_land-<场景>.json 画成俯视图 out/_landmap-<场景>.jpg：晕渲、小河（蓝）、大水面（深蓝）、山路（红，每公里刻度和海拔）、航线（橙，每公里刻度和水面高）"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); name = sys.argv[1] if len(sys.argv) > 1 else "meiling"
d = json.load(open(os.path.join(root, "out", f"_land-{name}.json"))); nx, nz, x0, z0, dd = d["nx"], d["nz"], d["x0"], d["z0"], d["d"]
h = np.array(d["h"], np.float32).reshape(nz, nx)
gy, gx = np.gradient(h, dd); sl = np.arctan(np.hypot(gx, gy) * 1.2); asp = np.arctan2(-gx, gy); az, alt = math.radians(315), math.radians(45)
sh = np.sin(alt) * np.cos(sl) + np.cos(alt) * np.sin(sl) * np.cos(az - asp); t = (h - h.min()) / (h.max() - h.min() + 1e-6)
rgb = np.stack([0.6 + 0.4 * t, 0.65 + 0.25 * t, 0.5 + 0.2 * t], -1) * (0.35 + 0.65 * np.clip(sh, 0, 1))[..., None]
if d["waterY"] is not None: rgb[h < d["waterY"]] = [0.2, 0.35, 0.6]
S = 2 if max(nx, nz) < 800 else 1; im = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).resize((nx * S, nz * S)); dr = ImageDraw.Draw(im)
P = lambda x, z: ((x - x0) / dd * S, (z - z0) / dd * S)
for r in d["rivers"]: dr.line([P(*p) for p in r["pts"]], fill=(60, 110, 200), width=max(1, int(r["w"] / 60) + 1))
if d["boat"]:
    dr.line([P(*p) for p in d["boat"]], fill=(255, 150, 0), width=3)
    for k in range(0, len(d["boat"]), int(1000 / 8)): x, y = P(*d["boat"][k]); dr.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(255, 220, 120)); dr.text((x + 5, y - 6), f"{k * 8 / 1000:.0f}k {d['boatY'][k]}m", fill=(60, 30, 0))
if d["road"]:
    dr.line([P(*p) for p in d["road"]], fill=(220, 30, 30), width=3)
    for k in range(0, len(d["road"]), int(1000 / 6)): x, y = P(*d["road"][k]); dr.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(255, 255, 255)); dr.text((x + 6, y - 6), f"{k * 6 / 1000:.0f}k {d['roadH'][k]}m", fill=(0, 0, 0))
    x, y = P(*d["road"][d["top"]]); dr.ellipse([x - 7, y - 7, x + 7, y + 7], outline=(0, 0, 0), width=3); dr.text((x + 9, y + 2), "TOP", fill=(0, 0, 0))
im.thumbnail((1100, 1100)); im.save(os.path.join(root, "out", f"_landmap-{name}.jpg"), quality=85); print(name, im.size)
