"use client";

import { useEffect, useRef } from "react";
import { CARD_SHADER } from "./lib/cardShader";
import styles from "./css/CardScene.module.css";

// Scène de la maquette blog : le shader particules.glsl, une toile par carte,
// démarrée seulement quand la carte entre dans l'écran.

const VS = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export default function CardScene({ scene = 1, ink = "#3A3A3A", bg = "#E7E7E7" }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;

    let gl = null;
    let raf = 0;
    let running = false;
    const start = performance.now();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const inkRgb = hexToRgb(ink);
    const bgRgb = hexToRgb(bg);

    const draw = (now) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(2, Math.round(rect.width * dpr));
      const h = Math.max(2, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(gl.uResolution, canvas.width, canvas.height);
      gl.uniform1f(gl.uTime, reduce ? 1.2 : (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const frame = (now) => {
      if (!running) return;
      draw(now);
      if (!reduce) raf = requestAnimationFrame(frame);
    };

    const boot = () => {
      if (gl) return true;
      gl = canvas.getContext("webgl", { alpha: false, antialias: false });
      if (!gl) return false;
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
      };
      const vs = compile(gl.VERTEX_SHADER, VS);
      const fs = compile(gl.FRAGMENT_SHADER, CARD_SHADER);
      if (!vs || !fs) return false;
      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const attrib = gl.getAttribLocation(program, "a");
      gl.enableVertexAttribArray(attrib);
      gl.vertexAttribPointer(attrib, 2, gl.FLOAT, false, 0, 0);
      gl.uResolution = gl.getUniformLocation(program, "u_resolution");
      gl.uTime = gl.getUniformLocation(program, "u_time");
      gl.uniform3f(gl.getUniformLocation(program, "u_ink"), inkRgb[0], inkRgb[1], inkRgb[2]);
      gl.uniform3f(gl.getUniformLocation(program, "u_bg"), bgRgb[0], bgRgb[1], bgRgb[2]);
      gl.uniform1i(gl.getUniformLocation(program, "u_scene"), scene);
      gl.uniform1f(gl.getUniformLocation(program, "u_cols"), 96);
      gl.uniform1f(gl.getUniformLocation(program, "u_dot"), 0.75);
      gl.uniform1f(gl.getUniformLocation(program, "u_dither"), 0.7);
      return true;
    };

    const play = () => {
      if (running || !boot()) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) play();
        else stop();
      },
      { rootMargin: "120px" }
    );
    observer.observe(canvas);

    return () => {
      stop();
      observer.disconnect();
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [scene, ink, bg]);

  return <canvas ref={ref} className={styles.canvas} aria-hidden="true" />;
}
