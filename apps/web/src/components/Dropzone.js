"use client";

import { useRef, useState } from "react";
import { SCAN_PHASE } from "@/lib/scanPhase";
import styles from "./css/Dropzone.module.css";

// Référentiels en pied de zone (Pencil BKxyX).
const NORMS = [
  ["1999/37/CE", "directive UE"],
  ["(UE) 2018/858", "réception · COC"],
];

const DEFAULT_FORMATS = "Jusqu'à 3 volets · PDF, JPG ou PNG";

function UploadIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g className={styles.arrow}>
        <path
          d="m17 8-5-5-5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M12 3v12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className={styles.play} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
    </svg>
  );
}

// Zone de dépôt (Pencil BKxyX). Clic ou glisser-déposer, jusqu'à 3 fichiers.
// `formats` surcharge la consigne ; sur l'accueil elle nomme les trois pays.
export default function Dropzone({
  className,
  onFiles,
  onExample,
  reading = false,
  phase = null,
  maxFiles = 3,
  inputId,
  formats = DEFAULT_FORMATS,
}) {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [over, setOver] = useState(false);

  const accept = (list) => {
    if (reading) return;
    const next = Array.from(list)
      .filter((f) => f.type.startsWith("image/") || f.type === "application/pdf")
      .slice(0, maxFiles);
    if (!next.length) return;
    setFiles(next);
    onFiles?.(next);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setOver(false);
    accept(e.dataTransfer.files);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const idle = !reading && !files.length;
  const phaseCopy = SCAN_PHASE[phase];
  const title = phaseCopy
    ? phaseCopy.title
    : reading
      ? "Lecture du certificat"
      : files.length > 1
        ? `${files.length} fichiers sélectionnés`
        : files.length
          ? "1 fichier sélectionné"
          : "Déposez la carte grise";
  const subtitle = phaseCopy
    ? phaseCopy.detail
    : reading
      ? "Les champs sont extraits un par un."
      : files.length
        ? files.map((f) => f.name).join(" · ")
        : "Glissez le fichier ici, ou cliquez pour le choisir.";

  return (
    <div className={`${styles.stack} ${className ?? ""}`}>
      <div
        className={`${styles.zone} ${over ? styles.over : ""} ${reading ? styles.reading : ""}`}
        role="button"
        tabIndex={reading ? -1 : 0}
        aria-busy={reading}
        aria-label={title}
        onClick={() => {
          if (!reading) inputRef.current?.click();
        }}
        onKeyDown={onKeyDown}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          id={inputId}
          className={styles.input}
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={(e) => accept(e.target.files)}
        />

        <span className={styles.pastille}>
          <UploadIcon />
        </span>

        <div className={styles.copy}>
          <p className={styles.title}>{title}</p>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        {idle ? (
          <p className={styles.formats}>
            <span className={styles.dot} aria-hidden="true" />
            {formats}
          </p>
        ) : null}

        <ul className={styles.norms}>
          {NORMS.map(([norm, scope], index) => (
            <li key={norm} className={styles.normWrap}>
              {index > 0 ? <span className={styles.separator} aria-hidden="true" /> : null}
              <span className={styles.norm}>
                <span className={styles.normName}>{norm}</span>
                <span className={styles.normScope}>{scope}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        className={styles.example}
        disabled={reading || !onExample}
        onClick={(event) => {
          event.stopPropagation();
          onExample?.();
        }}
      >
        <PlayIcon />
        Essayer avec une carte grise d&apos;exemple
      </button>
    </div>
  );
}
