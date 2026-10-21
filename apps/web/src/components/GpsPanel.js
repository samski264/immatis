"use client";

import { useEffect, useState } from "react";
import { beginReading, endReading } from "@/lib/routeFlight";
import { gpsSnapshot, gpsTune, onTune, setTune } from "@/lib/gpsTune";
import styles from "./css/GpsPanel.module.css";

const FIELDS = [
  ["back", "Distance", 0.15, 30, 0.05],
  ["horizon", "Horizon", 0, 0.6, 0.01],
  ["anchor", "Hauteur", 0.02, 1.5, 0.01],
  ["fill", "Champ", 0.15, 2.5, 0.01],
  ["relief", "Hauteur relief", 0, 2.5, 0.01],
  ["riseStart", "Relief début", 0, 0.8, 0.01],
  ["riseEnd", "Relief fin", 0.2, 2, 0.01],
  ["near", "Coupure", 0, 1.5, 0.01],
  ["rush", "Vitesse", 0, 4, 0.05],
  ["gps", "Vue GPS", 0, 1, 0.01],
];

export default function GpsPanel() {
  const [, redraw] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => onTune(() => redraw((n) => n + 1)), []);

  useEffect(() => {
    if (gpsTune.permanent) beginReading();
    return () => endReading();
  }, []);

  const copy = async () => {
    const json = JSON.stringify(gpsSnapshot(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <aside className={styles.panel}>
      <h2>Réglages GPS</h2>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={gpsTune.permanent}
          onChange={(event) => {
            const permanent = event.target.checked;
            setTune({ permanent });
            if (permanent) beginReading();
            else endReading();
          }}
        />
        Animation permanente
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={gpsTune.dense}
          onChange={(event) => setTune({ dense: event.target.checked })}
        />
        Densité augmentée
      </label>
      {FIELDS.map(([key, label, min, max, step]) => (
        <label key={key} className={styles.row}>
          <span>{label}</span>
          <span>{Number(gpsTune[key]).toFixed(2)}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={gpsTune[key]}
            onChange={(event) => setTune({ [key]: Number(event.target.value) })}
          />
        </label>
      ))}
      <button type="button" className={styles.copy} onClick={copy}>
        {copied ? "JSON copié" : "Copier le JSON"}
      </button>
      <p className={styles.note}>Colle-le dans le chat quand le cadrage te va.</p>
    </aside>
  );
}
