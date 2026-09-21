"use client";

import { useState } from "react";
import styles from "./ColorControls.module.css";
import { PALETTES } from "./lib/particles";

// Panneau de réglages couleur (draft).
// `value` = { hue, saturation, contrast, brightness, levels, palette, dither,
//             ascii, size, cell, asciiInvert, road, arrow }

const SLIDERS = [
  { key: "hue", label: "Teinte", min: -180, max: 180, step: 1, unit: "°" },
  { key: "saturation", label: "Saturation", min: 0, max: 3, step: 0.05 },
  { key: "contrast", label: "Contraste", min: 0.5, max: 2, step: 0.05 },
  { key: "brightness", label: "Luminosité", min: -0.4, max: 0.4, step: 0.01 },
];

// Selon la palette : niveaux uniformes ("libre") ou amplitude du tramage (palette fixe)
const LEVELS_SLIDER = { key: "levels", label: "Niveaux", min: 2, max: 8, step: 1 };
const DITHER_SLIDER = { key: "dither", label: "Tramage", min: 0, max: 1, step: 0.05 };
// Grille de particules : taille du point / glyphe et pas d'écartement entre les points, en px (0 = auto)
const autoPx = (v) => (v === 0 ? "auto" : `${v.toFixed(1)}px`);
const SIZE_SLIDER = { key: "size", label: "Taille", min: 0, max: 24, step: 0.5, format: autoPx };
const CELL_SLIDER = { key: "cell", label: "Écart", min: 0, max: 24, step: 0.5, format: autoPx };

const COLORS = [
  { key: "road", label: "Route" },
  { key: "arrow", label: "Flèche" },
];

function Slider({ value, onChange, def }) {
  const { key, label, min, max, step, unit = "", format } = def;
  const v = Number(value[key]);
  return (
    <label className={styles.row}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[key]}
        onChange={(e) => onChange(key, Number(e.target.value))}
      />
      <output>
        {format ? format(v) : `${v.toFixed(step >= 1 ? 0 : step >= 0.1 ? 1 : 2)}${unit}`}
      </output>
    </label>
  );
}

export default function ColorControls({ value, defaults, onChange }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const set = (key, v) => onChange({ ...value, [key]: v });
  const palette = PALETTES.find((p) => p.id === value.palette) ?? PALETTES[0];

  const copy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className={styles.panel}>
      <button type="button" className={styles.toggle} onClick={() => setOpen(!open)}>
        Couleurs {open ? "−" : "+"}
      </button>

      {open && (
        <div className={styles.body}>
          <div className={styles.row}>
            <span>Rendu</span>
            <div className={styles.segmented}>
              <button
                type="button"
                aria-pressed={!value.ascii}
                onClick={() => set("ascii", false)}
              >
                Points
              </button>
              <button
                type="button"
                aria-pressed={value.ascii}
                onClick={() => set("ascii", true)}
              >
                ASCII
              </button>
            </div>
          </div>

          <Slider value={value} onChange={set} def={SIZE_SLIDER} />
          <Slider value={value} onChange={set} def={CELL_SLIDER} />

          {value.ascii && (
            <label className={styles.row}>
              <span>Inverser</span>
              <input
                type="checkbox"
                checked={value.asciiInvert}
                onChange={(e) => set("asciiInvert", e.target.checked)}
              />
              <output>{value.asciiInvert ? "clair" : "sombre"}</output>
            </label>
          )}

          <label className={styles.row}>
            <span>Palette</span>
            <select value={value.palette} onChange={(e) => set("palette", e.target.value)}>
              {PALETTES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <output>{palette.colors ? palette.colors.length : `${value.levels}³`}</output>
          </label>

          {palette.colors && (
            <div className={styles.swatches} aria-hidden="true">
              {palette.colors.map((c) => (
                <span key={c} style={{ background: c }} title={c} />
              ))}
            </div>
          )}

          <Slider value={value} onChange={set} def={palette.colors ? DITHER_SLIDER : LEVELS_SLIDER} />

          {SLIDERS.map((def) => (
            <Slider key={def.key} value={value} onChange={set} def={def} />
          ))}

          {COLORS.map(({ key, label }) => (
            <label key={key} className={styles.row}>
              <span>{label}</span>
              <input type="color" value={value[key]} onChange={(e) => set(key, e.target.value)} />
              <output>{value[key]}</output>
            </label>
          ))}

          <div className={styles.actions}>
            <button type="button" onClick={() => onChange(defaults)}>
              Réinitialiser
            </button>
            <button type="button" onClick={copy}>
              {copied ? "Copié" : "Copier JSON"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
