// 立体场景的地面配置（真实地形）：用哪块高程、裁哪一块、路线怎么走。纯数据，浏览器和 node 共用。
// 地名标签的今地名见 labels.js 的 PLACES。
export const PLACE_CFG = {
  // 翻大庾岭：南雄盆地（珠玑巷）→ 岭上最低的垭口 → 大余（大庾县）章水边上船
  meiling: { dem: "dayu", far: "dayu-far", center: [114.34, 25.3], crop: [114.22, 25.14, 114.48, 25.46], boat: { from: [114.36, 25.4], minKm2: 50, len: 9000 }, road: { from: [114.37, 25.19], to: "boat", portW: 95 } },
  // 下赣江：赣州（虔州）章水、贡水汇成赣江，往北顺流而下
  ganjiang: { dem: "ganjiang", far: "ganjiang-far", center: [114.9, 25.98], crop: [114.74, 25.8, 115.06, 26.18], boat: { from: [114.935, 25.857], len: 32000, wide: { reach: 1400, lift: 0.5 } } },
  // 渡长江：江州（九江）城下，船上长江往西（上游）走，南边是庐山
  jiujiang: { dem: "jiujiang", far: "jiujiang-far", center: [115.98, 29.66], crop: [115.74, 29.47, 116.26, 29.85], water: { level: 10.3 }, rivers: { minKm2: 6 }, boat: { via: [[116.12, 29.79], [116.05, 29.752], [115.99, 29.73], [115.93, 29.722], [115.87, 29.735], [115.81, 29.765], [115.76, 29.8]], snap: 900 } },
  // 上汉水：从南边逆流而上，到襄州（襄阳）城下
  xiangyang: { dem: "xiangyang", far: "xiangyang-far", center: [112.16, 31.98], crop: [112.02, 31.82, 112.32, 32.12], boat: { from: [112.14, 32.05], skip: 9500, len: 17000, dir: "up", wide: { reach: 1500, lift: 1.6 } } },
  // 越秦岭：从牧护关一带往西北翻过秦岭，下到蓝田（蓝关古道一线）
  languan: { dem: "languan", far: "qinling-far", center: [109.48, 34.06], crop: [109.26, 33.9, 109.72, 34.21], road: { from: [109.62, 33.965], to: [109.33, 34.14], slopeK: 24, maxGrade: 0.14 } },
  // 片尾：骊山脚下，一骑从西边（长安方向）奔向华清宫
  lishan: { dem: "lishan", far: "qinling-far", center: [109.17, 34.36], crop: [108.99, 34.23, 109.41, 34.49], road: { from: [109.03, 34.372], to: [109.205, 34.364] } },
};
