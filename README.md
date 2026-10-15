# 长安的荔枝：荔枝从岭南运到长安（2 分 24 秒，只放中英字幕，不配 BGM）

按马伯庸小说《长安的荔枝》的情节讲（字幕全是自己的话，对着原书核过事实，见 `字幕-第三稿.md`；第 33 句按史实改成“弃城西逃”：贵妃死在马嵬驿，没有入蜀）。
画面全部用代码画（原创示意）：一张仿宋代石刻地图“计里画方”的古地图是主舞台，加上开场山水、长安城坊图、公文、荔枝三日变色、双层瓮剖面图（天工开物式）、春明门、剥开的荔枝、天平、荔枝园几场插画；人物只出剪影。three.js 逐帧渲染，镜头斜着贴近地图飞。

## 跑起来

需要 Node 18+、Chrome / Edge、ffmpeg（在 PATH 里）。

```bash
npm install
npm run preview                 # 浏览器打开 http://localhost:5173/index.html（第一次要等十几秒画地图），底部进度条可拖
npm run render                  # 逐帧渲染 → out/lychee.mp4（1920×1080，30 帧，约 4320 帧）
node render.mjs --every 30 --frames-only        # 每秒一帧，快速看效果（out/frames）
node render.mjs --from 76 --to 100 --out out/上路.mp4   # 只渲一段
node debug.mjs 31,58,85.5       # 打开页面，打印报错，截这几个时刻的画面到 out/dbg-*.jpg
```
没有 BGM：成片是无声的，传抖音时在 App 里自己配乐。

**文件大小**：默认码率封顶 8Mbps，整片约 140MB；想更小加 `--maxrate 5M`（约 90MB）。已经渲好的大文件不用重渲，直接再压一遍：
`ffmpeg -i out/lychee.mp4 -c:v libx264 -preset slow -crf 21 -maxrate 8M -bufsize 16M -pix_fmt yuv420p -movflags +faststart out/lychee-抖音.mp4`。
渲完以后 `out/frames`（几千张 jpg，一两个 G）可以删掉。

## 代码

| 文件 | 内容 |
| --- | --- |
| `src/timeline.js` | 35 句字幕（中英）+ 片尾；布景的先后（相邻重叠处墨晕开转场） |
| `src/main.js` | 总控：挑布景、转场、屏幕层（计数章、图例、百坛存一、保鲜刻度、年份章、片尾）、字幕 |
| `src/engine.js` | three.js 渲染器、合成（移轴景深、墨晕开转场、暖调、暗角、胶片颗粒）、平面布景工具 |
| `src/map.js` / `src/geo.js` | 古地图的画法（青绿山峦、双线长江黄河、驿道、城郭、题记、图名、印章、折痕）和地理数据（海岸、江河、山脉、城、路线、驿道、四条试走的路、叛军、西逃） |
| `src/mapset.js` | 地图布景：四块底图、镜头、所有叙事标记（起止印、预览线、逐格点亮、三道天险、天下驿站、三日红线、南下、四条路、上路的马 / 船 / 挑夫、地名朱圈、第 N 日签、压暗、贬回岭南、叛军与西逃、最后亮线） |
| `src/inkline.js` | 地图上会“画出来”的墨线、驿站点 |
| `src/vignettes.js` / `src/scenes2d.js` / `src/art.js` | 插画布景、插画画法、画笔和小剪影（马、船、挑夫、人物、骆驼、荔枝、树） |

改了字幕、地名或题记里的字，跑一次 `tools-subset.sh` 重新裁剪字体（需要 fonttools 和原字体文件，说明在脚本开头）。字体都是 OFL 开源授权（思源宋体、马善政体、Cormorant Garamond），许可证在 `fonts/`。
