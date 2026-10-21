precision highp float;

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/**
 * @label Encre
 * @color
 * @default #3A3A3A
 */
uniform vec3 u_ink;

/**
 * @label Fond
 * @color
 * @default #E7E7E7
 */
uniform vec3 u_bg;

/**
 * @label Scene (0 drop, 1 scan, 2 stamp, 3 bars, 4 stack)
 * @default 1
 * @range 0, 4
 */
uniform int u_scene;

/**
 * @label Colonnes de particules
 * @default 96
 * @range 24, 240
 */
uniform float u_cols;

/**
 * @label Taille du point
 * @default 0.75
 * @range 0.2, 1
 */
uniform float u_dot;

/**
 * @label Tramage
 * @default 0.7
 * @range 0, 1
 */
uniform float u_dither;

const float W = 100.0;
const float PAPER = 0.80;
const float INK = 0.08;
const float MID = 0.36;
const float FIELD = 0.94;
const float LEVELS = 4.0;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
float clamp01(float v) { return clamp(v, 0.0, 1.0); }
float smooth01(float t) { t = clamp01(t); return t * t * (3.0 - 2.0 * t); }
float inCubic(float t) { t = clamp01(t); return t * t * t; }
float outCubic(float t) { t = 1.0 - clamp01(t); return 1.0 - t * t * t; }
float outBack(float t) { t = clamp01(t) - 1.0; float c = 1.4; return 1.0 + (c + 1.0) * t * t * t + c * t * t; }

float rr(vec2 p, vec2 pos, vec2 size, float r) {
  return step(sdRoundBox(p - pos - size * 0.5, size * 0.5, r), 0.0);
}

float card(vec2 p, vec2 pos, vec2 size, float rows, float readY, float g) {
  g = mix(g, PAPER, rr(p, pos, size, 4.0));
  float pad = 8.0;
  float top = pos.y + pad + 9.0;
  float stp = (size.y - pad * 2.0 - 9.0) / rows;
  float lineH = min(4.0, stp * 0.4);
  g = mix(g, INK, rr(p, pos + vec2(pad, pad), vec2(size.x * 0.4, 4.0), 1.5));
  for (int i = 0; i < 8; i++) {
    if (float(i) >= rows) break;
    float ly = top + float(i) * stp;
    float rd = step(ly, readY - 0.001);
    g = mix(g, MID, rr(p, vec2(pos.x + pad, ly), vec2(size.x * 0.2, lineH), 1.5));
    g = mix(g, mix(FIELD, INK, rd), rr(p, vec2(pos.x + pad + size.x * 0.25, ly), vec2(size.x * mix(0.52, 0.38, rd), lineH), 1.5));
    vec2 c = vec2(pos.x + size.x - pad - 4.0, ly + lineH * 0.5);
    float d = min(sdSeg(p, c + vec2(-3.0, 0.0), c + vec2(-0.8, 2.2)), sdSeg(p, c + vec2(-0.8, 2.2), c + vec2(3.2, -2.4)));
    g = mix(g, INK, rd * step(d, 1.3));
  }
  return g;
}

float sceneDrop(vec2 p, float t, float H) {
  float P = 2.6;
  float f = mod(t, P) / P;
  float g = 1.0;
  float d = abs(sdRoundBox(p - vec2(W * 0.5, H * 0.5), vec2(W - 4.0, H - 4.0) * 0.5, 5.0));
  float dash = step(mod(p.x + p.y - t * 10.0, 9.0), 5.0);
  g = mix(g, MID, step(d, 1.4) * dash);
  float cw = 84.0, ch = 54.0;
  float restY = H * 0.5;
  float y;
  if (f < 0.3) y = restY - (restY + ch) * (1.0 - outBack(f / 0.3));
  else if (f < 0.72) y = restY;
  else y = restY + (H + ch) * inCubic((f - 0.72) / 0.28);
  if (f < 0.3) {
    float a = 0.3 * smooth01(f / 0.3);
    vec2 e = (p - vec2(W * 0.5, restY + ch * 0.5 + 3.0)) / vec2((cw * 0.5) * (0.6 + 0.4 * (f / 0.3)), 3.0);
    g = mix(g, MID, a * step(length(e), 1.0));
  }
  float ang = radians(-3.0);
  vec2 q = p - vec2(W * 0.5, y);
  float cs = cos(ang), sn = sin(ang);
  q = vec2(cs * q.x + sn * q.y, -sn * q.x + cs * q.y);
  g = card(q, vec2(-cw * 0.5, -ch * 0.5), vec2(cw, ch), 3.0, -1e9, g);
  return g;
}

float sceneScan(vec2 p, float t, float H) {
  float P = 3.6;
  float f = mod(t, P) / P;
  float beamY = -8.0 + (H + 16.0) * smooth01(f);
  float g = card(p, vec2(-3.0), vec2(W + 6.0, H + 6.0), 5.0, beamY, 1.0);
  float k = clamp01((p.y - (beamY - 14.0)) / 14.0);
  float band = step(beamY - 14.0, p.y) * step(p.y, beamY);
  g = mix(g, INK, 0.5 * k * band);
  g = mix(g, INK, step(abs(p.y - beamY), 1.4));
  return g;
}

float sceneStamp(vec2 p, float t, float H) {
  float P = 3.2;
  float f = mod(t, P) / P;
  float hit = 0.22;
  float g = card(p, vec2(-3.0), vec2(W + 6.0, H + 6.0), 5.0, 1e9, 1.0);
  float sx = 72.0, sy = H * 0.58, R = 15.0;
  float since = f - hit;
  if (since > 0.0 && since < 0.25) {
    float k = since / 0.25;
    float ring = step(abs(length(p - vec2(sx, sy)) - (R + outCubic(k) * 16.0)), 0.8);
    g = mix(g, MID, (1.0 - k) * 0.6 * ring);
  }
  float s, a;
  if (f < hit) { float pp = inCubic(f / hit); s = 1.8 - 0.8 * pp; a = 0.15 + 0.85 * pp; }
  else if (f < 0.7) { s = 1.0 - 0.08 * sin(3.14159 * clamp01(since / 0.08)); a = 1.0; }
  else { float pp = smooth01((f - 0.7) / 0.3); s = 1.0 + 0.6 * pp; a = 1.0 - pp; }
  float ang = radians(-14.0);
  vec2 q = p - vec2(sx, sy);
  float cs = cos(ang), sn = sin(ang);
  q = vec2(cs * q.x + sn * q.y, -sn * q.x + cs * q.y) / s;
  float ring = step(abs(length(q) - R), 1.6);
  float chk = step(min(sdSeg(q, vec2(-7.0, 0.5), vec2(-2.0, 5.5)), sdSeg(q, vec2(-2.0, 5.5), vec2(8.0, -6.0))), 1.8);
  g = mix(g, INK, a * max(ring, chk));
  return g;
}

float sceneBars(vec2 p, float t, float H) {
  float g = 1.0;
  float n = 10.0;
  float P = 4.0;
  float hi = floor(mod(t, P) / P * n);
  float base = H - 10.0;
  float gap = 2.0;
  float bw = (W - 12.0 - gap * (n - 1.0)) / n;
  g = mix(g, MID, step(abs(p.y - base), 0.7) * step(6.0, p.x) * step(p.x, W - 6.0));
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float h = (H - 24.0) * (1.0 - fi / n) + 4.0;
    float x = 6.0 + fi * (bw + gap);
    float on = step(abs(fi - hi), 0.5);
    g = mix(g, mix(PAPER, INK, on), rr(p, vec2(x, base - h), vec2(bw, h), 1.5));
  }
  return g;
}

float sceneStack(vec2 p, float t, float H) {
  float P = 3.0;
  float f = smooth01(mod(t, P) / P * 1.6);
  float g = 1.0;
  float cw = 72.0, ch = 46.0;
  g = card(p, vec2(4.0, H * 0.5 - ch * 0.2), vec2(cw, ch), 3.0, 1e9, g);
  g = card(p, vec2(14.0, H * 0.5 - ch * 0.5), vec2(cw, ch), 3.0, 1e9, g);
  float x = 24.0 + (W + 10.0) * (1.0 - f);
  g = card(p, vec2(x, H * 0.5 - ch * 0.8), vec2(cw, ch), 3.0, -1e9, g);
  return g;
}

float bayer2(float x, float y) { return 2.0 * x + 3.0 * y - 4.0 * x * y; }
float bayer4(vec2 c) {
  float x = mod(c.x, 4.0), y = mod(c.y, 4.0);
  return (4.0 * bayer2(mod(x, 2.0), mod(y, 2.0)) + bayer2(floor(x / 2.0), floor(y / 2.0)) + 0.5) / 16.0;
}

void main() {
  float u_cell = u_resolution.x / u_cols;
  vec2 cellIdx = floor(gl_FragCoord.xy / u_cell);
  vec2 center = (cellIdx + 0.5) * u_cell;
  float H = u_resolution.y / u_resolution.x * W;
  vec2 p = vec2(center.x / u_resolution.x * W, (u_resolution.y - center.y) / u_resolution.x * W);
  float g = 1.0;
  if (u_scene == 0) g = sceneDrop(p, u_time + 1.0, H);
  else if (u_scene == 1) g = sceneScan(p, u_time + 1.9, H);
  else if (u_scene == 2) g = sceneStamp(p, u_time + 1.2, H);
  else if (u_scene == 3) g = sceneBars(p, u_time, H);
  else g = sceneStack(p, u_time + 2.0, H);
  float th = bayer4(cellIdx);
  float q = clamp(floor(g * LEVELS + (th - 0.5) * u_dither + 0.5) / LEVELS, 0.0, 1.0);
  vec3 tone = mix(u_ink, u_bg, q);
  float r = length(gl_FragCoord.xy - center);
  float dot_ = 1.0 - smoothstep(u_dot * u_cell * 0.5 - 0.6, u_dot * u_cell * 0.5 + 0.2, r);
  float show = step(q, 0.999);
  gl_FragColor = vec4(mix(u_bg, tone, dot_ * show), 1.0);
}
