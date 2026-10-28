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

// Même courbe que la bande CSS : 200px à 390 de large, 413px à 1728, linéaire entre les deux.
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
    vec2 gpsPx = vec2(resolution.x * 0.5 + lat * focal / depth, horizon + (eye - mh) * focal / depth);
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
  const roadRef = useRef(null);
  const arrowRef = useRef(null);
  const svgRef = useRef(null);
  // `motion` est un ref stable tenu par RouteStage : la boucle lit flight / rush sans re-render
  const motionRef = useRef(motion);
  motionRef.current = motion;

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl2", { antialias: false });
    if (!gl) return;

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
      paintRestRoad();
      // Le buffer est parfois plus petit que la boîte CSS (vol plein écran) : le
      // canvas est étiré. Le même viewBox étire la flèche et le tracé avec lui,
      // sinon le pointeur reste dans le coin au lieu du centre de la vue.
      if (svgRef.current) {
        svgRef.current.setAttribute("viewBox", `0 0 ${width} ${height}`);
        svgRef.current.setAttribute("preserveAspectRatio", "none");
      }
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
      const px = w * 0.5 + (lat * focal) / depth;
      const py = horizon + ((eye - mh) * focal) / depth;
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

    // Au repos le tracé ne change pas : on le pose une fois et on le translate.
    let restRoad = "";
    let resting = false;
    const paintRestRoad = () => {
      if (!state || !roadRef.current) return;
      const pts = [];
      const span = state.loopLength + state.width;
      for (let x = 0; x <= span; x += 8) {
        const u = x / state.loopLength;
        const y = state.road.at((u - Math.floor(u)) * state.road.n);
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      restRoad = `M${pts.join(" L")}`;
      roadRef.current.setAttribute("d", restRoad);
      resting = true;
    };

    const updateRoad = (gps, arrow) => {
      if (gps <= 0.02) {
        const shift = scroll % state.loopLength;
        roadRef.current.setAttribute("transform", `translate(${(-shift).toFixed(1)} 0)`);
        if (!resting) {
          roadRef.current.setAttribute("d", restRoad);
          arrowRef.current.querySelector("path").setAttribute("d", ARROW_D);
          resting = true;
        }
        const flat = (arrow.heading * 180) / Math.PI + 90;
        arrowRef.current.setAttribute(
          "transform",
          `translate(${arrow.x.toFixed(1)} ${arrow.y.toFixed(1)}) rotate(${flat.toFixed(1)})`
        );
        return;
      }
      resting = false;
      roadRef.current.setAttribute("transform", "");
      const fx = Math.cos(arrow.heading);
      const fy = Math.sin(arrow.heading);
      const backPx = Math.max(gpsTune.back, 0.05) * bandRef();
      const nearDist = bandRef() * gpsTune.near;
      // Devant la caméra, la profondeur est bornée à 1 px : le point part
      // hors du sol. On ne le relie pas, sinon le trait quitte le plan GPS.
      const parts = [];
      let run = [];
      const flush = () => {
        if (run.length > 1) parts.push(`M${run.join(" L")}`);
        run = [];
      };
      for (let x = -10; x <= state.width + 10; x += 4) {
        const y = roadY(x);
        const ahead = (x - arrow.x) * fx + (y - arrow.y) * fy;
        if (ahead + backPx <= 2 || (gps > 0.55 && ahead < -nearDist)) {
          flush();
          continue;
        }
        const p = project(x, y, gps, arrow);
        run.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      }
      flush();
      if (parts.length) roadRef.current.setAttribute("d", parts.join(" "));

      const arrowPath = arrowRef.current.querySelector("path");
      const outline = arrowOutline;
      // La flèche reste dans le plan de la route : latéral et avance au sol,
      // sans le relief des bas-côtés. Même caméra que les particules.
      const rot = arrow.heading + Math.PI / 2;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const shape = outline.map(([lx, ly]) => {
        const x = lx * cos - ly * sin;
        const y = lx * sin + ly * cos;
        const p = project(arrow.x + x, arrow.y + y, gps, arrow, true);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      });
      arrowPath.setAttribute("d", `M${shape.join(" L")} Z`);
      arrowRef.current.setAttribute("transform", "");
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
      syncPointer();
      const gpsNow = live?.gps ?? 0;
      if (gpsNow < 0.02 && mouse.power < 0.05 && contacts.size === 0 && now - last < 32) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const flight = live?.flight ?? 0;
      const rush = live?.rush ?? 1;
      const gps = live?.gps ?? 0;
      if (!mouse.inside) mouse.power *= 0.95;
      if (svgRef.current) {
        svgRef.current.style.transform = "";
        svgRef.current.style.opacity =
          gps > 0.02 ? String(Math.min(1, gps)) : String(Math.max(0, 1 - flight / 0.18));
        svgRef.current.classList.toggle(styles.gps, gps > 0.2);
      }
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

      // Rendu
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(drawPrg);
      bindAttrib(gl, 0, state.homeBuf, 2);
      bindAttrib(gl, 1, state.grow[dst], 1);
      bindAttrib(gl, 3, state.colorBuf, 3);
      gl.uniform2f(drawU.resolution, state.resolution[0], state.resolution[1]);
      gl.uniform1f(drawU.pointSize, state.pointSize);
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

      if (mouse.power > 0.02 || contacts.size) stirLandscape(dt);
      updateRoad(gps, arrow);
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
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={styles.root}
      style={{
        "--road-color": SETTINGS.road,
        "--arrow-color": SETTINGS.arrow,
        "--arrow-light": lighten(SETTINGS.arrow, 0.45),
      }}
    >
      <canvas ref={canvasRef} className={styles.layer} />
      <svg ref={svgRef} className={styles.layer} aria-hidden="true">
        <path ref={roadRef} className={styles.road} />
        {/* Flèche de navigation façon Apple Plans : pointe vers le haut, orientée selon le cap */}
        <defs>
          <linearGradient id="arrowFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--arrow-light)" }} />
            <stop offset="1" style={{ stopColor: "var(--arrow-color)" }} />
          </linearGradient>
        </defs>
        <g ref={arrowRef} className={styles.arrow}>
          <path
            d="M0 -14 C1.2 -14 2.2 -13.2 2.8 -11.9 L12.2 8.2 C13.2 10.4 11.1 12.8 8.8 11.8 L1.2 8.4 C0.4 8.1 -0.4 8.1 -1.2 8.4 L-8.8 11.8 C-11.1 12.8 -13.2 10.4 -12.2 8.2 L-2.8 -11.9 C-2.2 -13.2 -1.2 -14 0 -14 Z"
            fill="url(#arrowFill)"
          />
        </g>
      </svg>
    </div>
  );
}
