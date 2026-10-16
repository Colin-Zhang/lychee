// 第四稿的古地图布景（2D，正上方看）：只有一根朱红路线（走过实线、没走到虚线），荔枝线头，经过的城旁边补一行“今……”。
// 三段：open（第 2–3 屏：先画出整条路的虚线、标出岭南和长安；再按常人马行日七十里走三天，荔枝坏了，只走出这么一点）
//       dayu（第 13 屏开头：线一路画到大庾岭，镜头推过去）
//       arrive（第 15 屏：线画到长安，第十日）
import * as THREE from "three";
import { tex, Stage, W, H } from "./engine.js";
import { drawMap, MW, MH, P, S } from "./map.js";
import { journey, STOPS } from "./journey.js";
import { RouteRibbon, densify } from "./route3d.js";
import { mk } from "./art.js";
import { Overlay, PLACES } from "./labels.js";

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2), lerp = (a, b, k) => a + (b - a) * k;
export const LI_TOTAL = 5210, PACE = 70;   // 《元和郡县图志》广州取虔州大庾岭路五千二百一十里；《唐六典》常行马日七十里

export function buildMap4() {
  const st = new Stage(30); st.camera.near = 10; st.camera.far = 200000;
  const TW = Math.ceil(MW / 2), TH = Math.ceil(MH / 2);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const c = mk(TW, TH), g = c.getContext("2d"); g.translate(-i * TW, -j * TH); drawMap(g);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH), new THREE.MeshBasicMaterial({ map: tex(c, { mip: true, free: true }) }));
    m.rotation.x = -Math.PI / 2; m.position.set(i * TW + TW / 2 - MW / 2, 0, j * TH + TH / 2 - MH / 2); st.scene.add(m);
  }
  const J = journey(), dense = densify(J.pts.map((p, i) => [p[0], p[1], J.kinds[i]]), 2 * S);
  const route = new RouteRibbon(dense.map(([x, y]) => [x - MW / 2, 2, y - MH / 2]), { kinds: dense.map((p) => p[2]), core: 9, edge: 0.2, halo: 1.0, haloA: 0.24, col: "#de3d27", edgeCol: "#3a140a", haloCol: "#1e1008", glowCol: "#ffe0a8", ahead: 0.6, order: 30 });
  route.addTo(st.scene); route.u.uDash.value = 1;
  const full = { c: [MW * 0.5, MH * 0.52], vis: MW * 0.98 };
  const view = (c, vis) => { const D = vis / (2 * (W / H) * Math.tan((st.camera.fov * Math.PI) / 360)); st.camera.position.set(c[0] - MW / 2, D, c[1] - MH / 2); st.camera.up.set(0, 0, -1); st.camera.lookAt(c[0] - MW / 2, 0, c[1] - MH / 2); };
  const toward = (a, b, k) => ({ c: [lerp(a.c[0], b.c[0], k), lerp(a.c[1], b.c[1], k)], vis: Math.exp(lerp(Math.log(a.vis), Math.log(b.vis), k)) });
  const stops = ["韶州", "大庾岭", "虔州", "洪州", "江州", "鄂州", "襄州", "商州", "长安"].map((n) => ({ n, p: J.at(n), xy: P(...STOPS[n]) }));
  const pDayu = J.at("大庾岭"), pShang = J.at("商州"), p3 = (PACE * 3) / LI_TOTAL;
  st.info = {}; st.J = J;
  /** lt：本段时间；mode：open / dayu / arrive。返回给 HUD 的信息（里数、日数、线头进度） */
  st.update = (lt, mode = "open") => {
    let prog = 0, v = full, aheadTo = 1, rot = 0, head = true, labels = [], info = {};
    if (mode === "open") {
      aheadTo = ease(seg(lt, 0.3, 1.9)); prog = p3 * ease(seg(lt, 3.6, 5.6)); rot = seg(lt, 4.9, 6.0); head = lt > 3.4;
      v = toward(full, { c: [MW * 0.52, MH * 0.6], vis: MW * 0.86 }, ease(seg(lt, 3.2, 6.6)));
      labels = [["广州", P(113.26, 23.13), seg(lt, 0.4, 0.8), { name: "岭南", modern: "今广东广州", side: 1 }], ["长安", P(108.94, 34.34), seg(lt, 1.6, 2.0), { side: -1 }]];
      const dayK = seg(lt, 3.6, 5.6), day = lt < 3.4 ? 0 : 1 + Math.min(2, Math.floor(dayK * 2.999));
      info = { li: lt < 3.3 ? LI_TOTAL : PACE * day, day, total: lt < 3.3, liA: seg(lt, 1.0, 1.4) * (lt < 3.3 ? 1 - seg(lt, 3.0, 3.3) : seg(lt, 3.5, 3.8)), dayA: seg(lt, 3.5, 3.8) };
    } else if (mode === "dayu") {
      prog = pDayu * ease(seg(lt, 0, 1.4)); v = toward(full, { c: P(114.3, 25.4), vis: MW * 0.22 }, ease(seg(lt, 0.4, 1.9)));
      labels = [["大庾岭", P(114.32, 25.33), seg(lt, 0.9, 1.2), {}]];
    } else if (mode === "arrive") {
      prog = lerp(pShang, 1, ease(seg(lt, 0.2, 1.8))); v = full; head = prog < 0.999;
      labels = [["长安", P(108.94, 34.34), seg(lt, 1.6, 2.0), { side: -1 }]];
      info = { day: lt < 1.8 ? 9 : 10, li: LI_TOTAL, dayA: seg(lt, 0.1, 0.4), liA: seg(lt, 0.1, 0.4), arrive: true, noteA: seg(lt, 2.2, 2.6) };
    }
    view(v.c, v.vis); route.set(prog, { head: 60 * S, aheadTo });
    st.info = info;
    st.draw2d = (ov, t) => {
      st.camera.updateMatrixWorld();
      for (const [name, xy, a, o] of labels) { if (a <= 0) continue; const q = Overlay.screen(new THREE.Vector3(xy[0] - MW / 2, 0, xy[1] - MH / 2), st.camera); if (q) ov.label(o.name ?? name, q[0], q[1], { a, lead: 70, side: o.side ?? 1, modern: o.modern ?? PLACES[name] }); }
      if (mode === "dayu") for (const sp of stops) { if (prog < sp.p || sp.n === "大庾岭") continue; const q = Overlay.screen(new THREE.Vector3(sp.xy[0] - MW / 2, 0, sp.xy[1] - MH / 2), st.camera); if (q) ov.modern(PLACES[sp.n], q[0], q[1], { a: 0.9, dx: 14, dy: 40 }); }
      if (head && prog > 0.0005) { const h = route.at(prog), q = Overlay.screen(new THREE.Vector3(h.x, 2, h.z), st.camera); if (q) ov.head(q[0], q[1], t, { flat: 1, size: 58, stem: 26, rot }); }
    };
    st.look = { blur: 0, focus: 0.5, band: 0.3 };
    return info;
  };
  // 角上的小地图：整张图缩小画一次（main 里用渲染器拍一张）
  st.miniView = () => { view(full.c, full.vis); route.set(0, { aheadTo: 0 }); };
  st.miniProject = (prog) => { const h = route.at(prog); return [(h.x + MW / 2) / MW, (h.z + MH / 2) / MH]; };
  st.miniPath = () => { const out = []; for (let i = 0; i <= 400; i++) { const h = route.at(i / 400); out.push([(h.x + MW / 2) / MW, (h.z + MH / 2) / MH]); } return out; };
  return st;
}
