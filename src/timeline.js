// 时间轴：字幕（第三稿，对着原书核过；第 33 句按史实改成“弃城西逃”）与布景的先后。相邻布景重叠的那一段就是墨晕开的转场。
export const DUR = 144;

export const CAPS = [
  [0.5, 4.8, "一骑红尘妃子笑，无人知是荔枝来。", "A lone rider in red dust, and the Consort smiles — none know it is the lychees coming."],
  [5.0, 8.2, "千年以降，世人只记住了这一笑。", "For a thousand years, the world remembered only the smile."],
  [8.4, 12.0, "却无人追问：这荔枝，从何而来？", "Yet few ever asked: where did the lychees come from?"],
  [12.9, 15.5, "天宝十四载，长安。", "Chang'an. The fourteenth year of Tianbao."],
  [16.0, 19.2, "上林署小吏李善德，接下一道差事。", "Li Shande, a minor clerk of the imperial gardens, receives an order."],
  [19.4, 22.8, "六月初一贵妃诞辰，要吃上岭南的鲜荔枝。", "By the Consort's birthday, the first of the sixth month — fresh lychees from Lingnan."],
  [23.1, 26.1, "若离本枝，一日而色变，", "Once off the branch, its colour fades in a day,"],
  [26.3, 29.6, "二日而香变，三日而味变。", "its scent in two, its taste in three."],
  [30.2, 33.8, "岭南距长安，五千四百四十七里。", "From Lingnan to Chang'an: five thousand four hundred and forty-seven li."],
  [34.0, 37.6, "画方百里。五千多里，便是五十四格还多。", "Each square, a hundred li. Fifty-four squares, and more."],
  [37.8, 41.4, "需翻五岭，渡长江，再越秦岭。", "Over the Five Ridges, across the Yangtze, beyond the Qinling."],
  [41.6, 45.8, "凡三十里一驿，天下凡一千六百三十有九所。", "A relay station every thirty li — one thousand six hundred and thirty-nine in all."],
  [46.0, 49.4, "纵快马日夜兼程，三日，绝无可能。", "Ride day and night — three days is still impossible."],
  [49.6, 52.4, "这是一道无解的局。", "An equation no one could solve."],
  [52.6, 56.4, "李善德远赴岭南，在从化的荔枝园里百般试验。", "Li went south, to the orchards of Conghua, and tried again and again."],
  [57.2, 60.8, "截下挂果的枝杈，插进双层瓮的水土里。", "Fruit-laden boughs, cut and planted in double jars of soil and water."],
  [61.0, 64.2, "专挑半青的果子，让它在路上慢慢熟。", "Picked half-green, left to ripen on the road."],
  [64.4, 68.2, "枝条枯了，就摘果盐洗，封进隔水的瓮中。", "When the boughs wither, the fruit is brine-washed and sealed in water-jacketed jars."],
  [68.4, 71.6, "过了长江，再从江陵的冰窖调冰。", "Past the Yangtze, ice is drawn from the cellars of Jiangling."],
  [71.8, 75.6, "几种办法接力，三日之限，被拉到了十一日。", "Method upon method, the three-day limit stretched to eleven."],
  [76.4, 80.0, "他试了四条路，最后定下一条。", "He tested four routes, and chose one."],
  [80.2, 83.4, "逢水登舟，水尽换马。", "Boats where rivers flow; horses where the water ends."],
  [83.6, 87.2, "大庾岭的山路，由人背着瓮翻过去。", "Over the Dayu ridge, men carried the jars on their backs."],
  [87.4, 91.8, "梅关、吉州、潭州、洞庭、汉水、商州……", "Meiguan, Jizhou, Tanzhou, Dongting, the Han, Shangzhou…"],
  [92.0, 95.4, "一驿接一驿，人可倒，荔枝不可停。", "Relay after relay — men may fall; the lychees may not stop."],
  [95.6, 99.2, "十一日，五千四百四十七里。", "Eleven days. Five thousand four hundred and forty-seven li."],
  [100.0, 104.0, "六月初一，只有一骑、两坛，冲进了春明门。", "On the first of the sixth month, one rider and two jars reached the Chunming Gate."],
  [104.6, 107.8, "九成九的荔枝，坏在了路上。", "Ninety-nine in a hundred spoiled on the way."],
  [108.4, 110.8, "她尝了一颗，笑了。", "She tasted one, and smiled."],
  [111.2, 114.4, "算下来，一枚荔枝，比一头骆驼还贵。", "Reckoned out, each lychee cost more than a camel."],
  [115.0, 118.4, "从化的三十亩荔枝园，为这两坛，毁了两年。", "Thirty mu of orchards in Conghua, ruined for two years, for two jars."],
  [119.0, 122.2, "李善德顶撞了右相，回到岭南，做了荔枝农。", "Li defied the chancellor, and went back south to farm lychees."],
  [122.8, 125.8, "他在那片园子里，补种被砍掉的荔枝树。", "In that orchard, he replanted the trees that had been cut."],
  [126.4, 130.6, "第二年夏天，叛军逼近，玄宗携贵妃弃城西逃。", "The next summer, as rebels closed in, the Emperor fled west with his Consort."],
  [131.2, 135.4, "一骑红尘妃子笑，无人知是荔枝来。", "A lone rider in red dust, and the Consort smiles — none know it is the lychees coming."],
  [136.0, 140.0, "但总有人知道，这荔枝，从何而来。", "But someone always knows where the lychees came from."],
];
export const CREDIT = [140.4, 143.4, "据马伯庸小说《长安的荔枝》", "Based on the novel by Ma Boyong"];

// 布景：[名字, 开始, 结束]；相邻两段重叠处做墨晕开的转场
export const SEGS = [
  ["road", 0, 12.8], ["city", 12.0, 16.0], ["doc", 15.4, 23.2], ["decay", 22.6, 30.2],
  ["map", 29.4, 57.2], ["jar", 56.4, 76.4], ["map", 75.6, 100.0], ["gate", 99.2, 104.6],
  ["map", 104.0, 108.4], ["peel", 107.8, 111.2], ["scale", 110.6, 115.0], ["orchard", 114.4, 119.0],
  ["map", 118.4, 122.8], ["orchard", 122.2, 126.4], ["map", 125.8, 131.2], ["road", 130.6, 136.0], ["map", 135.4, 144.0],
];
