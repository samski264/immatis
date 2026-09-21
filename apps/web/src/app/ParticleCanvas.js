"use client";

import { useEffect, useRef } from "react";
import {
  DISCARD_FS,
  DRAW_FS,
  LANDSCAPES,
  bindAttrib,
  createProgram,
  createVBO,
  loadImage,
  sampleDithered,
  shuffledAssignment,
} from "./lib/particles";

// Port 2D de https://github.com/code4fukui/webgl2-gpgpu-test :
// particules GPGPU (transform feedback WebGL2) formant chaque paysage d'une grille
// de cases [data-landscape], repoussées par le pointeur puis rappelées vers leur origine.

const MAX_PARTICLES = 3_600_000; // budget total, le pas des particules s'adapte à la taille des cases

const SIM_VS = `#version 300 es
layout(location = 0) in vec2 home;
layout(location = 1) in vec2 position;
layout(location = 2) in vec2 velocity;

uniform vec2 mouse;
uniform float power;
uniform float dt;

out vec2 vPosition;
out vec2 vVelocity;

void main() {
  // ressort vers la position d'origine
  vec2 acc = (home - position) * 60.0;

  // champ de force répulsif autour du pointeur (déplacement max ~6px)
  vec2 d = home - mouse;
  float dist = length(d);
  float infl = power * smoothstep(90.0, 0.0, dist);
  acc += d / max(dist, 1.0) * infl * 400.0;

  vec2 vel = (velocity + acc * dt) * (1.0 - 8.0 * dt);
  vPosition = position + vel * dt;
  vVelocity = vel;
}`;

const DRAW_VS = `#version 300 es
layout(location = 1) in vec2 position;
layout(location = 3) in vec3 color;

uniform vec2 resolution;
uniform float pointSize;

out vec3 vColor;

void main() {
  vec2 clip = position / resolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = pointSize;
  vColor = color;
}`;

export default function ParticleCanvas({ className }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = canvas.parentElement;
    const gl = canvas.getContext("webgl2", { antialias: false });
    if (!gl) return;

    let disposed = false;
    let raf = 0;
    let state = null;
    const mouse = { x: -1e4, y: -1e4, power: 0, inside: false };

    const simPrg = createProgram(gl, SIM_VS, DISCARD_FS, ["vPosition", "vVelocity"]);
    const drawPrg = createProgram(gl, DRAW_VS, DRAW_FS);
    const tf = gl.createTransformFeedback();

    const simU = {
      mouse: gl.getUniformLocation(simPrg, "mouse"),
      power: gl.getUniformLocation(simPrg, "power"),
      dt: gl.getUniformLocation(simPrg, "dt"),
    };
    const drawU = {
      resolution: gl.getUniformLocation(drawPrg, "resolution"),
      pointSize: gl.getUniformLocation(drawPrg, "pointSize"),
    };

    const destroyState = () => {
      if (!state) return;
      [state.homeBuf, state.colorBuf, ...state.pos, ...state.vel].forEach((b) =>
        gl.deleteBuffer(b)
      );
      state = null;
    };

    // Attribution aléatoire des paysages, fixée au montage pour ne pas changer au resize
    const assignment = shuffledAssignment(root.querySelectorAll("[data-landscape]").length);

    const build = (images) => {
      destroyState();
      const rect = root.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);

      const cells = [...root.querySelectorAll("[data-landscape]")];
      const rects = cells.map((cell) => cell.getBoundingClientRect());

      // Pas entre particules : au moins 1px device, sinon dilaté pour tenir dans le budget
      const area = rects.reduce((sum, r) => sum + r.width * r.height, 0);
      const step = Math.max(1 / dpr, Math.sqrt(area / MAX_PARTICLES));

      // Même taille pour toutes les cases (grille uniforme) -> un seul échantillonnage par paysage
      const cols = Math.max(1, Math.round(rects[0].width / step));
      const rows = Math.max(1, Math.round(rects[0].height / step));
      const samples = images.map((img) => sampleDithered(img, cols, rows));

      const count = cells.length * cols * rows;
      const home = new Float32Array(count * 2);
      const color = new Float32Array(count * 3);
      let k = 0;

      rects.forEach((r, ci) => {
        const sample = samples[assignment[ci] % samples.length];
        const sx = r.width / cols;
        const sy = r.height / rows;
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            home[k * 2] = r.left - rect.left + (x + 0.5) * sx;
            home[k * 2 + 1] = r.top - rect.top + (y + 0.5) * sy;
            const si = (y * cols + x) * 3;
            color[k * 3] = sample[si];
            color[k * 3 + 1] = sample[si + 1];
            color[k * 3 + 2] = sample[si + 2];
            k++;
          }
        }
      });

      const zero = new Float32Array(count * 2);
      state = {
        count,
        pointSize: Math.ceil(step * dpr),
        resolution: [rect.width, rect.height],
        homeBuf: createVBO(gl, home),
        colorBuf: createVBO(gl, color),
        pos: [createVBO(gl, home, gl.DYNAMIC_COPY), createVBO(gl, home, gl.DYNAMIC_COPY)],
        vel: [createVBO(gl, zero, gl.DYNAMIC_COPY), createVBO(gl, zero, gl.DYNAMIC_COPY)],
        idx: 0,
      };
    };

    let last = performance.now();
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (!state) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!mouse.inside) mouse.power *= 0.95;

      const src = state.idx;
      const dst = 1 - src;
      state.idx = dst;

      // GPGPU : simulation via transform feedback
      gl.useProgram(simPrg);
      bindAttrib(gl, 0, state.homeBuf, 2);
      bindAttrib(gl, 1, state.pos[src], 2);
      bindAttrib(gl, 2, state.vel[src], 2);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, state.pos[dst]);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, state.vel[dst]);
      gl.enable(gl.RASTERIZER_DISCARD);
      gl.beginTransformFeedback(gl.POINTS);
      gl.uniform2f(simU.mouse, mouse.x, mouse.y);
      gl.uniform1f(simU.power, mouse.power);
      gl.uniform1f(simU.dt, dt);
      gl.drawArrays(gl.POINTS, 0, state.count);
      gl.endTransformFeedback();
      gl.disable(gl.RASTERIZER_DISCARD);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

      // Rendu
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(drawPrg);
      bindAttrib(gl, 1, state.pos[dst], 2);
      bindAttrib(gl, 3, state.colorBuf, 3);
      gl.uniform2f(drawU.resolution, state.resolution[0], state.resolution[1]);
      gl.uniform1f(drawU.pointSize, state.pointSize);
      gl.drawArrays(gl.POINTS, 0, state.count);
    };

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

    let images = null;
    const onResize = () => images && build(images);

    Promise.all(LANDSCAPES.map(loadImage)).then((imgs) => {
      if (disposed) return;
      images = imgs;
      build(images);
      root.addEventListener("pointermove", onMove);
      root.addEventListener("pointerleave", onLeave);
      window.addEventListener("resize", onResize);
      raf = requestAnimationFrame(frame);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      destroyState();
      gl.deleteTransformFeedback(tf);
      gl.deleteProgram(simPrg);
      gl.deleteProgram(drawPrg);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} />;
}
