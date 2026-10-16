// 时间轴（第四稿，约 86 秒）：21 屏中英字幕 + 布景的先后。相邻布景重叠的那一段做墨晕开的转场。
// 只讲荔枝怎么送到长安；史实见《字幕-第四稿.md》的出处一栏，推算的部分字幕里明说“推算”。
export const DUR = 86.6;

// [开始, 结束, 中文, 英文, 选项]；parts：按逗号分几下出现（第 14 屏一处一处地加上去，给每一段出现的时刻）；poem：诗句用毛笔字
export const CAPS = [
  [0.5, 4.6, "荔枝一离枝，一日色变，二日香变，三日味变。", "Off the branch, a lychee loses its colour in a day, its scent in two, its taste in three."],
  [5.0, 8.0, "从岭南到长安，五千二百一十里。", "From Lingnan to Chang'an: five thousand two hundred and ten li."],
  [8.2, 11.2, "三天，五千里。", "Three days. Five thousand li."],
  [11.6, 14.4, "可长安城里，年年吃得上岭南的鲜荔枝。", "Yet Chang'an tasted fresh Lingnan lychees, year after year."],
  [14.8, 16.8, "史书只写了一句：", "History left a single line:"],
  [17.0, 21.0, "置骑传送，走数千里，味未变已至京师。", "Riders in relay, thousands of li — and the taste unchanged on arrival."],
  [21.4, 23.6, "怎么做到的？只能一步步推算。", "How? We can only reckon it out, step by step."],
  [23.8, 27.0, "天刚亮就摘，连枝带叶一起剪。", "Picked at dawn, cut with branch and leaf."],
  [27.4, 30.2, "封进竹筒，不透风，不见光。", "Sealed in bamboo — no air, no light."],
  [30.6, 33.2, "驿站门口，马早已备好。", "At the relay station, a fresh horse is waiting."],
  [33.4, 37.4, "三十里一驿。人换，马换，荔枝不停。", "A station every thirty li. Riders change, horses change — the lychees never stop."],
  [37.8, 40.6, "白天跑，夜里也跑。", "By day, and through the night."],
  [41.0, 49.6, "翻大庾岭，走张九龄开的那条山路。", "Over the Dayu Pass, on the road Zhang Jiuling cut through the mountains."],
  [50.0, 59.6, "下赣江，渡长江，上汉水，越秦岭。", "Down the Gan, across the Yangtze, up the Han, over the Qinling.", { parts: [50.0, 52.2, 54.6, 57.0] }],
  [59.8, 64.2, "照这样跑，十天上下，荔枝进了长安。", "At that pace, in about ten days, the lychees reached Chang'an."],
  [64.6, 68.0, "一路上跑死了多少马，没人算过。", "No one counted the horses that died on the way."],
  [68.2, 71.2, "而吃下它，只要一口。", "And it was gone in a single bite."],
  [71.6, 74.8, "长安回望绣成堆，", "Looking back at Chang'an, heaps of embroidery;", { poem: true }],
  [75.0, 78.2, "山顶千门次第开。", "on the summit, a thousand gates open one by one.", { poem: true }],
  [78.4, 81.6, "一骑红尘妃子笑，", "A rider in red dust — the Consort smiles;", { poem: true }],
  [81.8, 85.6, "无人知是荔枝来。", "no one knows it is the lychees coming.", { poem: true }],
];
export const POEM = [71.6, 85.6, "杜牧《过华清宫》", "Du Mu, Passing the Huaqing Palace"];

// 布景：[名字, 开始, 结束, 参数]；本段时间 = t - 开始
export const SEGS = [
  ["decay", 0, 5.0], ["map", 4.5, 11.6, "open"], ["plate", 11.2, 14.8], ["book", 14.4, 21.4], ["orchard", 21.0, 27.4], ["tube", 27.0, 30.6],
  ["station", 30.2, 37.8], ["ride", 37.4, 41.0], ["map", 40.6, 42.6, "dayu"], ["meiling", 42.2, 50.2],
  ["ganjiang", 49.8, 52.4], ["jiujiang", 52.0, 54.8], ["xiangyang", 54.4, 57.2], ["languan", 56.8, 59.8],
  ["map", 59.4, 64.6, "arrive"], ["fallen", 64.2, 68.2], ["peel", 67.8, 71.4], ["lishan", 71.0, DUR],
];
// 立体场景放映时，左上角的小地图上线头在哪（按路线长度的比例，由站名推出来）
export const MINI = { meiling: ["大庾岭", -0.004, 0.004], ganjiang: ["虔州", 0.0, 0.01], jiujiang: ["江州", 0.0, 0.006], xiangyang: ["襄州", -0.012, -0.004], languan: ["商州", 0.012, 0.025] };
