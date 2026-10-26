"use client";

import { useEffect, useRef } from "react";
import { stepTune } from "@/lib/stepTune";
import { createContactSim } from "@/lib/particleContact";

const STEP = 1.5;
// Même réponse au pointeur que la bande du haut : rayon 90 px, montée rapide, retour plus lent.
const FIELD_PX = 90;
const GROW_RISE = 14;
const GROW_FALL = 5;

function pointerField(dist, radius) {
  if (dist >= radius || radius <= 0) return 0;
  const t = 1 - dist / radius;
  return t * t * (3 - 2 * t);
}

const VS = `#version 300 es
layout(location = 0) in vec2 aHome;
layout(location = 1) in vec2 aPos;
layout(location = 2) in float aGrow;

uniform float uTime;
uniform float uH;
uniform float uPoint;
uniform int uScene;
uniform float uSpeed;
uniform float uCutoff;

out float vInk;

float sat(float x) { return clamp(x, 0.0, 1.0); }
float smooth01(float x) { x = sat(x); return x * x * (3.0 - 2.0 * x); }
float inCubic(float x) { x = sat(x); return x * x * x; }
float outCubic(float x) { x = sat(x); return 1.0 - pow(1.0 - x, 3.0); }
float outBack(float x) {
  x = sat(x) - 1.0;
  float c = 1.4;
  return 1.0 + (c + 1.0) * x * x * x + c * x * x;
}

float box(vec2 p, vec2 c, vec2 h) {
  vec2 d = abs(p - c) - h;
  return step(max(d.x, d.y), 0.0);
}

float card(vec2 p, vec2 o, vec2 sz, float rows, float readY) {
  float paper = box(p, o + sz * 0.5, sz * 0.5 - 1.0) * 0.42;
  float head = box(p, vec2(o.x + 8.0 + sz.x * 0.2, o.y + 10.0), vec2(sz.x * 0.2, 2.0));
  float m = max(paper, head);
  for (int i = 0; i < 5; i++) {
    if (float(i) >= rows) break;
    float span = (sz.y - 25.0) / rows;
    float ly = o.y + 17.0 + float(i) * span;
    float read = step(ly, readY);
    m = max(m, box(p, vec2(o.x + 8.0 + sz.x * 0.1, ly), vec2(sz.x * 0.1, 1.6)) * 0.75);
    m = max(m, box(p, vec2(o.x + 8.0 + sz.x * 0.44, ly), vec2(sz.x * (read > 0.5 ? 0.16 : 0.24), 1.6)) * mix(0.28, 1.0, read));
    if (read > 0.5) {
      vec2 c = vec2(o.x + sz.x - 12.0, ly);
      float tick = box(p, c, vec2(3.2, 2.2));
      m = max(m, tick);
    }
  }
  return m;
}

float dropScene(vec2 p) {
  float f = fract(uTime * uSpeed / 2.6);
  vec2 q = abs(p - vec2(50.0, uH * 0.5)) - vec2(46.0, uH * 0.5 - 4.0);
  float edge = abs(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0));
  float dash = step(0.5, fract((p.x + p.y) * 0.09 - uTime * uSpeed * 0.8));
  float border = step(edge, 1.3) * dash * 0.7;

  float rest = uH * 0.5;
  float ch = 54.0;
  float y = rest;
  if (f < 0.3) y = rest - (rest + ch) * (1.0 - outBack(f / 0.3));
  else if (f >= 0.72) y = rest + (uH + ch) * inCubic((f - 0.72) / 0.28);
  vec2 c = vec2(50.0, y);
  float cs = cos(-0.05);
  float sn = sin(-0.05);
  vec2 d = p - c;
  vec2 local = vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs) + vec2(42.0, 27.0);
  return max(border, card(local, vec2(0.0), vec2(84.0, ch), 3.0, -1.0));
}

float scanScene(vec2 p) {
  float f = smooth01(fract(uTime * uSpeed / 3.6));
  float beam = -8.0 + (uH + 16.0) * f;
  float body = card(p, vec2(-3.0, -3.0), vec2(106.0, uH + 6.0), 5.0, beam);
  float stripe = step(abs(p.y - beam), 1.1);
  float glow = smoothstep(14.0, 0.0, beam - p.y) * step(p.y, beam) * 0.55;
  return max(body, max(stripe, glow));
}

float stampScene(vec2 p) {
  float f = fract(uTime * uSpeed / 3.2);
  float body = card(p, vec2(-3.0, -3.0), vec2(106.0, uH + 6.0), 5.0, uH);
  float hit = 0.22;
  float since = f - hit;
  float s = 1.0;
  float a = 1.0;
  if (f < hit) {
    float k = inCubic(f / hit);
    s = 1.8 - 0.8 * k;
    a = 0.15 + 0.85 * k;
  } else if (f > 0.7) {
    float k = smooth01((f - 0.7) / 0.3);
    s = 1.0 + 0.6 * k;
    a = 1.0 - k;
  }
  vec2 c = vec2(72.0, uH * 0.58);
  vec2 d = (p - c) / max(s, 0.2);
  float cs = cos(-0.24);
  float sn = sin(-0.24);
  d = vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
  float ring = step(abs(length(d) - 15.0), 1.7);
  float mark = box(d, vec2(0.5, -0.4), vec2(7.5, 1.5));
  float wave = 0.0;
  if (since > 0.0 && since < 0.25) {
    float k = since / 0.25;
    wave = step(abs(length(p - c) - (15.0 + outCubic(k) * 16.0)), 1.2) * (1.0 - k);
  }
  return max(body, max(wave * 0.6, (ring + mark) * a));
}

void main() {
  float m = uScene == 1 ? scanScene(aHome) : uScene == 2 ? stampScene(aHome) : dropScene(aHome);
  vInk = m;
  if (m < uCutoff) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  gl_Position = vec4(aPos.x / 100.0 * 2.0 - 1.0, 1.0 - aPos.y / uH * 2.0, 0.0, 1.0);
  gl_PointSize = uPoint * (1.0 + aGrow * 2.0);
}
`;

const FS = `#version 300 es
precision mediump float;
in float vInk;
uniform vec3 uInk;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  if (dot(p, p) > 1.0) discard;
  outColor = vec4(uInk, vInk);
}
`;

const SCENE_ID = { drop: 0, scan: 1, stamp: 2 };

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function hexOf(value) {
  const [r, g, b] = value.match(/\d+/g).slice(0, 3).map(Number);
  return [r / 255, g / 255, b / 255];
}

// Grille fixe. Le mouvement est dans le shader : rien n'est redessiné ni renvoyé.
export default function StepParticles({ scene, className }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: true });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VS);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const homeBuf = gl.createBuffer();
    const posBuf = gl.createBuffer();
    const growBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, homeBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, growBuf);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "uTime");
    const uH = gl.getUniformLocation(program, "uH");
    const uPoint = gl.getUniformLocation(program, "uPoint");
    const uScene = gl.getUniformLocation(program, "uScene");
    const uInk = gl.getUniformLocation(program, "uInk");
    const uSpeed = gl.getUniformLocation(program, "uSpeed");
    const uCutoff = gl.getUniformLocation(program, "uCutoff");
    gl.uniform1i(uScene, SCENE_ID[scene] ?? 0);

    let count = 0;
    let sim = null;
    let homes = null;
    let grows = null;
    let settling = false;
    const bindGrow = () => {
      gl.bindBuffer(gl.ARRAY_BUFFER, growBuf);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
    };
    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      canvas.width = w;
      canvas.height = h;
      const H = (h * 100) / w;
      const dx = (stepTune.step * 100) / w;
      const cols = Math.max(1, Math.ceil(100 / dx));
      const rows = Math.max(1, Math.ceil(H / dx));
      const data = new Float32Array(cols * rows * 2);
      let k = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          data[k++] = ((x + 0.5) * 100) / cols;
          data[k++] = ((y + 0.5) * H) / rows;
        }
      }
      sim = createContactSim(data);
      homes = data;
      grows = new Float32Array(cols * rows);
      settling = false;
      gl.bindBuffer(gl.ARRAY_BUFFER, homeBuf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, sim.pos, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, growBuf);
      gl.bufferData(gl.ARRAY_BUFFER, grows, gl.DYNAMIC_DRAW);
      gl.uniform1f(uH, H);
      gl.uniform1f(uPoint, stepTune.point);
      const ink = hexOf(getComputedStyle(canvas.parentElement).color);
      gl.uniform3f(uInk, ink[0], ink[1], ink[2]);
      count = cols * rows;
      gl.viewport(0, 0, w, h);
      gl.useProgram(program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER, homeBuf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
      bindGrow();
    };

    const pointer = { cx: -1e4, cy: -1e4, x: -1e4, y: -1e4, over: false, hover: 0 };
    const placePointer = (event) => {
      pointer.cx = event.clientX;
      pointer.cy = event.clientY;
    };
    const leavePointer = () => {
      pointer.cx = -1e4;
      pointer.cy = -1e4;
    };
    window.addEventListener("pointermove", placePointer);
    document.documentElement.addEventListener("pointerleave", leavePointer);

    let raf = 0;
    let visible = true;
    let last = performance.now();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = (now) => {
      raf = 0;
      if (!visible) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!reduce && sim && homes) {
        const rect = canvas.getBoundingClientRect();
        const w = Math.max(rect.width, 1);
        const h = Math.max(rect.height, 1);
        const unit = (h * 100) / w;
        pointer.x = ((pointer.cx - rect.left) / w) * 100;
        pointer.y = ((pointer.cy - rect.top) / h) * unit;
        const reachPx = (stepTune.reach * w) / 100;
        const inside =
          pointer.cx >= rect.left - reachPx &&
          pointer.cx <= rect.right + reachPx &&
          pointer.cy >= rect.top - reachPx &&
          pointer.cy <= rect.bottom + reachPx;
        pointer.over =
          pointer.cx >= rect.left &&
          pointer.cx <= rect.right &&
          pointer.cy >= rect.top &&
          pointer.cy <= rect.bottom;
        if (inside) pointer.hover = 1;
        else pointer.hover *= 0.95;
        sim.touch(pointer.over, pointer.x, pointer.y, stepTune, dt);
        if (sim.step(dt, stepTune)) {
          gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, sim.pos);
        }
        const near =
          pointer.cx >= rect.left - FIELD_PX &&
          pointer.cx <= rect.right + FIELD_PX &&
          pointer.cy >= rect.top - FIELD_PX &&
          pointer.cy <= rect.bottom + FIELD_PX;
        if ((near && pointer.hover > 0.02) || settling) {
          const radius = (FIELD_PX * 100) / w;
          settling = false;
          for (let i = 0; i < count; i++) {
            const dx = homes[i * 2] - pointer.x;
            const dy = homes[i * 2 + 1] - pointer.y;
            const target = pointerField(Math.hypot(dx, dy), radius) * pointer.hover;
            const current = grows[i];
            const k = target > current ? GROW_RISE : GROW_FALL;
            const next = current + (target - current) * Math.min(1, k * dt);
            grows[i] = next;
            if (next > 0.004) settling = true;
          }
          bindGrow();
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, grows);
        }
      }
      gl.uniform1f(uTime, reduce ? 1.2 : now / 1000);
      gl.uniform1f(uPoint, stepTune.point);
      gl.uniform1f(uSpeed, stepTune.speed);
      gl.uniform1f(uCutoff, stepTune.cutoff);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, count);
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (raf || !visible || reduce) return;
      raf = requestAnimationFrame(frame);
    };

    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    });
    const resize = new ResizeObserver(() => fit());
    fit();
    visibility.observe(canvas);
    resize.observe(canvas);
    if (reduce) frame(0);
    else start();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      visibility.disconnect();
      resize.disconnect();
      window.removeEventListener("pointermove", placePointer);
      document.documentElement.removeEventListener("pointerleave", leavePointer);
      gl.deleteBuffer(homeBuf);
      gl.deleteBuffer(posBuf);
      gl.deleteBuffer(growBuf);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [scene]);

  return <canvas ref={ref} className={className} />;
}
