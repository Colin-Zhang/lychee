#!/usr/bin/env python3
"""真实地形（高程）下载：AWS Terrain Tiles（Terrarium 编码，SRTM 等公开数据）→ 拼接、裁剪 → data/<名字>.bin（Int16 米，小端）+ .json
用法：python3 tools/dem.py dayu 114.15 25.10 114.50 25.48 13 [--shade]
  经度、纬度范围（西 南 东 北），缩放级别（13 ≈ 17 米一格，12 ≈ 35 米，11 ≈ 70 米）；--shade 另存一张晕渲图看地形
数据说明：https://registry.opendata.aws/terrain-tiles/ （公开数据，可自由使用）"""
import sys, os, math, json, io, urllib.request
import numpy as np
from PIL import Image

name, lon0, lat0, lon1, lat1, z = sys.argv[1], *map(float, sys.argv[2:6]), int(sys.argv[6])
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
cache = os.path.join(root, ".dem-cache"); os.makedirs(cache, exist_ok=True)
n = 2 ** z
def px(lon, lat):
    r = math.radians(lat)
    return (lon + 180) / 360 * n * 256, (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n * 256
x0, y0 = px(lon0, lat1); x1, y1 = px(lon1, lat0)
tx0, ty0, tx1, ty1 = int(x0 // 256), int(y0 // 256), int(x1 // 256), int(y1 // 256)
W, H = (tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256
big = np.zeros((H, W), np.float32)
for ty in range(ty0, ty1 + 1):
    for tx in range(tx0, tx1 + 1):
        f = os.path.join(cache, f"{z}-{tx}-{ty}.png")
        if not os.path.exists(f):
            with urllib.request.urlopen(f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{tx}/{ty}.png", timeout=60) as r: open(f, "wb").write(r.read())
        im = np.asarray(Image.open(f).convert("RGB")).astype(np.float32)
        big[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = im[..., 0] * 256 + im[..., 1] + im[..., 2] / 256 - 32768
ox, oy = int(round(x0 - tx0 * 256)), int(round(y0 - ty0 * 256)); w, h = int(round(x1 - x0)), int(round(y1 - y0))
dem = big[oy:oy + h, ox:ox + w].copy()
# 清理：数据里偶尔有孤立的尖刺和坑（几十个像素，-983 米、3895 米这种），和周围 3×3 的中值差太多就换成中值；再把极少数过低的点抬到 0.1% 分位
for _ in range(3):
    pad = np.pad(dem, 1, mode="edge"); stack = np.stack([pad[1 + dy:1 + dy + h, 1 + dx:1 + dx + w] for dy in (-1, 0, 1) for dx in (-1, 0, 1)]); med = np.median(stack, axis=0); del stack
    bad = np.abs(dem - med) > 80; dem[bad] = med[bad]
dem = np.maximum(dem, np.percentile(dem, 0.1) - 2)
mpp = 156543.03392 * math.cos(math.radians((lat0 + lat1) / 2)) / n
os.makedirs(os.path.join(root, "data"), exist_ok=True)
np.round(dem).astype("<i2").tofile(os.path.join(root, "data", f"{name}.bin"))
meta = dict(name=name, w=w, h=h, m=mpp, z=z, lon0=lon0, lat0=lat0, lon1=lon1, lat1=lat1, ox=x0, oy=y0, min=float(dem.min()), max=float(dem.max()), src="AWS Terrain Tiles (Terrarium), SRTM etc.")
json.dump(meta, open(os.path.join(root, "data", f"{name}.json"), "w"), ensure_ascii=False, indent=1)
print(json.dumps(meta, ensure_ascii=False))
if "--shade" in sys.argv:
    gy, gx = np.gradient(dem, mpp); az, alt = math.radians(315), math.radians(45)
    sl = np.arctan(np.hypot(gx, gy) * 1.5); asp = np.arctan2(-gx, gy)
    sh = np.sin(alt) * np.cos(sl) + np.cos(alt) * np.sin(sl) * np.cos(az - asp)
    t = (dem - dem.min()) / (dem.max() - dem.min() + 1e-6)
    rgb = np.stack([0.55 + 0.45 * t, 0.62 + 0.25 * t, 0.45 + 0.2 * t], -1) * (0.35 + 0.65 * np.clip(sh, 0, 1))[..., None]
    rgb[dem < 1] = [0.3, 0.45, 0.6]
    Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).save(os.path.join(root, "out", f"dem-{name}.jpg"), quality=88)
