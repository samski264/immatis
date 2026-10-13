"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import styles from "./css/Dropzone.module.css";

// Zone de dépôt de la carte grise (Figma 36:195) : clic pour choisir, ou glisser-déposer.
// Jusqu'à 3 fichiers (les 3 volets du certificat). `onFiles` reçoit la liste retenue.
export default function Dropzone({ className, onFiles, maxFiles = 3 }) {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [over, setOver] = useState(false);

  const accept = (list) => {
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

  return (
    <div
      className={`${styles.zone} ${over ? styles.over : ""} ${className ?? ""}`}
      role="button"
      tabIndex={0}
      aria-label="Choisissez un fichier ou déposez-le ici"
      onClick={() => inputRef.current?.click()}
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
        className={styles.input}
        type="file"
        accept="image/*,application/pdf"
        multiple
        onChange={(e) => accept(e.target.files)}
      />

      <Image
        className={styles.icon}
        src="/upload-icon.svg"
        alt=""
        width={63}
        height={63}
        unoptimized
      />

      {files.length ? (
        <>
          <p className={styles.label}>
            {files.length > 1 ? `${files.length} fichiers sélectionnés` : "1 fichier sélectionné"}
          </p>
          <p className={styles.hint}>{files.map((f) => f.name).join(" · ")}</p>
        </>
      ) : (
        <>
          <p className={styles.label}>Choisissez un fichier ou déposez-le ici</p>
          <p className={styles.hint}>
            Pour des résultats optimaux, déposez les 3 volets de la carte grise s&apos;ils sont
            présents
          </p>
        </>
      )}
    </div>
  );
}
