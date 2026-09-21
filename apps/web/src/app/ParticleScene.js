"use client";

import { useEffect, useRef } from "react";
import styles from "./ParticleScene.module.css";
import {
  DEFAULT_GRADE,
  DISCARD_FS,
  GRADED_FS,
  GRADE_GLSL,
  GRADE_UNIFORMS,
  bindAttrib,
  createGlyphAtlas,
  createProgram,
  createVBO,
  monoPalette,
  setGradeUniforms,
} from "./lib/particles";
import { SCENES } from "./lib/stepScenes";

// Scène animée (lib/stepScenes) rendue avec le même système de particules tramées que la
// bande de paysages (LandscapeStrip), en monochrome : la scène est dessinée chaque image en
// niveaux de gris dans un canvas 2D à la résolution de la grille, envoyée en texture, et
// chaque particule lit sa cellule. Rampe de `ink` (encre) vers `background` (fond) indexée par
// la luminance : le blanc de la scène se fond dans le fond du bloc. Le pointeur (écouté sur
// l'élément parent) grossit les glyphes.

const SETTINGS = {
  ...DEFAULT_GRADE,
  saturation: 1,
  contrast: 1,
  brightness: 0,
  ascii: true,
  cell: 1.5, // pas entre particules (px CSS), comme la bande
  size: 1.5, // taille du glyphe (px CSS)
  dither: 0.35,
};

const LEVELS = 5; // nombre de tons de la rampe monochrome
const GROW = 2.0; // grossissement ajouté par unité de grow (pointeur => 3x)
const ATLAS_SCALE = 4; // atlas ASCII rendu à 4x la taille de base (puissance de 2 >= 1 + GROW)
const RADIUS = 70; // rayon d'influence du pointeur (px CSS)
const SCENE_WIDTH = 100; // largeur du repère des scènes (unités)

const SIM_VS = `#version 300 es
layout(location = 0) in vec2 home;
layout(location = 1) in float grow;

uniform vec2 mouse;
uniform float power;
uniform float radius;
uniform float dt;

out float vGrow;

void main() {
  float target = smoothstep(radius, 0.0, length(home - mouse)) * power;
  float k = target > grow ? 14.0 : 5.0;
  vGrow = grow + (target - grow) * min(1.0, k * dt);
}`;

const DRAW_VS = `#version 300 es
layout(location = 0) in vec2 home;
layout(location = 1) in float grow;

uniform vec2 resolution;
uniform float pointSize;
uniform float growAmount;
uniform float maxPointSize;
uniform sampler2D uSource; // scène en niveaux de gris, une cellule par particule
uniform int uCols;
${GRADE_GLSL}

out vec3 vColor;
out float vLuma;
out float vThreshold;

void main() {
  vec2 clip = home / resolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = min(pointSize * (1.0 + grow * growAmount), maxPointSize);
  vec3 color = texelFetch(uSource, ivec2(gl_VertexID % uCols, gl_VertexID / uCols), 0).rgb;
  vec3 a = adjust(color);
  float t = bayer(home);
  vColor = quantize(a, t);
  vLuma = dot(a, LUMA);
  vThreshold = t;
}`;

export default function ParticleScene({
  scene,
  ink = "#000",
  background = "#fff",
  className,
}) {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const paletteRef = useRef(null);
  paletteRef.current = monoPalette(ink, background, LEVELS);

  useEffect(() => {
    const draw = SCENES[scene];
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const hover = root.parentElement ?? root; // zone d'écoute du pointeur : le bloc entier
    const gl = canvas.getContext("webgl2", { antialias: false });
    if (!gl || !draw) return;

    let raf = 0;
    let state = null;
    let glyphs = null;
    let visible = true;
    const mouse = { x: -1e4, y: -1e4, power: 0, inside: false };

    // Canvas 2D hors écran où la scène est dessinée à la résolution de la grille
    const off = document.createElement("canvas");
    const offCtx = off.getContext("2d");

    const simPrg = createProgram(gl, SIM_VS, DISCARD_FS, ["vGrow"]);
    const drawPrg = createProgram(gl, DRAW_VS, GRADED_FS);
    const tf = gl.createTransformFeedback();
    const maxPointSize = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];

    const source = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    const uniforms = (prg, names) =>
      Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prg, n)]));
    const simU = uniforms(simPrg, ["mouse", "power", "radius", "dt"]);
    const drawU = uniforms(drawPrg, [
      "resolution", "pointSize", "growAmount", "maxPointSize", "uSource", "uCols",
      "uAscii", "uAsciiInvert", "uGlyphs", "uGlyphCount",
      ...GRADE_UNIFORMS,
    ]);

    // Alpha prémultiplié (glyphes ASCII)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const ensureGlyphs = (px) => {
      if (glyphs && glyphs.px === Math.max(2, Math.round(px))) return;
      if (glyphs) gl.deleteTexture(glyphs.tex);
      glyphs = createGlyphAtlas(gl, px);
    };

    const destroyState = () => {
      if (!state) return;
      [state.homeBuf, ...state.grow].forEach((b) => gl.deleteBuffer(b));
      state = null;
    };

    const build = () => {
      destroyState();
      const rect = root.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);

      // Pas entre particules : réglage `cell`, borné à 1px device et à la taille max des points
      const step = Math.min(Math.max(SETTINGS.cell, 1 / dpr), maxPointSize / dpr);
      const cols = Math.max(1, Math.round(rect.width / step));
      const rows = Math.max(1, Math.round(rect.height / step));
      off.width = cols;
      off.height = rows;

      const count = cols * rows;
      const home = new Float32Array(count * 2);
      const sx = rect.width / cols;
      const sy = rect.height / rows;
      let k = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          home[k * 2] = (x + 0.5) * sx;
          home[k * 2 + 1] = (y + 0.5) * sy;
          k++;
        }
      }

      // Taille entière en pixels device (évite les moirés) ; l'atlas suit
      const pointSize = Math.min(maxPointSize, Math.max(1, Math.ceil(SETTINGS.size * dpr)));
      ensureGlyphs(pointSize * ATLAS_SCALE);

      state = {
        count,
        cols,
        rows,
        cell: sx,
        pointSize,
        resolution: [rect.width, rect.height],
        homeBuf: createVBO(gl, home),
        grow: [
          createVBO(gl, new Float32Array(count), gl.DYNAMIC_COPY),
          createVBO(gl, new Float32Array(count), gl.DYNAMIC_COPY),
        ],
        idx: 0,
      };
    };

    // Dessine la scène à l'instant `time` dans le canvas 2D et l'envoie en texture
    const renderScene = (time) => {
      const { cols, rows } = state;
      const scale = cols / SCENE_WIDTH;
      offCtx.setTransform(1, 0, 0, 1, 0, 0);
      offCtx.globalAlpha = 1;
      offCtx.fillStyle = "#fff";
      offCtx.fillRect(0, 0, cols, rows);
      offCtx.setTransform(scale, 0, 0, scale, 0, 0);
      draw(offCtx, time, rows / scale);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, source);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
    };

    const start = performance.now();
    let last = start;
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (!state || !visible) {
        last = now;
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!mouse.inside) mouse.power *= 0.95;

      renderScene((now - start) / 1000);

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
      gl.uniform2f(simU.mouse, mouse.x, mouse.y);
      gl.uniform1f(simU.power, mouse.power);
      gl.uniform1f(simU.radius, RADIUS);
      gl.uniform1f(simU.dt, dt);
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
      gl.uniform2f(drawU.resolution, state.resolution[0], state.resolution[1]);
      gl.uniform1f(drawU.pointSize, state.pointSize);
      gl.uniform1f(drawU.growAmount, GROW);
      gl.uniform1f(drawU.maxPointSize, maxPointSize);
      gl.uniform1i(drawU.uCols, state.cols);
      setGradeUniforms(gl, drawU, { ...SETTINGS, palette: paletteRef.current }, state.cell);
      gl.uniform1i(drawU.uAscii, 1);
      gl.uniform1f(drawU.uAsciiInvert, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, glyphs.tex);
      gl.uniform1i(drawU.uGlyphs, 0);
      gl.uniform1f(drawU.uGlyphCount, glyphs.count);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, source);
      gl.uniform1i(drawU.uSource, 1);
      gl.drawArrays(gl.POINTS, 0, state.count);
    };

    // Coordonnées du pointeur relatives au canvas, même quand il est hors de la scène
    const onMove = (e) => {
      const rect = root.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.inside = true;
      mouse.power = 1;
    };
    const onLeave = () => {
      mouse.inside = false;
    };

    const resizeObserver = new ResizeObserver(build);
    // Pas de rendu quand le bloc est hors écran
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });

    build();
    resizeObserver.observe(root);
    visibility.observe(root);
    hover.addEventListener("pointermove", onMove);
    hover.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      visibility.disconnect();
      hover.removeEventListener("pointermove", onMove);
      hover.removeEventListener("pointerleave", onLeave);
      destroyState();
      if (glyphs) gl.deleteTexture(glyphs.tex);
      gl.deleteTexture(source);
      gl.deleteTransformFeedback(tf);
      gl.deleteProgram(simPrg);
      gl.deleteProgram(drawPrg);
    };
  }, [scene]);

  return (
    <div ref={rootRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
