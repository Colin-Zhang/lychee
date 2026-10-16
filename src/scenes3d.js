// 六个立体场景的“看法”：天光、镜头关键帧、地名标签、额外的东西。地面配置在 places.js。
// 关键帧：[时间, 线头在红线上的位置（米）, 镜头在线头后面多远, 多高, 从侧面偏多少度, 线头在屏幕上的 u, v, 视角, 看守（1 = 镜头停住不跟）]
import * as THREE from "three";
import { tex } from "./engine.js";
import { mk } from "./art.js";
import { clamp, lerp } from "./landform.js";

const DAY = { sun: [0.42, 0.52, 0.66] };

export const LOOKS = {
  // 第 13 屏：翻大庾岭（8 秒）
  meiling: {
    light: { ...DAY, base: 170, span: 650, fogY0: 170, fogA: 0.00075, fogB: 1 / 190, fogFar: 26000 },
    keys: (R) => [[0.0, R.sTop - 3000, 1000, 560, 18, 0, -0.3, 46, 0], [2.2, R.sTop - 650, 470, 230, 34, -0.05, -0.32, 43, 0], [3.3, R.sTop - 110, 200, 70, 52, -0.06, -0.2, 40, 0],
      [4.0, R.sTop - 45, 80, 22, 62, -0.1, -0.12, 36, 0], [4.6, R.sTop - 12, 72, 20, 70, -0.08, -0.08, 36, 0], [5.8, R.sTop + 200, 650, 300, 22, 0, -0.5, 44, 0.1],
      [6.8, R.sTop + 1400, 520, 620, 6, 0, -0.4, 46, 0.85], [8.6, R.sWater0 + 900, 520, 620, 6, 0, -0.16, 46, 1]],
    labels: (R) => [{ name: "大庾岭", at: { s: R.sTop }, up: 30, t0: 0.3, t1: 5.3, lead: 120 }, { name: "大庾县", at: [114.36, 25.4], t0: 6.0, t1: 8.0, lead: 130 }],
    clearance: 12,   // 山口两边的山比路高，离地下限放低一点，近景才贴得上骑手
  },
  // 第 14 屏：下赣江（船从虔州城下顺流而下，镜头在船前方回看城）
  ganjiang: {
    light: { ...DAY, base: 100, span: 520, fogY0: 100, fogA: 0.0009, fogB: 1 / 200, fogFar: 26000 },
    keys: () => [[0.0, 3290, 580, 225, 150, 0.05, -0.24, 44, 0], [3.2, 3380, 340, 135, 161, 0.04, -0.22, 42, 0]],
    labels: () => [{ name: "虔州", at: [114.93, 25.85], t0: 0.0, t1: 2.6, lead: 100 }],
  },
  // 第 14 屏：渡长江（镜头在江北，隔着长江看江州城和后面的庐山）
  jiujiang: {
    light: { ...DAY, base: 25, span: 900, fogY0: 12, fogA: 0.00035, fogB: 1 / 240, fogFar: 48000 },
    keys: (R) => { const s0 = R.sNear([115.99, 29.73]) - 700; return [[0.0, s0, 960, 432, 91, -0.42, -0.38, 46, 0], [3.3, s0 + 90, 840, 395, 99, -0.4, -0.37, 46, 0]]; },
    labels: () => [{ name: "江州", at: [115.99, 29.712], t0: 0.0, t1: 2.6, lead: 70, side: -1 }, { name: "庐山", at: [115.98, 29.56], up: 30, t0: 0.4, t1: 2.6, lead: 90, side: 1 }],
  },
  // 第 14 屏：上汉水（逆流往北，远处是襄州城）
  xiangyang: {
    light: { ...DAY, base: 70, span: 320, fogY0: 62, fogA: 0.0008, fogB: 1 / 200, fogFar: 30000 },
    keys: (R) => [[0.0, R.len - 2710, 630, 232, 33, 0, -0.3, 44, 0], [3.3, R.len - 2620, 420, 165, 43, 0, -0.27, 42, 0]],
    labels: () => [{ name: "襄州", at: [112.14, 32.04], t0: 0.0, t1: 2.6, lead: 110 }],
  },
  // 第 14 屏：越秦岭（侧上方看骑手翻过岭脊，谷里起云）
  languan: {
    light: { ...DAY, base: 650, span: 1300, fogY0: 950, fogA: 0.0013, fogB: 1 / 260, fogFar: 32000 },
    keys: (R) => [[0.0, R.sTop - 960, 730, 302, 57, 0, -0.26, 44, 0], [3.5, R.sTop - 440, 540, 232, 72, 0, -0.22, 42, 0]],
    labels: (R) => [{ name: "秦岭", modern: "今陕西商洛、蓝田之间", at: { s: R.sTop }, up: 40, t0: 0.2, t1: 2.8, lead: 110 }],
  },
  // 第 18–21 屏：片尾，骊山黄昏。镜头从长安方向远望骊山（绣成堆）→ 山上的灯一盏盏亮起（千门次第开）→ 一骑红尘奔向山脚 → 尘落，停住
  lishan: {
    light: { sun: [-0.86, 0.2, 0.22], base: 380, span: 800, fogY0: 380, fogA: 0.00035, fogB: 1 / 220, fogFar: 42000, fogCol: "#eedcc0", hazeCol: "#e6d2b6", skyTop: "#a9a3bb", sunGlow: "#5c3416", litCol: "#fbe6cc", shadeCol: "#8f90ac" },
    route: { show: false }, trees: 60000, dustCol: "#dcb58a", riderFrom: 7, clearance: 8,
    keys: (R) => [[0.0, R.len - 900, 120, 12, -72, -0.22, -0.1, 36, 0], [7.0, R.len - 900, 120, 12, -72, -0.22, -0.1, 36, 0], [10.6, R.len - 800, 110, 11, -76, -0.2, -0.1, 36, 0], [12.2, R.len - 760, 170, 24, -74, -0.18, -0.12, 38, 0], [14.0, R.len - 740, 560, 150, -60, -0.1, -0.28, 42, 0.7]],
    labels: () => [{ name: "骊山", modern: "今陕西西安临潼", at: [109.215, 34.338], up: 40, t0: 0.6, t1: 6.8, lead: 120 }],
    extra: (ctx) => lishanExtras(ctx),
  },
};

// 片尾：镜头路线（不跟线头）、山上一盏盏亮起的灯、骑手扬起的红尘
function lishanExtras({ st, scene, camera, U, L, R, roadAt, ground, S_, K, V3 }) {
  const P = (lon, lat, up = 0) => { const [x, z] = L.proj(lon, lat); return V3(x, ground(x, z) + up, z); };
  // 灯：从华清宫一带的山脚一路往山顶，次第亮起
  const lamps = [], peak = [109.214, 34.338], foot = [109.207, 34.363];
  for (let k = 0; k < 96; k++) {
    const f = Math.pow(k / 95, 0.85), w = Math.abs((Math.sin(k * 12.9898) * 43758.5453) % 1), w2 = Math.abs((Math.sin(k * 78.233) * 12543.123) % 1);
    const row = Math.floor(w2 * 5) - 2, side = row * 0.0032 * (1 - f * 0.5) + (w - 0.5) * 0.002;
    lamps.push([lerp(foot[0], peak[0], f) + side, lerp(foot[1], peak[1], f) - Math.abs(row) * 0.0006, 3.6 + f * 3.0 + w * 0.2]);
  }
  const n = lamps.length, pos = new Float32Array(n * 3), tt = new Float32Array(n);
  lamps.forEach(([lo, la, t0], i) => { const p = P(lo, la, 6); pos.set([p.x, p.y, p.z], i * 3); tt[i] = t0; });
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aT", new THREE.BufferAttribute(tt, 1));
  const dot = mk(64, 64), dg = dot.getContext("2d"), gr = dg.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,240,200,1)"); gr.addColorStop(0.25, "rgba(255,170,90,.85)"); gr.addColorStop(1, "rgba(255,120,50,0)"); dg.fillStyle = gr; dg.fillRect(0, 0, 64, 64);
  const lampMat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex(dot) }, uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aT; uniform float uT; varying float vA; void main(){ float k = clamp((uT - aT) * 3.0, 0.0, 1.0); vA = k * (0.85 + 0.15 * sin(uT * 9.0 + aT * 30.0)); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = (30.0 + 44.0 * k) * (2400.0 / -mv.z) * 0.32 + 7.0 * k; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying float vA; void main(){ float a = texture2D(map, gl_PointCoord).a * vA; if (a < 0.01) discard; gl_FragColor = vec4(vec3(1.0, 0.78, 0.5) * a, a); }` });
  const lampPts = new THREE.Points(g, lampMat); lampPts.frustumCulled = false; lampPts.renderOrder = 25; scene.add(lampPts);
  // 红尘：马蹄扬起的黄尘（夕阳下泛暖色，不是红烟），骑手身后一团团飘起、散开、慢慢落定
  const red = new K.Puffs(U, 110, { color: "#f2dcb8" }); scene.add(red.mesh);
  const C = (h) => new THREE.Color(h), from = { lit: C("#fbe6cc"), haze: C("#e6d2b6"), sky: C("#a9a3bb"), fog: C("#eedcc0") }, to = { lit: C("#f2c49c"), haze: C("#d6b6a0"), sky: C("#7f7a98"), fog: C("#dcbca2") };
  // 镜头：0–7 秒远望骊山慢慢推近；7 秒后交给跟拍（关键帧）
  const camA = P(109.125, 34.405, 620), camB = P(109.165, 34.388, 360), tgtA = P(109.216, 34.336, 480), tgtB = P(109.211, 34.347, 330);
  st.camOverride = (t) => {
    if (t >= 7.8) return null;
    const k = clamp(t / 7.8), e = k * k * (3 - 2 * k);
    const bl = clamp((t - 6.5) / 1.3); return { pos: camA.clone().lerp(camB, e), target: tgtA.clone().lerp(tgtB, e), blend: 1 - bl * bl * (3 - 2 * bl) };
  };
  return (t) => {
    lampMat.uniforms.uT.value = t;
    U.uDay.value = 1 - 0.35 * clamp((t - 3) / 6);
    const kd = clamp(t / 14); U.uLitCol.value.copy(from.lit).lerp(to.lit, kd); U.uHazeCol.value.copy(from.haze).lerp(to.haze, kd); U.uSkyTop.value.copy(from.sky).lerp(to.sky, kd); U.uFogCol.value.copy(from.fog).lerp(to.fog, kd);
    const list = [];
    if (t > 7) for (let i = 0; i < 110; i++) {
      const tb = 7 + (Math.floor((t - 7) / 0.04) - i) * 0.04, age = t - tb; if (age < 0 || tb < 7) continue;
      const s = S_(Math.min(tb, 12)), q = roadAt(Math.min(s, R.sRoadEnd)), rr = Math.abs((Math.sin(i * 78.233 + Math.floor(tb * 50) * 12.9898) * 43758.5453) % 1) - 0.5, settle = clamp((t - 11.6) / 2.2), stop = tb > 12 ? 0 : 1;
      // 从蹄下扬起：一开始紧贴着马、颜色亮，越往后越大、越高、越淡
      list.push([q.x + rr * 8 * (1 + age), q.y + 0.8 + age * (3 - settle * 2), q.z - rr * 6 * (1 + age), 2.5 + age * 7, 0.42 * stop * Math.pow(Math.max(0, 1 - age / 4), 1.5) * (1 - settle * 0.6)]);
    }
    red.set(list);
  };
}
