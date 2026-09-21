// Scènes animées des trois étapes, dessinées en niveaux de gris dans un canvas 2D puis
// tramées en particules monochromes par ParticleScene : le blanc devient le fond du bloc,
// le sombre la couleur d'encre. Chaque scène est une fonction (ctx, t, H) dans un repère de
// 100 unités de large et H unités de haut ; `t` est le temps en secondes. Les scènes bouclent
// en continu et occupent tout le cadre (le document déborde, ses bords sont coupés par le bloc).

const W = 100;
const PAPER = "#a4a4a4"; // document
const INK = "#262626"; // traits forts
const MID = "#6e6e6e"; // traits secondaires
const FIELD = "#dedede"; // champ vide (plus clair que le papier)

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
};
const inCubic = (t) => clamp01(t) ** 3;
const outCubic = (t) => 1 - (1 - clamp01(t)) ** 3;
// arrivée avec un léger dépassement (rebond amorti)
const outBack = (t) => {
  t = clamp01(t) - 1;
  const c = 1.4;
  return 1 + (c + 1) * t * t * t + c * t * t;
};
const rad = (deg) => (deg * Math.PI) / 180;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Carte grise stylisée : en-tête, puis `rows` lignes "libellé / valeur".
// Les lignes dont le haut est au-dessus de `readY` sont "lues" : valeur encrée + coche.
function card(ctx, x, y, w, h, { rows = 5, readY = -Infinity } = {}) {
  roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = PAPER;
  ctx.fill();

  const pad = 8;
  const top = y + pad + 9;
  const step = (h - pad * 2 - 9) / rows;
  const lineH = Math.min(4, step * 0.4);

  // en-tête
  ctx.fillStyle = INK;
  roundRect(ctx, x + pad, y + pad, w * 0.4, 4, 1.5);
  ctx.fill();

  for (let i = 0; i < rows; i++) {
    const ly = top + i * step;
    const read = ly < readY;
    ctx.fillStyle = MID;
    roundRect(ctx, x + pad, ly, w * 0.2, lineH, 1.5);
    ctx.fill();
    ctx.fillStyle = read ? INK : FIELD;
    roundRect(ctx, x + pad + w * 0.25, ly, w * (read ? 0.38 : 0.52), lineH, 1.5);
    ctx.fill();
    if (read) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const cx = x + w - pad - 4;
      const cy = ly + lineH / 2;
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy);
      ctx.lineTo(cx - 0.8, cy + 2.2);
      ctx.lineTo(cx + 3.2, cy - 2.4);
      ctx.stroke();
    }
  }
}

// 1. Déposez la photo : cadre en pointillés bord à bord ; une carte tombe du haut, se pose
// avec un léger rebond, puis file par le bas pendant que la suivante arrive.
function drop(ctx, t, H) {
  const P = 2.6;
  const f = (t % P) / P;

  ctx.lineWidth = 1.8;
  ctx.strokeStyle = MID;
  ctx.setLineDash([5, 4]);
  ctx.lineDashOffset = -t * 10;
  roundRect(ctx, 2, 2, W - 4, H - 4, 5);
  ctx.stroke();
  ctx.setLineDash([]);

  const cw = 84;
  const ch = 54;
  const restY = H / 2;
  let y;
  if (f < 0.3) y = restY - (restY + ch) * (1 - outBack(f / 0.3));
  else if (f < 0.72) y = restY;
  else y = restY + (H + ch) * inCubic((f - 0.72) / 0.28);

  // ombre qui se resserre à l'approche
  if (f < 0.3) {
    ctx.globalAlpha = 0.3 * smooth(f / 0.3);
    ctx.fillStyle = MID;
    ctx.beginPath();
    ctx.ellipse(W / 2, restY + ch / 2 + 3, (cw / 2) * (0.6 + 0.4 * (f / 0.3)), 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(W / 2, y);
  ctx.rotate(rad(-3));
  card(ctx, -cw / 2, -ch / 2, cw, ch, { rows: 3 });
  ctx.restore();
}

// 2. Immatis lit le document : la carte occupe tout le cadre ; un faisceau la balaie de haut
// en bas en encrant et cochant chaque champ, puis repart du haut.
function scan(ctx, t, H) {
  const P = 3.6;
  const f = (t % P) / P;
  const beamY = -8 + (H + 16) * smooth(f);

  card(ctx, -3, -3, W + 6, H + 6, { rows: 5, readY: beamY });

  const g = ctx.createLinearGradient(0, beamY - 14, 0, beamY);
  g.addColorStop(0, "rgba(38, 38, 38, 0)");
  g.addColorStop(1, "rgba(38, 38, 38, 0.5)");
  ctx.fillStyle = g;
  ctx.fillRect(0, beamY - 14, W, 14);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, beamY);
  ctx.lineTo(W, beamY);
  ctx.stroke();
}

// 3. Vous obtenez le verdict : dossier lu bord à bord ; un tampon "validé" s'abat, tient,
// puis se soulève pour retomber au cycle suivant.
function stamp(ctx, t, H) {
  const P = 3.2;
  const f = (t % P) / P;
  const hit = 0.22;

  card(ctx, -3, -3, W + 6, H + 6, { rows: 5, readY: Infinity });

  const sx = 72;
  const sy = H * 0.58;
  const R = 15;

  // onde à l'impact
  const since = f - hit;
  if (since > 0 && since < 0.25) {
    const k = since / 0.25;
    ctx.globalAlpha = (1 - k) * 0.6;
    ctx.strokeStyle = MID;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(sx, sy, R + outCubic(k) * 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  let s;
  let a;
  if (f < hit) {
    const p = inCubic(f / hit);
    s = 1.8 - 0.8 * p;
    a = 0.15 + 0.85 * p;
  } else if (f < 0.7) {
    s = 1 - 0.08 * Math.sin(Math.PI * clamp01(since / 0.08)); // écrasement bref à l'impact
    a = 1;
  } else {
    const p = smooth((f - 0.7) / 0.3);
    s = 1 + 0.6 * p;
    a = 1 - p;
  }

  ctx.globalAlpha = a;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(rad(-14));
  ctx.scale(s, s);
  ctx.strokeStyle = INK;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(-7, 0.5);
  ctx.lineTo(-2, 5.5);
  ctx.lineTo(8, -6);
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}

export const SCENES = { drop, scan, stamp };
