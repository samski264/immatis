"use client";

import { useEffect, useRef } from "react";
import { gpsTune } from "@/lib/gpsTune";
import { stepTune } from "@/lib/stepTune";
import styles from "./css/LandscapeStrip.module.css";
import {
  DEFAULT_GRADE,
  DISCARD_FS,
  GRADED_FS,
  GRADE_GLSL,
  GRADE_UNIFORMS,
  LANDSCAPES,
  bindAttrib,
  createGlyphAtlas,
  createProgram,
  createVBO,
  loadImage,
  sampleColors,
  setGradeUniforms,
  shuffledAssignment,
} from "./lib/particles";

const SETTINGS = {
  ...DEFAULT_GRADE,
  palette: "aero",
  road: "#ffffff",
  arrow: "#ebebeb",
  ascii: true, // rendu en glyphes ASCII plutôt qu'en points
  cell: 1.5, // pas d'écartement entre particules (px CSS), 0 = auto
  size: 1.5, // taille du point / glyphe (px CSS), 0 = auto = égale au pas (jointif)
  asciiInvert: false, // glyphes denses sur les zones claires plutôt que sombres
};

const ASCII_AUTO_CELL = 10; // pas par défaut en mode ASCII quand `cell` est auto

// Référence caméra, pas la hauteur affichée de la bande (elle suit le dépôt).
// 200 px à 390 de large, 413 px à 1728, linéaire entre les deux.
const bandRef = () => {
  const vw = window.innerWidth;
  const h = 200 + ((vw - 390) * 213) / 1338;
  return Math.min(413, Math.max(200, h));
};

// Éclaircit une couleur hex (mélange avec du blanc) pour le haut du dégradé de la flèche
function lighten(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
  const ch = (shift) => {
    const v = (n >> shift) & 255;
    return Math.round(v + (255 - v) * amount)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

// Bande de paysages en particules qui défile de droite à gauche en boucle, avec un chemin
// sinueux aléatoire et une flèche de navigation qui le suit. Le pointeur, la flèche et le
// chemin ne déplacent pas les particules : ils les grossissent (1 + grow * GROW, grow <= 2).

const MAX_PARTICLES = 3_600_000;
const GROW = 2.0; // grossissement ajouté par unité de grow (pointeur seul => 3x, flèche => 5x)
const ATLAS_SCALE = 4; // atlas ASCII rendu à 4x la taille de base (puissance de 2 >= 1 + GROW)
const SPEED = 40; // px/s de défilement
const GAP_RATIO = 8 / 237; // gap entre tuiles, proportionnel à la taille de tuile (Figma)
const ROAD_BEND = 1.15; // distance moyenne entre deux virages (en tuiles)
const ROAD_MIN = 0.1; // écart min / max d'un virage par rapport au centre (fraction de tuile)
const ROAD_MAX = 0.36;
const ROAD_SAMPLES = 512; // échantillons de la route envoyés au shader (vec4[128])
const ARROW_X = 0.35; // position horizontale de la flèche (fraction de la largeur)
const ARROW_D =
  "M0 -14 C1.2 -14 2.2 -13.2 2.8 -11.9 L12.2 8.2 C13.2 10.4 11.1 12.8 8.8 11.8 L1.2 8.4 C0.4 8.1 -0.4 8.1 -1.2 8.4 L-8.8 11.8 C-11.1 12.8 -13.2 10.4 -12.2 8.2 L-2.8 -11.9 C-2.2 -13.2 -1.2 -14 0 -14 Z";

// Écart-type du flou CSS (blur(17,6 px) → σ = 8,8). Fait dans le canvas : un backdrop-filter
// au-dessus d'une surface qui change à chaque image est recalculé par WindowServer.
const FROST_SIGMA = 8.8;

const BLIT_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// 9 texels en 5 lectures bilinéaires (Jam3). uTexel est déjà en UV, multiplié par σ.
const BLUR_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 color = texture(uTex, vUv) * 0.2270270270;
  vec2 off1 = 1.3846153846 * uTexel;
  vec2 off2 = 3.2307692308 * uTexel;
  color += texture(uTex, vUv + off1) * 0.3162162162;
  color += texture(uTex, vUv - off1) * 0.3162162162;
  color += texture(uTex, vUv + off2) * 0.0702702703;
  color += texture(uTex, vUv - off2) * 0.0702702703;
  outColor = color;
}`;

const PRESENT_FS = `#version 300 es
precision highp float;
uniform sampler2D uSharp;
uniform sampler2D uBlur;
uniform vec2 uResolution;
uniform vec4 uRect[4];
uniform float uRadius[4];
uniform float uCover[4];
uniform vec2 uVeil;
uniform int uBlurOn;
in vec2 vUv;
out vec4 outColor;

float frost(vec2 p, vec4 r, float rad) {
  if (r.z < 1.0 || r.w < 1.0) return 0.0;
  rad = min(rad, min(r.z, r.w) * 0.5);
  vec2 c = r.xy + r.zw * 0.5;
  vec2 h = max(r.zw * 0.5 - vec2(rad), vec2(0.0));
  vec2 q = abs(p - c) - h;
  float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
  return 1.0 - smoothstep(-0.75, 0.75, dist);
}

void main() {
  vec3 sharp = texture(uSharp, vUv).rgb;
  if (uBlurOn == 0) {
    outColor = vec4(sharp, 1.0);
    return;
  }
  vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  float mask = 0.0;
  if (uVeil.y > 0.0) mask = 1.0 - smoothstep(uVeil.x, max(uVeil.y, uVeil.x + 1.0), p.y);
  mask = max(mask, frost(p, uRect[0], uRadius[0]) * uCover[0]);
  mask = max(mask, frost(p, uRect[1], uRadius[1]) * uCover[1]);
  mask = max(mask, frost(p, uRect[2], uRadius[2]) * uCover[2]);
  mask = max(mask, frost(p, uRect[3], uRadius[3]) * uCover[3]);
  vec3 blurred = texture(uBlur, vUv).rgb;
  outColor = vec4(mix(sharp, blurred, clamp(mask, 0.0, 1.0)), 1.0);
}`;

// Tracé et flèche, dans la cible de la scène. vOut est la distance au-delà du bord
// idéal : négatif à l'intérieur, uFeather sur le contour élargi. Le fondu tient
// lieu d'anticrénelage.
const INK_FEATHER = 0.85;
const INK_VS = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec4 aColor;
layout(location = 2) in float aOut;
uniform vec2 uResolution;
out vec4 vColor;
out float vOut;
void main() {
  vec2 ndc = vec2(aPos.x / uResolution.x * 2.0 - 1.0, 1.0 - aPos.y / uResolution.y * 2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);
  vColor = aColor;
  vOut = aOut;
}`;
const INK_FS = `#version 300 es
precision highp float;
uniform float uFeather;
in vec4 vColor;
in float vOut;
out vec4 outColor;
void main() {
  outColor = vColor * (1.0 - smoothstep(0.0, uFeather, vOut));
}`;

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function premul(rgb, a) {
  return [rgb[0] * a, rgb[1] * a, rgb[2] * a, a];
}

// Bandeau d'épaisseur constante. Les jointures trop vives sont biseautées,
// les extrémités sont des demi-disques.
function appendStroke(points, half, color, closed, vert) {
  let n = points.length;
  if (n < 2) return;
  if (closed) {
    const a = points[0];
    const b = points[n - 1];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 0.4) n -= 1;
    if (n < 3) return;
  }
  const segCount = closed ? n : n - 1;
  const segs = new Array(segCount);
  for (let i = 0; i < segCount; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1e-4;
    segs[i] = { dx: dx / len, dy: dy / len, nx: -dy / len, ny: dx / len };
  }
  const rad = half + INK_FEATHER;
  const rim = (x, y) => ({ x, y, o: INK_FEATHER });
  const hub = (p) => ({ x: p.x, y: p.y, o: -half });
  const tri = (a, b, c) => {
    vert(a.x, a.y, color, a.o);
    vert(b.x, b.y, color, b.o);
    vert(c.x, c.y, color, c.o);
  };
  const along = (p, seg) => ({
    L: rim(p.x + seg.nx * rad, p.y + seg.ny * rad),
    R: rim(p.x - seg.nx * rad, p.y - seg.ny * rad),
  });
  const offsets = new Array(n);
  for (let i = 0; i < n; i++) {
    const incoming = closed || i > 0 ? segs[(i - 1 + segCount) % segCount] : null;
    const outgoing = closed || i < n - 1 ? segs[i % segCount] : null;
    const p = points[i];
    if (incoming && outgoing) {
      const dot = incoming.nx * outgoing.nx + incoming.ny * outgoing.ny;
      const denom = 1 + dot;
      if (denom > 0.3) {
        const s = rad / denom;
        const mx = (incoming.nx + outgoing.nx) * s;
        const my = (incoming.ny + outgoing.ny) * s;
        if (mx * mx + my * my <= rad * rad * 2.25) {
          const L = rim(p.x + mx, p.y + my);
          const R = rim(p.x - mx, p.y - my);
          offsets[i] = { inL: L, inR: R, outL: L, outR: R };
          continue;
        }
      }
      const inn = along(p, incoming);
      const out = along(p, outgoing);
      offsets[i] = { inL: inn.L, inR: inn.R, outL: out.L, outR: out.R, bevel: true, p };
      continue;
    }
    const side = along(p, outgoing || incoming);
    offsets[i] = { inL: side.L, inR: side.R, outL: side.L, outR: side.R };
  }
  for (let i = 0; i < segCount; i++) {
    const i1 = (i + 1) % n;
    const a = offsets[i];
    const b = offsets[i1];
    const c0 = hub(points[i]);
    const c1 = hub(points[i1]);
    tri(c0, a.outL, b.inL);
    tri(c0, b.inL, c1);
    tri(c0, b.inR, a.outR);
    tri(c0, c1, b.inR);
    if (b.bevel) {
      const prev = segs[i];
      const next = segs[i1 % segCount];
      const cross = prev.dx * next.dy - prev.dy * next.dx;
      if (cross >= 0) tri(c1, b.inR, b.outR);
      else tri(c1, b.outL, b.inL);
    }
  }
  if (closed) return;
  const cap = (index, seg, outward) => {
    const p = points[index];
    const c = hub(p);
    const lx = seg.nx * rad;
    const ly = seg.ny * rad;
    const sign = lx * outward.y - ly * outward.x >= 0 ? 1 : -1;
    let prev = rim(p.x + lx, p.y + ly);
    for (let s = 1; s <= 6; s++) {
      const ang = (sign * Math.PI * s) / 6;
      const co = Math.cos(ang);
      const sn = Math.sin(ang);
      const curr = rim(p.x + lx * co - ly * sn, p.y + lx * sn + ly * co);
      tri(c, prev, curr);
      prev = curr;
    }
  };
  cap(0, segs[0], { x: -segs[0].dx, y: -segs[0].dy });
  cap(n - 1, segs[segCount - 1], { x: segs[segCount - 1].dx, y: segs[segCount - 1].dy });
}

function appendFan(points, colorOf, vert) {
  const n = points.length;
  if (n < 3) return;
  let cx = 0;
  let cy = 0;
  let ck = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
    ck += p.k;
  }
  cx /= n;
  cy /= n;
  ck /= n;
  const cc = colorOf(ck);
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    vert(cx, cy, cc, -100);
    vert(a.x, a.y, colorOf(a.k), -100);
    vert(b.x, b.y, colorOf(b.k), -100);
  }
}

// Position affichée d'une particule : sa tuile défile et boucle sur la longueur totale.
// Route : spline échantillonnée sur la boucle, lue avec interpolation linéaire.
// La route est une texture (texelFetch). Un tableau uniform indexé par un entier
// variable est compilé en boucle sur les 128 vec4, une fois par particule et par image.
const SCROLL_GLSL = `
uniform float scroll;
uniform float loopLength;
uniform float pitch;
uniform sampler2D roadTex;
vec2 scrolled(vec2 h) {
  return vec2(mod(h.x - scroll, loopLength) - pitch, h.y);
}
float roadY(float x) {
  float u = fract((x + scroll) / loopLength) * ${ROAD_SAMPLES}.0;
  float i = floor(min(u, ${ROAD_SAMPLES - 1}.0));
  float j = i < ${ROAD_SAMPLES - 1}.0 ? i + 1.0 : 0.0;
  float a = texelFetch(roadTex, ivec2(int(i), 0), 0).r;
  float b = texelFetch(roadTex, ivec2(int(j), 0), 0).r;
  return mix(a, b, u - i);
}`;

// Catmull-Rom uniforme entre p1 et p2
const catmullRom = (p0, p1, p2, p3, t) =>
  0.5 *
  (2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

// Route sinueuse périodique : virages alternés gauche/droite d'amplitude aléatoire,
// reliés par une spline lisse (comme une route de montagne vue du dessus).
function makeRoad(tile, loopLength) {
  const n = Math.max(4, Math.round(loopLength / (tile * ROAD_BEND)));
  const pts = [];
  let side = Math.random() < 0.5 ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const mag = (ROAD_MIN + Math.random() * (ROAD_MAX - ROAD_MIN)) * tile;
    pts.push(tile / 2 + side * mag);
    if (Math.random() < 0.85) side = -side; // parfois deux virages du même côté
  }
  const at = (t) => {
    // t en unités de virage, périodique
    const i = Math.floor(t);
    const f = t - i;
    const p = (k) => pts[(((i + k) % n) + n) % n];
    return catmullRom(p(-1), p(0), p(1), p(2), f);
  };
  const samples = new Float32Array(ROAD_SAMPLES);
  for (let s = 0; s < ROAD_SAMPLES; s++) samples[s] = at((s / ROAD_SAMPLES) * n);
  return { n, at, samples };
}

// Simulation : chaque particule porte un facteur de grossissement `grow` (0..2) lissé
// vers un champ cible (pointeur, flèche, chemin) — montée rapide, retour plus lent.
const SIM_VS = `#version 300 es
layout(location = 0) in vec2 home;
layout(location = 1) in float grow;

uniform vec2 mouse;
uniform float power;
uniform vec2 arrow;
uniform float dt;
${SCROLL_GLSL}

out float vGrow;

// champ radial 1 au centre -> 0 au rayon
float field(vec2 h, vec2 p, float radius) {
  return smoothstep(radius, 0.0, length(h - p));
}

void main() {
  vec2 h = scrolled(home);

  // poids : pointeur 1, flèche de nav la plus forte, chemin intermédiaire (grow peut dépasser 1)
  float target = field(h, mouse, 90.0) * power;
  target += field(h, arrow, 150.0) * 1.6;
  target += smoothstep(50.0, 0.0, abs(h.y - roadY(h.x))) * 0.7;
  target = min(target, 2.0);

  float k = target > grow ? 14.0 : 5.0;
  vGrow = grow + (target - grow) * min(1.0, k * dt);
}`;

const DRAW_VS = `#version 300 es
layout(location = 0) in vec2 home;
layout(location = 1) in float grow;
layout(location = 3) in vec3 color;
layout(location = 4) in vec2 aOffset;

uniform vec2 resolution;
uniform float pointSize;
uniform float growAmount;
uniform float maxPointSize;
uniform float uFlight; // plongée du plan pendant la lecture, vue de dessus à 0
uniform float uGps; // 0 = plan, 1 = caméra derrière la flèche, route vers l'horizon
uniform vec2 uArrow;
uniform float uHeading;
uniform float uBack;
uniform float uHorizon;
uniform float uAnchor;
uniform float uFill;
uniform float uRelief;
uniform float uRise0;
uniform float uRise1;
uniform float uNear;
uniform float uRef;
uniform vec2 uMouse;
uniform float uHover;
uniform float uTime;
uniform float uReach;
uniform float uCore;
uniform float uRippleFreq;
uniform float uRippleSpeed;
uniform float uRippleAmp;
uniform float uSwirl;
uniform float uGrow;
${SCROLL_GLSL}
${GRADE_GLSL}

out vec3 vColor;
out float vLuma;
out float vThreshold;

void main() {
  vec2 p = scrolled(home) + aOffset;
  vec2 ndc = vec2(p.x / resolution.x * 2.0 - 1.0, 1.0 - p.y / resolution.y * 2.0);

  // À uFlight = 0 et uGps = 0 le mix rend exactement la projection d'origine.
  float pitchAmt = uFlight * (1.0 - uGps);
  float pitch = pitchAmt * 1.05;
  float lift = grow * 0.2 * pitchAmt;
  float y = ndc.y * cos(pitch) + lift;
  float z = ndc.y * sin(pitch) + 2.15;
  float w = clamp(2.15 / max(z, 0.62), 0.38, 2.6);
  vec2 tilted = vec2(ndc.x * w, y * w + pitchAmt * 0.16);
  vec2 plane = mix(ndc, tilted, pitchAmt);

  // Au repos uGps vaut 0 pour toutes les particules : on saute la projection.
  vec2 placed = plane;
  if (uGps > 0.001) {
    // Vue GPS : l'axe de la route devient la profondeur, le travers devient la largeur.
    // Le relief monte avec l'écart au tracé, qui lui reste au sol.
    vec2 fwd = vec2(cos(uHeading), sin(uHeading));
    vec2 right = vec2(-fwd.y, fwd.x);
    vec2 rel = p - uArrow;
    float ahead = dot(rel, fwd);
    float lat = dot(rel, right);
    float road = roadY(p.x);
    float dist = abs(p.y - road);
    float side = p.y < road ? -1.0 : 1.0;
    float ridge = 0.5 + 0.5 * sin(p.x * 0.012 + side * 1.2);
    float range = 0.55 + 0.45 * sin(p.x * 0.005 + 1.3);
    // Les distances sont en hauteur de bande (uRef). Le dessin, lui, couvre toute la fenêtre.
    float back = max(uBack, 0.05) * uRef;
    float eye = max(uAnchor, 0.02) * uRef;
    float focal = max(uFill, 0.02) * resolution.x;
    float horizon = resolution.y * uHorizon;
    float rise = smoothstep(uRef * uRise0, max(uRef * uRise1, uRef * uRise0 + 1.0), dist);
    float mh = rise * (0.4 + 0.6 * ridge) * range * eye * uRelief;
    float nearDist = uRef * uNear;
    float depth = max(max(ahead + back, back - nearDist), 1.0);
    // Le sol utile tient dans ~0,8 fois la largeur. Au-delà, on l'étire jusqu'en bas.
    // Un écran paysage reste en dessous : le facteur vaut 1.
    float yScale = max(1.0, resolution.y / max(resolution.x * 0.8, 1.0));
    vec2 gpsPx = vec2(resolution.x * 0.5 + lat * focal / depth, (horizon + (eye - mh) * focal / depth) * yScale);
    vec2 gpsNdc = vec2(gpsPx.x / resolution.x * 2.0 - 1.0, 1.0 - gpsPx.y / resolution.y * 2.0);
    placed = mix(plane, gpsNdc, uGps);
    gl_Position = vec4(placed, 0.0, 1.0);
    float near = clamp(back / max(depth, 0.001), 0.75, 1.2);
    gl_PointSize = min(pointSize * (1.0 + grow * growAmount) * mix(mix(1.0, w, pitchAmt), near, uGps), maxPointSize);
    if (uGps > 0.55 && ahead < -nearDist) {
      gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
      gl_PointSize = 0.0;
    }
  } else {
    gl_Position = vec4(plane, 0.0, 1.0);
    gl_PointSize = min(pointSize * (1.0 + grow * growAmount) * mix(1.0, w, pitchAmt), maxPointSize);
  }
  vec3 a = adjust(color);
  float t = bayer(home);
  vColor = quantize(a, t);
  vLuma = dot(a, LUMA);
  vThreshold = t;
}`;

export default function LandscapeStrip({ motion }) {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  // `motion` est un ref stable tenu par RouteStage : la boucle lit flight / rush sans re-render
  const motionRef = useRef(motion);
  motionRef.current = motion;

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    // Opaque : WindowServer copie la surface au lieu de la recomposer pixel par pixel.
    // Le fond de page est blanc, les trous des glyphes aussi.
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) return;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    let disposed = false;
    let raf = 0;
    let state = null;
    let scroll = 0;
    const cursor = { x: -1e4, y: -1e4 };
    const mouse = { x: -1e4, y: -1e4, power: 0, inside: false };
    // `cursor` est en pixels écran. `mouse` est dans le repère de la simulation,
    // qui ne couvre pas la boîte CSS quand le canvas est étiré.
    const syncPointer = () => {
      const rect = root.getBoundingClientRect();
      const localX = cursor.x - rect.left;
      const localY = cursor.y - rect.top;
      const reachPx = (stepTune.reach * rect.width) / 100;
      mouse.inside =
        localX >= -reachPx &&
        localY >= -reachPx &&
        localX <= rect.width + reachPx &&
        localY <= rect.height + reachPx;
      const sx = state && rect.width > 0 ? state.resolution[0] / rect.width : 1;
      const sy = state && rect.height > 0 ? state.resolution[1] / rect.height : 1;
      mouse.x = localX * sx;
      mouse.y = localY * sy;
    };

    const simPrg = createProgram(gl, SIM_VS, DISCARD_FS, ["vGrow"]);
    const drawPrg = createProgram(gl, DRAW_VS, GRADED_FS);
    const tf = gl.createTransformFeedback();
    const maxPointSize = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];

    // Atlas ASCII rasterisé à ATLAS_SCALE x la taille device du glyphe (mipmaps : la taille
    // de base tombe sur un niveau exact, les glyphes grossis restent nets), régénéré au besoin
    let glyphs = null;
    const ensureGlyphs = (px) => {
      if (glyphs && glyphs.px === Math.max(2, Math.round(px))) return;
      if (glyphs) gl.deleteTexture(glyphs.tex);
      glyphs = createGlyphAtlas(gl, px);
    };

    const uniforms = (prg, names) =>
      Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prg, n)]));
    const simU = uniforms(simPrg, [
      "mouse", "power", "arrow", "dt", "scroll", "loopLength", "pitch", "roadTex",
    ]);
    const drawU = uniforms(drawPrg, [
      "resolution", "pointSize", "growAmount", "maxPointSize", "scroll", "loopLength", "pitch",
      "uAscii", "uAsciiInvert", "uGlyphs", "uGlyphCount", "uFlight", "uGps", "uArrow", "uHeading",
      "uBack", "uHorizon", "uAnchor", "uFill", "uRelief", "uRise0", "uRise1", "uNear", "uRef", "roadTex",
      "uMouse", "uHover", "uTime", "uReach", "uCore", "uRippleFreq", "uRippleSpeed", "uRippleAmp", "uSwirl", "uGrow",
      ...GRADE_UNIFORMS,
    ]);

    const blurPrg = createProgram(gl, BLIT_VS, BLUR_FS);
    const presentPrg = createProgram(gl, BLIT_VS, PRESENT_FS);
    const blitVao = gl.createVertexArray();
    const blurU = uniforms(blurPrg, ["uTex", "uTexel"]);
    const presentU = uniforms(presentPrg, [
      "uSharp", "uBlur", "uResolution", "uRect", "uRadius", "uCover", "uVeil", "uBlurOn",
    ]);
    gl.useProgram(blurPrg);
    gl.uniform1i(blurU.uTex, 1);
    gl.useProgram(presentPrg);
    gl.uniform1i(presentU.uSharp, 1);
    gl.uniform1i(presentU.uBlur, 3);

    const inkPrg = createProgram(gl, INK_VS, INK_FS);
    const inkU = uniforms(inkPrg, ["uResolution", "uFeather"]);
    const inkVao = gl.createVertexArray();
    const inkBuf = gl.createBuffer();
    gl.bindVertexArray(inkVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, inkBuf);
    gl.bufferData(gl.ARRAY_BUFFER, 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 24);
    gl.bindVertexArray(vao);
    let ink = new Float32Array(1 << 16);
    let inkN = 0;
    const inkVert = (x, y, color, out) => {
      const o = inkN * 7;
      if (o + 7 > ink.length) {
        const next = new Float32Array(ink.length * 2);
        next.set(ink);
        ink = next;
      }
      ink[o] = x;
      ink[o + 1] = y;
      ink[o + 2] = color[0];
      ink[o + 3] = color[1];
      ink[o + 4] = color[2];
      ink[o + 5] = color[3];
      ink[o + 6] = out;
      inkN += 1;
    };
    const arrowLight = hexRgb(lighten(SETTINGS.arrow, 0.45));
    const arrowDark = hexRgb(SETTINGS.arrow);

    const makeTarget = (w, h) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { tex, fbo, w, h };
    };
    const dropTarget = (target) => {
      if (!target) return;
      gl.deleteTexture(target.tex);
      gl.deleteFramebuffer(target.fbo);
    };
    let scene = null;
    let blurA = null;
    let blurB = null;
    const ensureTargets = (w, h) => {
      if (!scene || scene.w !== w || scene.h !== h) {
        dropTarget(scene);
        scene = makeTarget(w, h);
      }
      const bw = Math.max(1, w >> 1);
      const bh = Math.max(1, h >> 1);
      if (!blurA || blurA.w !== bw || blurA.h !== bh) {
        dropTarget(blurA);
        dropTarget(blurB);
        blurA = makeTarget(bw, bh);
        blurB = makeTarget(bw, bh);
      }
    };
    const rectData = new Float32Array(16);
    const radData = new Float32Array(4);
    const coverData = new Float32Array(4);

    // L'opacité CSS se multiplie le long des ancêtres. L'animation d'arrivée ou
    // de départ est sur un parent : sans ça, le flou du canvas reste plein
    // pendant que la vitre disparaît.
    const frostCover = (node) => {
      let cover = 1;
      for (let el = node; el; el = el.parentElement) {
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.contentVisibility === "hidden") return 0;
        cover *= Number(style.opacity);
        if (cover < 0.004) return 0;
      }
      return cover;
    };

    // Vrai si une animation CSS déplace ou efface une vitre (elle-même ou un ancêtre).
    const frostLive = () => {
      for (const anim of document.getAnimations()) {
        const el = anim.effect?.target;
        if (!el?.querySelector) continue;
        if (el.hasAttribute("data-frost") || el.querySelector("[data-frost]")) return true;
      }
      return false;
    };

    // Le flou des vitres et du haut de bande est peint ici. WindowServer ne reçoit
    // qu'une surface opaque, sans backdrop-filter à recalculer à chaque image.
    const present = (view, live) => {
      const w = canvas.width;
      const h = canvas.height;
      const sx = view.width > 0 ? w / view.width : 1;
      const sy = view.height > 0 ? h / view.height : 1;
      let count = 0;
      for (const node of document.querySelectorAll("[data-frost]")) {
        if (count >= 4) break;
        const box = node.getBoundingClientRect();
        if (box.width < 2 || box.height < 2) continue;
        const cover = frostCover(node);
        if (cover <= 0) continue;
        if (
          box.right <= view.left ||
          box.left >= view.right ||
          box.bottom <= view.top ||
          box.top >= view.bottom
        ) {
          continue;
        }
        const i = count * 4;
        rectData[i] = (box.left - view.left) * sx;
        rectData[i + 1] = (box.top - view.top) * sy;
        rectData[i + 2] = box.width * sx;
        rectData[i + 3] = box.height * sy;
        radData[count] = (parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0) * sx;
        coverData[count] = cover;
        count += 1;
      }
      for (let i = count; i < 4; i += 1) {
        rectData[i * 4 + 2] = 0;
        radData[i] = 0;
        coverData[i] = 0;
      }
      let veilSolid = -1;
      let veilGone = -1;
      if ((live?.veil ?? 0) > 0.5) {
        const raw = 220 + ((window.innerWidth - 390) * 297) / 1338;
        const veilH = Math.min(517, Math.max(200, raw));
        veilSolid = (veilH * 0.35 - view.top) * sy;
        veilGone = (veilH * 0.97 - view.top) * sy;
      }
      const blurOn = count > 0 || veilGone > 0;
      gl.bindVertexArray(blitVao);
      gl.disable(gl.BLEND);
      if (blurOn) {
        const sigma = FROST_SIGMA * sy;
        gl.useProgram(blurPrg);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindFramebuffer(gl.FRAMEBUFFER, blurA.fbo);
        gl.bindTexture(gl.TEXTURE_2D, scene.tex);
        gl.viewport(0, 0, blurA.w, blurA.h);
        gl.uniform2f(blurU.uTexel, sigma / w, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, blurB.fbo);
        gl.bindTexture(gl.TEXTURE_2D, blurA.tex);
        gl.viewport(0, 0, blurB.w, blurB.h);
        gl.uniform2f(blurU.uTexel, 0, sigma / h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(presentPrg);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, scene.tex);
      if (blurOn) {
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, blurB.tex);
      }
      gl.uniform2f(presentU.uResolution, w, h);
      gl.uniform4fv(presentU.uRect, rectData);
      gl.uniform1fv(presentU.uRadius, radData);
      gl.uniform1fv(presentU.uCover, coverData);
      gl.uniform2f(presentU.uVeil, veilSolid, veilGone);
      gl.uniform1i(presentU.uBlurOn, blurOn ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(vao);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    };

    const roadTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, roadTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.useProgram(simPrg);
    gl.uniform1i(simU.roadTex, 2);
    gl.useProgram(drawPrg);
    gl.uniform1i(drawU.roadTex, 2);

    // Alpha prémultiplié (glyphes ASCII) ; sans effet sur les points opaques
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const destroyState = () => {
      if (!state) return;
      [state.homeBuf, state.colorBuf, state.offsetBuf, ...state.grow].forEach((b) => gl.deleteBuffer(b));
      state = null;
    };

    let assignment = [];

    const build = (images, fit, dense = false) => {
      const measured = root.getBoundingClientRect();
      const width = fit?.w || measured.width;
      const height = fit?.h || measured.height;
      if (width < 2 || height < 2) return;
      const prev = state;
      destroyState();
      // Écran rétina : le buffer en dpr 2 quadruple les pixels peints à chaque image.
      // Le canvas CSS reste à la taille de la bande, le navigateur l'agrandit.
      const dpr = 1;
      // Changer canvas.width réinitialise l'état GL (blend, viewport) : on le restaure après.
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      // Tuiles carrées de la hauteur de la bande, assez nombreuses pour couvrir la largeur + 1
      const tile = height;
      const gap = tile * GAP_RATIO;
      const pitch = tile + gap;
      const tiles = Math.ceil(width / pitch) + 2;
      const loopLength = tiles * pitch;
      if (assignment.length !== tiles) assignment = shuffledAssignment(tiles);

      // Pas entre particules (px CSS) : réglage `cell`, ou auto (0) = ~1px device en points,
      // ASCII_AUTO_CELL en ASCII. Toujours borné par le budget MAX_PARTICLES et la taille max
      // des points GL. `size` = taille du point / glyphe en px CSS (0 = auto = le pas).
      const { ascii, cell, size } = SETTINGS;
      const budget = Math.max(1 / dpr, Math.sqrt((tiles * tile * tile) / MAX_PARTICLES));
      const rest = cell > 0 ? cell : ascii ? ASCII_AUTO_CELL : budget;
      // Plus serré seulement en vue GPS : la perspective écarte les points.
      const wanted = dense ? rest * 0.55 : rest;
      const step = Math.min(Math.max(wanted, budget), maxPointSize / dpr);
      const n = Math.max(1, Math.round(tile / step));
      const samples = images.map((img) => sampleColors(img, n, n));

      const count = tiles * n * n;
      const home = new Float32Array(count * 2);
      const color = new Float32Array(count * 3);
      const s = tile / n;
      let k = 0;
      for (let t = 0; t < tiles; t++) {
        const sample = samples[assignment[t] % samples.length];
        for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
            home[k * 2] = t * pitch + (x + 0.5) * s;
            home[k * 2 + 1] = (y + 0.5) * s;
            const si = (y * n + x) * 3;
            color[k * 3] = sample[si];
            color[k * 3 + 1] = sample[si + 1];
            color[k * 3 + 2] = sample[si + 2];
            k++;
          }
        }
      }

      const road =
        prev && prev.road && prev.loopLength === loopLength && Math.abs(prev.tile - tile) < 1
          ? prev.road
          : makeRoad(tile, loopLength);

      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, roadTex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R32F,
        ROAD_SAMPLES,
        1,
        0,
        gl.RED,
        gl.FLOAT,
        road.samples
      );

      // Taille entière en pixels device (évite les moirés entre cellules) ; l'atlas suit.
      // Peut dépasser le pas (points qui se chevauchent).
      const pointSize = Math.min(
        maxPointSize,
        Math.max(1, Math.ceil((size > 0 ? size : step) * dpr))
      );
      if (ascii) ensureGlyphs(pointSize * ATLAS_SCALE);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, roadTex);

      const zero = new Float32Array(count);
      state = {
        count,
        tile,
        pitch,
        loopLength,
        road,
        width,
        cell: s,
        pointSize,
        resolution: [width, height],
        dense,
        homeBuf: createVBO(gl, home),
        colorBuf: createVBO(gl, color),
        grow: [createVBO(gl, zero, gl.DYNAMIC_COPY), createVBO(gl, zero, gl.DYNAMIC_COPY)],
        offset: new Float32Array(count * 2),
        offsetBuf: createVBO(gl, new Float32Array(count * 2), gl.DYNAMIC_DRAW),
        homes: home,
        n,
        tiles,
        s,
        idx: 0,
      };
      scroll %= loopLength;
      contacts.clear();
    };

    // Même spline qu'au repos. Le relief et la vue GPS ne changent pas le tracé.
    const roadY = (x) => {
      const u = (x + scroll) / state.loopLength;
      return state.road.at((u - Math.floor(u)) * state.road.n);
    };

    const arrowPose = () => {
      const x = state.width * ARROW_X;
      const slope = (roadY(x + 1) - roadY(x - 1)) / 2;
      return { x, y: roadY(x), heading: Math.atan(slope) };
    };

    // Même projection que le shader : caméra derrière la flèche, route vers l'horizon.
    const project = (x, y, gps, arrow, flat = false) => {
      if (gps <= 0.001) return { x, y };
      const fx = Math.cos(arrow.heading);
      const fy = Math.sin(arrow.heading);
      const ahead = (x - arrow.x) * fx + (y - arrow.y) * fy;
      const lat = (x - arrow.x) * -fy + (y - arrow.y) * fx;
      const w = state.resolution[0];
      const h = state.resolution[1];
      const refH = bandRef(w);
      const back = Math.max(gpsTune.back, 0.05) * refH;
      const eye = Math.max(gpsTune.anchor, 0.02) * refH;
      const focal = Math.max(gpsTune.fill, 0.02) * w;
      const horizon = h * gpsTune.horizon;
      const nearDist = gpsTune.near * refH;
      const depth = Math.max(ahead + back, back - nearDist, 1);
      let mh = 0;
      if (!flat) {
        const road = roadY(x);
        const dist = Math.abs(y - road);
        const side = y < road ? -1 : 1;
        const ridge = 0.5 + 0.5 * Math.sin(x * 0.012 + side * 1.2);
        const range = 0.55 + 0.45 * Math.sin(x * 0.005 + 1.3);
        const span = Math.max(1, refH * gpsTune.riseEnd - refH * gpsTune.riseStart);
        const u = Math.min(1, Math.max(0, (dist - refH * gpsTune.riseStart) / span));
        const rise = u * u * (3 - 2 * u);
        mh = rise * (0.4 + 0.6 * ridge) * range * eye * gpsTune.relief;
      }
      const yScale = Math.max(1, h / Math.max(w * 0.8, 1));
      const px = w * 0.5 + (lat * focal) / depth;
      const py = (horizon + ((eye - mh) * focal) / depth) * yScale;
      return { x: x + (px - x) * gps, y: y + (py - y) * gps };
    };

    // Contour du glyphe, dans son plan local. Jamais relu sur le tracé projeté.
    const arrowOutline = (() => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", ARROW_D);
      const len = path.getTotalLength();
      const count = 72;
      const pts = [];
      for (let i = 0; i <= count; i++) {
        const point = path.getPointAtLength((i / count) * len);
        pts.push([point.x, point.y]);
      }
      return pts;
    })();

    // Même tracé qu'avant, peint dans la scène pour passer sous le flou des vitres.
    const paintMark = (gps, arrow, alpha) => {
      inkN = 0;
      if (alpha < 0.004 || !state) return;
      const morph = gps > 0.02 ? gps : 0;
      const roadColor = premul(hexRgb(SETTINGS.road), 0.94 * alpha);
      const fx = Math.cos(arrow.heading);
      const fy = Math.sin(arrow.heading);
      const backPx = Math.max(gpsTune.back, 0.05) * bandRef();
      const nearDist = bandRef() * gpsTune.near;
      let run = [];
      const flush = () => {
        if (run.length > 1) appendStroke(run, 4, roadColor, false, inkVert);
        run = [];
      };
      const step = morph > 0 ? 4 : 6;
      for (let x = -10; x <= state.width + 10; x += step) {
        const y = roadY(x);
        if (morph > 0) {
          const ahead = (x - arrow.x) * fx + (y - arrow.y) * fy;
          if (ahead + backPx <= 2 || (gps > 0.55 && ahead < -nearDist)) {
            flush();
            continue;
          }
        }
        const p = project(x, y, morph, arrow);
        const last = run[run.length - 1];
        if (last && Math.hypot(last.x - p.x, last.y - p.y) < 0.4) continue;
        run.push(p);
      }
      flush();

      const rot = arrow.heading + Math.PI / 2;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const shape = [];
      const shadow = [];
      for (let i = 0; i < arrowOutline.length - 1; i++) {
        const lx = arrowOutline[i][0];
        const ly = arrowOutline[i][1];
        const place = (oy) => {
          const x = lx * cos - (ly + oy) * sin;
          const y = lx * sin + (ly + oy) * cos;
          return project(arrow.x + x, arrow.y + y, morph, arrow, true);
        };
        const p = place(0);
        shape.push({ x: p.x, y: p.y, k: morph > 0 ? p.y : ly });
        if (morph === 0) {
          const s = place(2);
          shadow.push({ x: s.x, y: s.y, k: 0 });
        }
      }
      if (shadow.length > 2) appendFan(shadow, () => premul([0, 0, 0], 0.28 * alpha), inkVert);
      appendStroke(shape, 1.1, premul([1, 1, 1], alpha), true, inkVert);
      let minK = Infinity;
      let maxK = -Infinity;
      for (const p of shape) {
        minK = Math.min(minK, p.k);
        maxK = Math.max(maxK, p.k);
      }
      const spanK = maxK - minK || 1;
      const colorOf = (k) => {
        const t = (k - minK) / spanK;
        return premul(
          [
            arrowLight[0] + (arrowDark[0] - arrowLight[0]) * t,
            arrowLight[1] + (arrowDark[1] - arrowLight[1]) * t,
            arrowLight[2] + (arrowDark[2] - arrowLight[2]) * t,
          ],
          alpha
        );
      };
      appendFan(shape, colorOf, inkVert);

      if (inkN < 3) return;
      gl.bindVertexArray(inkVao);
      gl.useProgram(inkPrg);
      gl.uniform2f(inkU.uResolution, canvas.width, canvas.height);
      gl.uniform1f(inkU.uFeather, INK_FEATHER);
      gl.bindBuffer(gl.ARRAY_BUFFER, inkBuf);
      gl.bufferData(gl.ARRAY_BUFFER, ink.subarray(0, inkN * 7), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, inkN);
      gl.bindVertexArray(vao);
    };

    let images = null;
    let last = performance.now();
    const contacts = new Map();

    function stirLandscape(dt) {
      if (!state?.homes) return;
      const radius = Math.max(12, stepTune.core * 3);
      const cells = Math.max(2, Math.ceil((radius * 2.2) / state.s));
      const worldX = mouse.x + state.pitch + scroll;
      let xInLoop = worldX % state.loopLength;
      if (xInLoop < 0) xInLoop += state.loopLength;
      const tileIndex = Math.min(state.tiles - 1, Math.max(0, Math.floor(xInLoop / state.pitch)));
      const ix = Math.round((xInLoop - tileIndex * state.pitch) / state.s - 0.5);
      const iy = Math.round(mouse.y / state.s - 0.5);
      const around = [];
      for (let ty = iy - cells; ty <= iy + cells; ty++) {
        if (ty < 0 || ty >= state.n) continue;
        for (let tx = ix - cells; tx <= ix + cells; tx++) {
          let tt = tileIndex;
          let xx = tx;
          while (xx < 0) {
            tt -= 1;
            xx += state.n;
          }
          while (xx >= state.n) {
            tt += 1;
            xx -= state.n;
          }
          tt = (tt % state.tiles + state.tiles) % state.tiles;
          const index = (tt * state.n + ty) * state.n + xx;
          if (index >= 0 && index < state.count) around.push(index);
        }
      }
      const screenX = (index) => {
        let x = (state.homes[index * 2] - scroll) % state.loopLength;
        if (x < 0) x += state.loopLength;
        return x - state.pitch + state.offset[index * 2];
      };
      const screenY = (index) => state.homes[index * 2 + 1] + state.offset[index * 2 + 1];
      let touched = false;
      for (const index of around) {
        const dx = screenX(index) - mouse.x;
        const dy = screenY(index) - mouse.y;
        if (dx * dx + dy * dy > radius * radius) continue;
        let item = contacts.get(index);
        if (!item) {
          item = { vx: 0, vy: 0, cool: 0 };
          contacts.set(index, item);
        }
        item.cool -= dt;
        if (item.cool > 0) continue;
        const angle = Math.random() * Math.PI * 2;
        const mag = stepTune.rippleAmp * (7 + Math.random() * 9);
        const dist = Math.hypot(dx, dy) || 1;
        const side = (Math.random() - 0.5) * stepTune.swirl * 4;
        item.vx += Math.cos(angle) * mag + (dx / dist) * mag * 0.2 + (-dy / dist) * side;
        item.vy += Math.sin(angle) * mag + (dy / dist) * mag * 0.2 + (dx / dist) * side;
        item.cool = 0.16;
        touched = true;
      }
      if (touched) {
        const outer = radius * 2.1;
        for (const index of around) {
          if (contacts.has(index)) continue;
          const dx = screenX(index) - mouse.x;
          const dy = screenY(index) - mouse.y;
          if (dx * dx + dy * dy > outer * outer) continue;
          const angle = Math.random() * Math.PI * 2;
          const mag = stepTune.rippleAmp * (2 + Math.random() * 5);
          contacts.set(index, { vx: Math.cos(angle) * mag, vy: Math.sin(angle) * mag, cool: 0 });
        }
      }
      if (!contacts.size) return;
      const omega = 1.55;
      const zeta = 0.58;
      const damp = Math.exp(-dt * (1.15 + (1 - stepTune.decay) * 3));
      const list = [...contacts.keys()];
      for (const index of list) {
        const item = contacts.get(index);
        const ox = state.offset[index * 2];
        const oy = state.offset[index * 2 + 1];
        item.vx = (item.vx + (-ox * omega * omega - item.vx * 2 * zeta * omega) * dt) * damp;
        item.vy = (item.vy + (-oy * omega * omega - item.vy * 2 * zeta * omega) * dt) * damp;
        state.offset[index * 2] = ox + item.vx * dt;
        state.offset[index * 2 + 1] = oy + item.vy * dt;
      }
      const collideR = 2 + stepTune.grow * 3;
      const collideSq = collideR * collideR;
      const limit = Math.min(list.length, 700);
      for (let a = 0; a < limit; a++) {
        const i = list[a];
        const ix = screenX(i);
        const iy = screenY(i);
        for (let b = a + 1; b < limit; b++) {
          const j = list[b];
          const dx = screenX(j) - ix;
          const dy = screenY(j) - iy;
          const distSq = dx * dx + dy * dy;
          if (distSq >= collideSq || distSq < 1e-4) continue;
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;
          const push = (collideR - dist) * 0.5;
          state.offset[i * 2] -= nx * push;
          state.offset[i * 2 + 1] -= ny * push;
          state.offset[j * 2] += nx * push;
          state.offset[j * 2 + 1] += ny * push;
          const vi = contacts.get(i);
          const vj = contacts.get(j);
          const rel = (vi.vx - vj.vx) * nx + (vi.vy - vj.vy) * ny;
          if (rel > 0) {
            vi.vx -= rel * nx * 0.6;
            vi.vy -= rel * ny * 0.6;
            vj.vx += rel * nx * 0.6;
            vj.vy += rel * ny * 0.6;
          }
        }
      }
      for (const index of list) {
        const ox = state.offset[index * 2];
        const oy = state.offset[index * 2 + 1];
        const item = contacts.get(index);
        if (ox * ox + oy * oy < 0.08 && item.vx * item.vx + item.vy * item.vy < 6) {
          state.offset[index * 2] = 0;
          state.offset[index * 2 + 1] = 0;
          contacts.delete(index);
        }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, state.offsetBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, state.offset);
    }

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const live = motionRef.current?.current;
      if (gpsTune.permanent && live) {
        live.gps = gpsTune.gps;
        live.rush = gpsTune.rush;
        live.flight = 0;
        live.detail = gpsTune.dense;
        live.interactive = gpsTune.gps < 0.04;
        live.held = true;
      } else if (live?.held) {
        live.gps = 0;
        live.rush = 1;
        live.flight = 0;
        live.detail = false;
        live.interactive = true;
        live.held = false;
      }
      if (live?.target && images) {
        const target = live.target;
        live.target = null;
        const dense = !!live.detail;
        if (
          !state ||
          Math.abs(target.w - state.resolution[0]) > 1 ||
          Math.abs(target.h - state.resolution[1]) > 1 ||
          dense !== !!state.dense
        ) {
          build(images, target, dense);
        }
      } else if (state && images && !!live?.detail !== !!state.dense) {
        build(images, { w: state.resolution[0], h: state.resolution[1] }, !!live.detail);
      }
      if (!state) return;
      const view = root.getBoundingClientRect();
      if (view.width < 2 || view.height < 2) return;
      syncPointer();
      const gpsNow = live?.gps ?? 0;
      if (gpsNow < 0.02 && mouse.power < 0.05 && contacts.size === 0 && now - last < 32) {
        // La simulation reste à 30 Hz au repos, mais le masque de flou suit
        // l'animation CSS de la vitre à chaque image.
        if (scene && frostLive()) present(view, live);
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const flight = live?.flight ?? 0;
      const rush = live?.rush ?? 1;
      const gps = live?.gps ?? 0;
      if (!mouse.inside) mouse.power *= 0.95;
      const markAlpha =
        gps > 0.02 ? Math.min(1, gps) : Math.max(0, 1 - flight / 0.18);
      scroll = (scroll + SPEED * rush * dt) % state.loopLength;

      const src = state.idx;
      const dst = 1 - src;
      state.idx = dst;

      // GPGPU : simulation via transform feedback
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, roadTex);
      gl.useProgram(simPrg);
      bindAttrib(gl, 0, state.homeBuf, 2);
      bindAttrib(gl, 1, state.grow[src], 1);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, state.grow[dst]);
      gl.enable(gl.RASTERIZER_DISCARD);
      gl.beginTransformFeedback(gl.POINTS);
      const arrow = arrowPose();
      const pointer = live?.interactive !== false && flight < 0.04 && gps < 0.04;
      gl.uniform2f(simU.mouse, mouse.x, mouse.y);
      gl.uniform1f(simU.power, pointer ? mouse.power : 0);
      gl.uniform2f(simU.arrow, arrow.x, arrow.y);
      gl.uniform1f(simU.dt, dt);
      gl.uniform1f(simU.scroll, scroll);
      gl.uniform1f(simU.loopLength, state.loopLength);
      gl.uniform1f(simU.pitch, state.pitch);
      gl.drawArrays(gl.POINTS, 0, state.count);
      gl.endTransformFeedback();
      gl.disable(gl.RASTERIZER_DISCARD);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

      // Rendu hors écran. Le fond est blanc : avec un canvas opaque, WindowServer
      // n'a plus à mélanger la surface avec la page à chaque image.
      ensureTargets(canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, roadTex);
      gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
      gl.viewport(0, 0, scene.w, scene.h);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(drawPrg);
      bindAttrib(gl, 0, state.homeBuf, 2);
      bindAttrib(gl, 1, state.grow[dst], 1);
      bindAttrib(gl, 3, state.colorBuf, 3);
      gl.uniform2f(drawU.resolution, state.resolution[0], state.resolution[1]);
      const yScale = Math.max(1, state.resolution[1] / Math.max(state.resolution[0] * 0.8, 1));
      gl.uniform1f(drawU.pointSize, state.pointSize * (1 + (Math.sqrt(yScale) - 1) * gps));
      gl.uniform1f(drawU.growAmount, GROW);
      gl.uniform1f(drawU.maxPointSize, maxPointSize);
      gl.uniform1f(drawU.scroll, scroll);
      gl.uniform1f(drawU.loopLength, state.loopLength);
      gl.uniform1f(drawU.pitch, state.pitch);
      gl.uniform1f(drawU.uFlight, flight);
      gl.uniform1f(drawU.uGps, gps);
      gl.uniform2f(drawU.uArrow, arrow.x, arrow.y);
      gl.uniform1f(drawU.uHeading, arrow.heading);
      gl.uniform1f(drawU.uBack, gpsTune.back);
      gl.uniform1f(drawU.uHorizon, gpsTune.horizon);
      gl.uniform1f(drawU.uAnchor, gpsTune.anchor);
      gl.uniform1f(drawU.uFill, gpsTune.fill);
      gl.uniform1f(drawU.uRelief, gpsTune.relief);
      gl.uniform1f(drawU.uRise0, gpsTune.riseStart);
      gl.uniform1f(drawU.uRise1, gpsTune.riseEnd);
      gl.uniform1f(drawU.uNear, gpsTune.near);
      gl.uniform1f(drawU.uRef, bandRef(state.resolution[0]));
      gl.uniform2f(drawU.uMouse, mouse.x, mouse.y);
      gl.uniform1f(drawU.uHover, mouse.power);
      gl.uniform1f(drawU.uTime, now / 1000);
      gl.uniform1f(drawU.uReach, stepTune.reach);
      gl.uniform1f(drawU.uCore, stepTune.core);
      gl.uniform1f(drawU.uRippleFreq, stepTune.rippleFreq);
      gl.uniform1f(drawU.uRippleSpeed, stepTune.rippleSpeed);
      gl.uniform1f(drawU.uRippleAmp, stepTune.rippleAmp);
      gl.uniform1f(drawU.uSwirl, stepTune.swirl);
      gl.uniform1f(drawU.uGrow, stepTune.grow);
      setGradeUniforms(gl, drawU, SETTINGS, state.cell);
      const { ascii } = SETTINGS;
      gl.uniform1i(drawU.uAscii, ascii ? 1 : 0);
      if (ascii) {
        gl.uniform1f(drawU.uAsciiInvert, SETTINGS.asciiInvert ? 1 : 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, glyphs.tex);
        gl.uniform1i(drawU.uGlyphs, 0);
        gl.uniform1f(drawU.uGlyphCount, glyphs.count);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, state.offsetBuf);
      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.POINTS, 0, state.count);
      paintMark(gps, arrow, markAlpha);
      present(view, live);

      if (mouse.power > 0.02 || contacts.size) stirLandscape(dt);
    };

    // Écoute au niveau de la fenêtre : la zone de dépôt, le voile flouté et les textes passent
    // au-dessus de la bande et intercepteraient sinon les événements du pointeur.
    const onMove = (e) => {
      cursor.x = e.clientX;
      cursor.y = e.clientY;
      syncPointer();
      if (mouse.inside) mouse.power = 1;
    };
    const onLeave = () => {
      cursor.x = -1e4;
      cursor.y = -1e4;
      mouse.inside = false;
    };

    const onResize = () => images && build(images, null, !!motionRef.current?.current?.detail);

    Promise.all(LANDSCAPES.map(loadImage)).then((imgs) => {
      if (disposed) return;
      images = imgs;
      build(images);
      window.addEventListener("pointermove", onMove);
      document.documentElement.addEventListener("pointerleave", onLeave);
      window.addEventListener("resize", onResize);
      raf = requestAnimationFrame(frame);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      destroyState();
      if (glyphs) gl.deleteTexture(glyphs.tex);
      gl.deleteTexture(roadTex);
      gl.deleteTransformFeedback(tf);
      gl.deleteProgram(simPrg);
      gl.deleteProgram(drawPrg);
      gl.deleteProgram(blurPrg);
      gl.deleteProgram(presentPrg);
      gl.deleteProgram(inkPrg);
      gl.deleteBuffer(inkBuf);
      gl.deleteVertexArray(inkVao);
      dropTarget(scene);
      dropTarget(blurA);
      dropTarget(blurB);
      gl.deleteVertexArray(vao);
      gl.deleteVertexArray(blitVao);
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.root}>
      <canvas ref={canvasRef} className={styles.layer} />
    </div>
  );
}
