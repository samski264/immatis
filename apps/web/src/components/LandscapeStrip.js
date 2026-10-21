"use client";

import { useEffect, useRef } from "react";
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

// Position affichée d'une particule : sa tuile défile et boucle sur la longueur totale.
// Route : spline échantillonnée sur la boucle, lue avec interpolation linéaire.
const SCROLL_GLSL = `
uniform float scroll;
uniform float loopLength;
uniform float pitch;
uniform vec4 roadPts[${ROAD_SAMPLES / 4}];
vec2 scrolled(vec2 h) {
  return vec2(mod(h.x - scroll, loopLength) - pitch, h.y);
}
float roadY(float x) {
  float u = fract((x + scroll) / loopLength) * ${ROAD_SAMPLES}.0;
  int i = int(u);
  int j = (i + 1) % ${ROAD_SAMPLES};
  return mix(roadPts[i >> 2][i & 3], roadPts[j >> 2][j & 3], u - float(i));
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

uniform vec2 resolution;
uniform float pointSize;
uniform float growAmount;
uniform float maxPointSize;
uniform float uFlight; // 0 = vue de dessus, 1 = caméra plongée sur le plan
${SCROLL_GLSL}
${GRADE_GLSL}

out vec3 vColor;
out float vLuma;
out float vThreshold;

void main() {
  vec2 p = scrolled(home);
  vec2 ndc = vec2(p.x / resolution.x * 2.0 - 1.0, 1.0 - p.y / resolution.y * 2.0);

  // Le plan des tuiles bascule autour de X : le haut s'éloigne, le bas se rapproche.
  // À uFlight = 0 le mix rend exactement la projection orthographique d'origine.
  float pitch = uFlight * 1.15;
  float lift = grow * 0.14 * uFlight;
  float y = ndc.y * cos(pitch) + lift;
  float z = ndc.y * sin(pitch) + 2.35;
  float w = clamp(2.35 / max(z, 0.72), 0.4, 2.35);
  vec2 persp = vec2(ndc.x * w, y * w + uFlight * 0.06);
  gl_Position = vec4(mix(ndc, persp, uFlight), 0.0, 1.0);
  gl_PointSize = min(pointSize * (1.0 + grow * growAmount) * mix(1.0, w, uFlight), maxPointSize);
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
    const mouse = { x: -1e4, y: -1e4, power: 0, inside: false };

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
      "mouse", "power", "arrow", "dt", "scroll", "loopLength", "pitch", "roadPts",
    ]);
    const drawU = uniforms(drawPrg, [
      "resolution", "pointSize", "growAmount", "maxPointSize", "scroll", "loopLength", "pitch",
      "uAscii", "uAsciiInvert", "uGlyphs", "uGlyphCount", "uFlight",
      ...GRADE_UNIFORMS,
    ]);

    // Alpha prémultiplié (glyphes ASCII) ; sans effet sur les points opaques
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const destroyState = () => {
      if (!state) return;
      [state.homeBuf, state.colorBuf, ...state.grow].forEach((b) => gl.deleteBuffer(b));
      state = null;
    };

    let assignment = [];

    const build = (images, fit) => {
      const measured = root.getBoundingClientRect();
      const width = fit?.w || measured.width;
      const height = fit?.h || measured.height;
      if (width < 2 || height < 2) return;
      destroyState();
      const dpr = window.devicePixelRatio || 1;
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
      const wanted = cell > 0 ? cell : ascii ? ASCII_AUTO_CELL : budget;
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

      const road = makeRoad(tile, loopLength);

      // Taille entière en pixels device (évite les moirés entre cellules) ; l'atlas suit.
      // Peut dépasser le pas (points qui se chevauchent).
      const pointSize = Math.min(
        maxPointSize,
        Math.max(1, Math.ceil((size > 0 ? size : step) * dpr))
      );
      if (ascii) ensureGlyphs(pointSize * ATLAS_SCALE);

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
        homeBuf: createVBO(gl, home),
        colorBuf: createVBO(gl, color),
        grow: [createVBO(gl, zero, gl.DYNAMIC_COPY), createVBO(gl, zero, gl.DYNAMIC_COPY)],
        idx: 0,
      };
      scroll %= loopLength;
    };

    // Route (coordonnées écran) : spline exacte côté JS, version échantillonnée côté shader
    const roadY = (x) => {
      const u = (x + scroll) / state.loopLength;
      return state.road.at((u - Math.floor(u)) * state.road.n);
    };

    // Position et cap de la flèche (angle en degrés, 0 = vers la droite)
    const arrowPose = () => {
      const x = state.width * ARROW_X;
      const slope = (roadY(x + 1) - roadY(x - 1)) / 2;
      return { x, y: roadY(x), angle: (Math.atan(slope) * 180) / Math.PI };
    };

    const updateRoad = () => {
      const pts = [];
      for (let x = -10; x <= state.width + 10; x += 4) {
        pts.push(`${x.toFixed(1)},${roadY(x).toFixed(1)}`);
      }
      roadRef.current.setAttribute("d", `M${pts.join(" L")}`);

      const { x, y, angle } = arrowPose();
      // la flèche SVG pointe vers le haut -> +90° pour l'aligner sur le cap
      // taille fixe (path ~28px) — ne pas scaler avec la tuile
      arrowRef.current.setAttribute(
        "transform",
        `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(angle + 90).toFixed(1)})`
      );
    };

    let images = null;
    let last = performance.now();
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const live = motionRef.current?.current;
      if (live?.target && images) {
        const target = live.target;
        live.target = null;
        if (
          !state ||
          Math.abs(target.w - state.resolution[0]) > 1 ||
          Math.abs(target.h - state.resolution[1]) > 1
        ) {
          build(images, target);
        }
      }
      if (!state) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const flight = live?.flight ?? 0;
      const rush = live?.rush ?? 1;
      if (!mouse.inside) mouse.power *= 0.95;
      if (svgRef.current) svgRef.current.style.opacity = String(Math.max(0, 1 - flight / 0.18));
      scroll = (scroll + SPEED * rush * dt) % state.loopLength;

      const src = state.idx;
      const dst = 1 - src;
      state.idx = dst;

      // GPGPU : simulation via transform feedback
      gl.useProgram(simPrg);
      bindAttrib(gl, 0, state.homeBuf, 2);
      bindAttrib(gl, 1, state.grow[src], 1);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, state.grow[dst]);
      gl.enable(gl.RASTERIZER_DISCARD);
      gl.beginTransformFeedback(gl.POINTS);
      const arrow = arrowPose();
      const pointer = live?.interactive !== false && flight < 0.04;
      gl.uniform2f(simU.mouse, mouse.x, mouse.y);
      gl.uniform1f(simU.power, pointer ? mouse.power : 0);
      gl.uniform2f(simU.arrow, arrow.x, arrow.y);
      gl.uniform1f(simU.dt, dt);
      gl.uniform1f(simU.scroll, scroll);
      gl.uniform1f(simU.loopLength, state.loopLength);
      gl.uniform1f(simU.pitch, state.pitch);
      gl.uniform4fv(simU.roadPts, state.road.samples);
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
      gl.drawArrays(gl.POINTS, 0, state.count);

      updateRoad();
    };

    // Écoute au niveau de la fenêtre : la zone de dépôt, le voile flouté et les textes passent
    // au-dessus de la bande et intercepteraient sinon les événements du pointeur.
    const onMove = (e) => {
      const rect = root.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      // marge = rayon du champ du pointeur dans SIM_VS, pour un halo continu aux bords
      const m = 90;
      mouse.inside =
        mouse.x >= -m && mouse.y >= -m && mouse.x <= rect.width + m && mouse.y <= rect.height + m;
      if (mouse.inside) mouse.power = 1;
    };
    const onLeave = () => {
      mouse.inside = false;
    };

    const onResize = () => images && build(images);

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
