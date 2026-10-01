// Helpers partagés : WebGL2 (transform feedback), grading + dithering GPU, atlas ASCII,
// échantillonnage des paysages

export const LANDSCAPES = [
  "/landscapes/champ-colza.png",
  "/landscapes/moulins.png",
  "/landscapes/lac-montagne.png",
  "/landscapes/saentis.png",
];

const LEVELS = 4; // niveaux par canal pour le dithering
const SATURATION = 1.9; // boost de saturation avant quantification (look "aero")
const CONTRAST = 1.15; // léger boost de contraste autour du gris moyen

export const DISCARD_FS = `#version 300 es
precision highp float;
void main() { discard; }`;

// Palettes fixes pour le dithering.
// `colors: null` = quantification uniforme par canal (réglage "Niveaux").
// `luma: true`    = rampe monochrome (du sombre au clair) indexée par la luminance tramée,
//                   sinon tramage ordonné vers la couleur la plus proche.
export const PALETTE_MAX = 32;
const PALETTES = [
  { id: "libre", colors: null },
  {
    id: "aero",
    colors: [
      "#ffffff", "#d9f3ff", "#8fd6ff", "#2e9bff", "#0a5ec2", "#c8f57a",
      "#5bd440", "#1a8a3a", "#ffe066", "#ff9f1c",
    ],
  },
];

// "#abc" | "#aabbcc" -> [r, g, b] 0..255
function parseHex(hex) {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Rampe monochrome `levels` couleurs, de `dark` (encre) à `light` (fond), pour un tramage
// indexé par la luminance : les zones claires de l'image se fondent dans le fond.
export function monoPalette(dark, light, levels = 4) {
  const a = parseHex(dark);
  const b = parseHex(light);
  const colors = Array.from({ length: levels }, (_, i) => {
    const t = i / (levels - 1);
    return (
      "#" +
      a
        .map((v, ch) => Math.round(v + (b[ch] - v) * t).toString(16).padStart(2, "0"))
        .join("")
    );
  });
  return { id: `mono:${colors.join(",")}`, luma: true, colors };
}

const paletteCache = new Map();
// Palette (id d'une entrée de PALETTES, ou objet { id, colors, luma } ad hoc)
// -> Float32Array(PALETTE_MAX * 3) prête pour uniform3fv (remplie de 0 au-delà)
function paletteData(palette) {
  const p = typeof palette === "string" ? PALETTES.find((x) => x.id === palette) : palette;
  const key = p?.id ?? palette;
  if (!paletteCache.has(key)) {
    const out = new Float32Array(PALETTE_MAX * 3);
    (p?.colors ?? []).slice(0, PALETTE_MAX).forEach((hex, i) => {
      const [r, g, b] = parseHex(hex);
      out[i * 3] = r / 255;
      out[i * 3 + 1] = g / 255;
      out[i * 3 + 2] = b / 255;
    });
    paletteCache.set(key, { data: out, size: p?.colors?.length ?? 0, luma: p?.luma ? 1 : 0 });
  }
  return paletteCache.get(key);
}

// Rampe de caractères ASCII, du plus clair (vide) au plus dense
export const GLYPH_RAMP = " .'-:;=+*#%@";

// Atlas de glyphes (une ligne, `px` pixels par caractère, alpha = encre) -> texture WebGL
// mipmappée. Rendre l'atlas à un multiple en puissance de 2 de la taille d'affichage garde
// des glyphes nets (un niveau de mipmap exact) tout en permettant de les grossir.
export function createGlyphAtlas(gl, px) {
  px = Math.max(2, Math.round(px));
  const count = GLYPH_RAMP.length;
  const c = document.createElement("canvas");
  c.width = count * px;
  c.height = px;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.font = `${px * 0.95}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < count; i++) {
    ctx.fillText(GLYPH_RAMP[i], (i + 0.5) * px, px * 0.52);
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return { tex, count, px };
}

// Fragment shader gradé : points pleins, ou glyphe ASCII choisi selon la luminance
// (avant quantification, tramé avec le même seuil Bayer) et teinté de la couleur quantifiée.
// Sortie en alpha prémultiplié.
export const GRADED_FS = `#version 300 es
precision highp float;
in vec3 vColor;
in float vLuma;
in float vThreshold;
uniform int uAscii;
uniform float uAsciiInvert;
uniform sampler2D uGlyphs;
uniform float uGlyphCount;
out vec4 outColor;
void main() {
  if (uAscii == 0) { outColor = vec4(vColor, 1.0); return; }
  float d = mix(1.0 - vLuma, vLuma, uAsciiInvert);
  float gi = floor(d * (uGlyphCount - 1.0) + vThreshold);
  vec2 uv = vec2((gi + gl_PointCoord.x) / uGlyphCount, gl_PointCoord.y);
  float a = texture(uGlyphs, uv).a;
  outColor = vec4(vColor * a, a);
}`;

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

export function createProgram(gl, vs, fs, varyings) {
  const prg = gl.createProgram();
  gl.attachShader(prg, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(prg, compile(gl, gl.FRAGMENT_SHADER, fs));
  if (varyings) gl.transformFeedbackVaryings(prg, varyings, gl.SEPARATE_ATTRIBS);
  gl.linkProgram(prg);
  if (!gl.getProgramParameter(prg, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prg));
  }
  return prg;
}

export function createVBO(gl, data, usage = gl.STATIC_DRAW) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, usage);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return buf;
}

export function bindAttrib(gl, location, buf, size) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Échantillonne l'image en w x h (crop "cover" centré), couleurs brutes 0..1
export function sampleColors(img, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const out = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    out[i * 3] = data[i * 4] / 255;
    out[i * 3 + 1] = data[i * 4 + 1] / 255;
    out[i * 3 + 2] = data[i * 4 + 2] / 255;
  }
  return out;
}

// Grading couleur + dithering ordonné côté GPU (Bayer 4x4 indexé sur la grille de particules).
// Attend : in vec3 color (brut), vec2 cellIndex-able home, uniforms ci-dessous.
//   adjust(c)       : teinte / saturation / contraste / luminosité
//   bayer(home)     : seuil 0..1 de la cellule
//   quantize(c, t)  : niveaux uniformes par canal, ou couleur la plus proche dans la palette
//   grade(c, home)  : les trois enchaînés
export const GRADE_GLSL = `
uniform float uHue;        // radians
uniform float uSaturation; // 1 = neutre
uniform float uContrast;   // 1 = neutre
uniform float uBrightness; // 0 = neutre
uniform float uLevels;     // niveaux par canal (>= 2), mode "libre"
uniform float uCell;       // pas entre particules (px), pour l'index Bayer
uniform vec3 uPalette[${PALETTE_MAX}];
uniform int uPaletteSize;  // 0 = mode "libre"
uniform int uPaletteLuma;  // 1 = rampe indexée par la luminance
uniform float uDither;     // amplitude du tramage en mode palette (0 = aucun)

const float BAYER[16] = float[16](0.,8.,2.,10., 12.,4.,14.,6., 3.,11.,1.,9., 15.,7.,13.,5.);
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec3 hueShift(vec3 c, float a) {
  const vec3 k = vec3(0.57735027);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}

vec3 adjust(vec3 c) {
  c = hueShift(c, uHue);
  float luma = dot(c, LUMA);
  c = luma + (c - luma) * uSaturation;
  c = (c - 0.5) * uContrast + 0.5 + uBrightness;
  return clamp(c, 0.0, 1.0);
}

float bayer(vec2 home) {
  ivec2 ci = ivec2(floor(home / uCell)) & 3;
  return (BAYER[ci.y * 4 + ci.x] + 0.5) / 16.0;
}

vec3 quantize(vec3 c, float t) {
  if (uPaletteSize == 0) {
    float n = uLevels - 1.0;
    return floor(c * n + t) / n;
  }
  if (uPaletteLuma == 1) {
    // rampe : luminance tramée -> index ; uDither règle la part de seuil Bayer
    float n = float(uPaletteSize - 1);
    float l = dot(c, LUMA) * n + mix(0.5, t, uDither * 2.0);
    return uPalette[int(clamp(floor(l), 0.0, n))];
  }
  // tramage : on décale la couleur selon le seuil, puis plus proche voisin (distance pondérée)
  vec3 target = clamp(c + (t - 0.5) * uDither, 0.0, 1.0);
  const vec3 w = vec3(0.3, 0.59, 0.11);
  vec3 best = uPalette[0];
  float bestD = 1e9;
  for (int i = 0; i < ${PALETTE_MAX}; i++) {
    if (i >= uPaletteSize) break;
    vec3 d = uPalette[i] - target;
    float dist = dot(d * d, w);
    if (dist < bestD) { bestD = dist; best = uPalette[i]; }
  }
  return best;
}

vec3 grade(vec3 c, vec2 home) {
  return quantize(adjust(c), bayer(home));
}`;

export const GRADE_UNIFORMS = [
  "uHue", "uSaturation", "uContrast", "uBrightness", "uLevels", "uCell",
  "uPalette", "uPaletteSize", "uPaletteLuma", "uDither",
];

export const DEFAULT_GRADE = {
  hue: 0,
  saturation: SATURATION,
  contrast: CONTRAST,
  brightness: 0,
  levels: LEVELS,
  palette: "libre",
  dither: 0.35,
};

export function setGradeUniforms(gl, u, grade, cell) {
  gl.uniform1f(u.uHue, (grade.hue * Math.PI) / 180);
  gl.uniform1f(u.uSaturation, grade.saturation);
  gl.uniform1f(u.uContrast, grade.contrast);
  gl.uniform1f(u.uBrightness, grade.brightness);
  gl.uniform1f(u.uLevels, grade.levels);
  gl.uniform1f(u.uCell, cell);
  const pal = paletteData(grade.palette);
  gl.uniform3fv(u.uPalette, pal.data);
  gl.uniform1i(u.uPaletteSize, pal.size);
  gl.uniform1i(u.uPaletteLuma, pal.luma);
  gl.uniform1f(u.uDither, grade.dither);
}

// Mélange Fisher-Yates d'une répartition équilibrée des paysages sur n cases
export function shuffledAssignment(n) {
  const a = Array.from({ length: n }, (_, i) => i % LANDSCAPES.length);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
