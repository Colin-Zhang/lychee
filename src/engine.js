// three.js 渲染核心：渲染器、两块离屏缓冲（转场时两个布景各画一张）、最后一道合成（移轴景深、墨晕开转场、暖调、暗角、胶片颗粒、渐黑）
// 颜色一律“直通”：canvas 画的颜色原样上屏（不做线性 / sRGB 转换），和 2D 画布看到的一致。
import * as THREE from "three";
import { noiseCanvas } from "./art.js";

export const W = 1920, H = 1080;
export const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
export const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

const rt = () => new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
export const rtA = rt(), rtB = rt();

/** canvas → 贴图（颜色直通）。free：上传以后把 canvas 释放（省内存） */
export function tex(canvas, { mip = true, free = false, wrap = false } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.NoColorSpace; t.anisotropy = MAX_ANISO;
  t.generateMipmaps = mip; t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (free) { renderer.initTexture(t); canvas.width = canvas.height = 1; }
  return t;
}

// ── 合成
const noise = noiseCanvas(512, 288, 9, { radial: 0.5 });
const noiseTex = tex(noise, { mip: false });
const POISSON = [[0.0, 0.0], [0.53, 0.42], [-0.67, 0.27], [0.21, -0.79], [-0.33, -0.55], [0.86, -0.13], [-0.12, 0.93], [-0.94, -0.21], [0.62, 0.71], [0.4, -0.38], [-0.55, 0.68], [-0.78, -0.62]];
const comp = new THREE.ShaderMaterial({
  uniforms: {
    tA: { value: rtA.texture }, tB: { value: rtB.texture }, tMask: { value: noiseTex },
    uMix: { value: 0 }, uBlurA: { value: 0 }, uBlurB: { value: 0 }, uFocusA: { value: 0.5 }, uFocusB: { value: 0.5 }, uBandA: { value: 0.18 }, uBandB: { value: 0.18 },
    uTime: { value: 0 }, uFade: { value: 0 }, uFadeCol: { value: new THREE.Color(0, 0, 0) }, uVig: { value: 0.28 }, uGrain: { value: 0.028 }, uWarm: { value: 0.04 },
    uMode: { value: 0 }, uMistCol: { value: new THREE.Color(0.93, 0.9, 0.82) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tA, tB, tMask; uniform float uMix, uBlurA, uBlurB, uFocusA, uFocusB, uBandA, uBandB, uTime, uFade, uVig, uGrain, uWarm, uMode; uniform vec3 uFadeCol, uMistCol; varying vec2 vUv;
    const vec2 P[12] = vec2[12](${POISSON.map(([x, y]) => `vec2(${x.toFixed(2)}, ${y.toFixed(2)})`).join(", ")});
    vec3 tilt(sampler2D t, vec2 uv, float focus, float band, float amt) {
      float d = abs(uv.y - focus); float r = amt * smoothstep(band, band + 0.35, d);
      if (r < 0.0004) return texture2D(t, uv).rgb;
      vec3 c = vec3(0.0); for (int i = 0; i < 12; i++) c += texture2D(t, uv + P[i] * r * vec2(0.5625, 1.0)).rgb; return c / 12.0;
    }
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 col;
      if (uMix <= 0.0) col = tilt(tA, vUv, uFocusA, uBandA, uBlurA);
      else if (uMode < 0.5) {
        // 墨晕开：按噪声一块块洇过去，边上一圈淡墨
        vec3 a = tilt(tA, vUv, uFocusA, uBandA, uBlurA), b = tilt(tB, vUv, uFocusB, uBandB, uBlurB);
        float n = texture2D(tMask, vUv).r; float soft = 0.12;
        float m = smoothstep(n - soft, n + soft, uMix * (1.0 + 2.0 * soft) - soft);
        float edge = 1.0 - abs(2.0 * m - 1.0);
        col = mix(a, b, m) * (1.0 - edge * 0.24);
      } else {
        // 穿云（mode 1）/ 叠化（mode 2）：前一个画面往前推、后一个从微微放大里落定；穿云时中间漫过一层飘动的云雾
        float k = smoothstep(0.0, 1.0, uMix);
        vec2 ua = (vUv - 0.5) / (1.0 + 0.06 * k) + 0.5, ub = (vUv - 0.5) / (1.0 + 0.06 * (1.0 - k)) + 0.5;
        vec3 a = tilt(tA, ua, uFocusA, uBandA, uBlurA), b = tilt(tB, ub, uFocusB, uBandB, uBlurB);
        col = mix(a, b, k);
        if (uMode < 1.5) {
          float n1 = texture2D(tMask, vUv * 0.62 + vec2(uMix * 0.22, uMix * 0.05)).r, n2 = texture2D(tMask, vUv * 1.4 + vec2(-uMix * 0.35, 0.1 + uMix * 0.08)).r;
          // 云是一团一团的，不是一整片白：最浓时也只盖住七成，能透出前后两个画面
          float amt = pow(sin(uMix * 3.14159), 1.6), cloud = smoothstep(0.32, 0.78, n1 * 0.6 + n2 * 0.4 + amt * 0.22);
          col = mix(col, uMistCol, clamp(amt * (0.18 + 0.62 * cloud), 0.0, 0.72));
        }
      }
      col += vec3(uWarm, uWarm * 0.45, -uWarm * 0.4);
      float v = smoothstep(1.05, 0.32, length((vUv - 0.5) * vec2(1.0, 0.82)) * 1.25); col *= mix(1.0 - uVig, 1.0, v);
      col += (h(floor(vUv * vec2(960.0, 540.0)) + floor(uTime * 15.0) * 3.71) - 0.5) * uGrain;
      col = mix(col, uFadeCol, uFade);
      gl_FragColor = vec4(col, 1.0);
    }`,
  depthTest: false, depthWrite: false,
});
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), comp);
const compScene = new THREE.Scene(); compScene.add(quad);
const compCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

/** 把一个布景画进离屏缓冲：布景自己有 draw（比如立体山水要先画深度再勾墨线）就用它的 */
function draw(s, target) {
  if (s.draw) { s.draw(renderer, target); return; }
  renderer.setRenderTarget(target); renderer.setClearColor(0x1a140d, 1); renderer.clear(); renderer.render(s.scene, s.camera);
}
/**
 * 画一帧。a / b 是布景：{ scene, camera, look: { blur, focus, band } }；mix 0–1 是从 a 转到 b 的进度（墨晕开）
 */
export function renderFrame(a, b, mix, { time = 0, fade = 0, fadeCol = 0x000000, vig = 0.28, grain = 0.028, mode = 0 } = {}) {
  draw(a, rtA);
  const u = comp.uniforms;
  u.uBlurA.value = a.look?.blur ?? 0; u.uFocusA.value = a.look?.focus ?? 0.5; u.uBandA.value = a.look?.band ?? 0.18;
  if (b && mix > 0) { draw(b, rtB); u.uBlurB.value = b.look?.blur ?? 0; u.uFocusB.value = b.look?.focus ?? 0.5; u.uBandB.value = b.look?.band ?? 0.18; u.uMix.value = mix; }
  else u.uMix.value = 0;
  u.uTime.value = time; u.uFade.value = fade; u.uFadeCol.value.set(fadeCol); u.uVig.value = vig; u.uGrain.value = grain; u.uMode.value = mode;
  renderer.setRenderTarget(null); renderer.render(compScene, compCam);
}

/** 显影材质：贴图按噪声遮罩一点点“洇”出来（uReveal 0→1），边缘带一圈墨色 */
export function revealMaterial(map, { mask = noiseTex, soft = 0.08, opacity = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, tMask: { value: mask }, uReveal: { value: 1 }, uSoft: { value: soft }, uOpacity: { value: opacity } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D map, tMask; uniform float uReveal, uSoft, uOpacity; varying vec2 vUv;
      void main(){ vec4 c = texture2D(map, vUv); float n = texture2D(tMask, vUv).r; float m = smoothstep(n - uSoft, n + uSoft, uReveal * (1.0 + 2.0 * uSoft) - uSoft);
        float edge = (1.0 - abs(2.0 * m - 1.0)) * step(0.001, m) * step(m, 0.999); c.rgb *= 1.0 - edge * 0.45; gl_FragColor = vec4(c.rgb, c.a * m * uOpacity); }`,
    transparent: true, depthWrite: false,
  });
}
/** 两张贴图之间按 uMix 交叉淡化（荔枝变色、换状态） */
export function blendMaterial(a, b) {
  return new THREE.ShaderMaterial({
    uniforms: { tA: { value: a }, tB: { value: b }, uMix: { value: 0 }, uOpacity: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tA, tB; uniform float uMix, uOpacity; varying vec2 vUv; void main(){ vec4 a = texture2D(tA, vUv), b = texture2D(tB, vUv); vec4 c = mix(a, b, uMix); gl_FragColor = vec4(c.rgb, c.a * uOpacity); }`,
    transparent: true, depthWrite: false,
  });
}
export const basic = (map, opacity = 1) => new THREE.MeshBasicMaterial({ map, transparent: true, opacity, depthWrite: false });

/** 一个“布景”：自己的场景和透视相机；平面层按深度摆，铺满画面 */
export class Stage {
  constructor(fov = 30) { this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(fov, W / H, 1, 400000); this.look = { blur: 0, focus: 0.5, band: 0.2 }; this.D = 2000; this.camera.position.set(0, 0, this.D); }
  /** 在深度 z 处放一张铺满画面的平面（margin 是放大余量，推镜头 / 视差用） */
  layer(material, z = 0, margin = 1.12, aspect = W / H) {
    const dist = this.D - z, hgt = 2 * dist * Math.tan((this.camera.fov * Math.PI) / 360) * margin;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(hgt * aspect, hgt), material); m.position.z = z; this.scene.add(m); return m;
  }
  /** 屏幕上的一点（0–1）在深度 z 处的世界坐标（放在画面某个位置的东西用） */
  at(u, v, z = 0) { const dist = this.D - z, hh = dist * Math.tan((this.camera.fov * Math.PI) / 360); return new THREE.Vector3((u - 0.5) * 2 * hh * (W / H), (0.5 - v) * 2 * hh, z); }
  /** 画布像素（宽 SW 的插画）在深度 z 处的世界坐标：插画铺满 margin 倍的画面 */
  px(x, y, z = 0, margin = 1.12, cw = 2560, ch = 1440) { const dist = this.D - z, hgt = 2 * dist * Math.tan((this.camera.fov * Math.PI) / 360) * margin, wid = hgt * (W / H); return new THREE.Vector3((x / cw - 0.5) * wid, (0.5 - y / ch) * hgt, z); }
  pxScale(z = 0, margin = 1.12, cw = 2560) { const dist = this.D - z, hgt = 2 * dist * Math.tan((this.camera.fov * Math.PI) / 360) * margin; return (hgt * (W / H)) / cw; }
}
