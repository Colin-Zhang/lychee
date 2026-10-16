# 荔枝怎么送到长安（第四稿，约 87 秒，只放中英字幕，不配 BGM）

只讲一件事：一颗荔枝，怎么从岭南新鲜地送到长安。史书只留下“置骑传送，走数千里，味未变已至京师”一句，其余一步步推算；诗只在最后（杜牧《过华清宫》）。字幕和出处见 `字幕-第四稿.md`。

画面三种：
- **古地图（2D）**：只有一根朱红路线——走过的实线，没走到的虚线；线头是一颗插在细针上的荔枝；经过的城旁边补一行“今……”。第 2–3 屏（五千二百一十里；常人马行日七十里，三天只走得出二百一十里，荔枝坏了）、第 13 屏开头、第 15 屏（第十日到长安）。
- **特殊场景（立体）**：真实地形（SRTM 高程，竖向夸张 1.35 倍）画成青绿山水，一个不切的航拍镜头跟着线头走，左上角小地图告诉观众走到哪了。翻大庾岭（第 13 屏）；下赣江（虔州）、渡长江（江州，背后是庐山）、上汉水（襄州）、越秦岭（第 14 屏，字幕一处一处加上去）；片尾骊山黄昏，山上的灯一盏盏亮起，一骑红尘奔向山脚（第 18–21 屏）。
- **插画（剪影）**：荔枝三日变色、长安的一盘荔枝、《新唐书·后妃传》的一页（朱笔圈点那一句）、天亮前后的荔枝园和剪枝、封竹筒、驿站交接、日夜奔跑、倒下的马、剥开的荔枝。

## 渲染

需要 Node 18+、Chrome / Edge、ffmpeg（在 PATH 里）。

```bash
npm install
node render.mjs                                  # 整片 → out/lychee.mp4（1920×1080，30 帧，约 2600 帧）
node render.mjs --q ss=2                         # 立体场景两倍超采样（更细，立体那几段慢 3–4 倍）
node render.mjs --every 30 --frames-only         # 每秒一帧，先看联系表（out/frames）
node render.mjs --from 42 --to 60 --out out/路上.mp4   # 只渲一段（第 13–14 屏）
npm run preview                                  # 浏览器里看 http://localhost:5173/index.html，底部进度条可拖
```
第一次打开要先画古地图、读地形，一两分钟。码率封顶 8Mbps；想更小加 `--maxrate 5M`。渲完 `out/frames` 可以删。
服务器上只做低配检查：`node render.mjs --lite --q dem=3`（地图和插画分辨率减半，地形粗一倍）。

单独看某一段：
```bash
node stills.mjs 2,5 --page=special-test.html --q="scene=meiling"      # 立体场景：meiling / ganjiang / jiujiang / xiangyang / languan / lishan（本段时间）
node stills.mjs 1.5,4 --page=vignette-test.html --q="v=orchard"      # 插画：decay / plate / book / orchard / tube / station / ride / fallen / peel
node stills.mjs 3.6 --page=map2d-test.html --lite                    # 古地图红线
node stills.mjs 0 --page=horse-test.html                             # 马：16 帧袭步 + 站着的马（加 --q="fallen=1" 看倒在路边的马）
node tools/shake.mjs meiling,ganjiang                                # 量航拍镜头抖不抖（hf 越小越稳，0.5 以下看不出）
```

## 代码

| 文件 | 内容 |
| --- | --- |
| `src/timeline.js` | 21 屏中英字幕和每段布景的起止，相邻重叠处转场（墨晕开 / 穿云 / 叠化，按段指定）；小地图上线头的位置 |
| `src/main.js` | 总控：按时间挑布景、转场、标签层、计数章、小地图、诗的出处、字幕 |
| `src/engine.js` | three.js 渲染器、合成（景深、转场：墨晕开 / 穿云（飞过一团云雾到下一处）/ 叠化，暖调、暗角、颗粒、渐黑） |
| `src/mapset4.js` / `src/journey.js` / `src/map.js` / `src/geo.js` | 古地图布景（三段）、第四稿的路线、古地图的画法和地理数据 |
| `src/route3d.js` | 加粗的路线（屏幕上按像素算粗细；走过实线、没走到虚线、被山挡住的半透明；线头发亮）——地图和立体场景共用 |
| `src/labels.js` | 最上层的 2D 画布：地名标签（古名 + 今地名）、荔枝线头 |
| `src/scene3d.js` / `src/scenes3d.js` / `src/places.js` | 立体场景：通用的搭法（地形、水、树、红线、骑手 / 船、镜头关键帧）、六个场景各自的天光镜头标签、地面配置 |
| `src/land.js` / `src/dem.js` / `src/landform.js` | 真实地形、水系（填洼、汇流、出河道；宽河顺着水势的水面）、按坡度找山路、平滑——纯 JS，node 里也能跑 |
| `src/shanshui.js` | 青绿山水的三维画法：地形着色、河、大水面、天、石板路、一株株画出来的树、人马剪影卡片、尘土、乌篷船、按深度勾墨线的后期 |
| `src/vignettes4.js` / `src/scenes2d.js` / `src/art.js` | 插画布景、插画画法、画笔和剪影（船夫摇橹、荔枝……） |
| `src/horse.js` | 马：按真实袭步画的 16 帧（四蹄依次落地、身子起伏、鬃尾顺风）+ 背竹筒的骑手、站着备鞍的马、倒在路边的马——插画和立体场景共用 |
| `data/`、`tools/dem.py` | 真实高程（大庾岭 17 米一格，其余 32–35 米一格，外围 130 米一格）和下载脚本；数据来自 AWS Terrain Tiles（SRTM 等公开数据），下载时清掉了零星的尖刺和坑 |
| `tools/landmap.mjs` + `tools/landmap.py` | 立体场景的俯视检查图（路、河、大水面、每公里刻度），挑镜头位置用 |

改了字幕或标签里的字，跑一次 `tools-subset.sh` 重新裁剪字体（需要 fonttools 和原字体文件，说明在脚本开头）。字体都是 OFL 开源授权（思源宋体、马善政体、Cormorant Garamond），许可证在 `fonts/`。

更早的版本（按小说讲的 2 分 24 秒版、`字幕-第一稿` / `第三稿`）在 git 历史里。
