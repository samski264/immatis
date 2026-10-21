"use client";

import { useLayoutEffect, useRef, useState } from "react";
import styles from "./template.module.css";

// Le fondu d'arrivée ne joue pas au premier affichage (ni au double montage de Strict Mode).
let seenAt = 0;

export default function Template({ children }) {
  const [arrive, setArrive] = useState(false);
  const played = useRef(false);

  useLayoutEffect(() => {
    const now = performance.now();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce && seenAt && now - seenAt > 80 && !played.current) {
      played.current = true;
      setArrive(true);
    }
    seenAt = now;
  }, []);

  return <div className={arrive ? `${styles.slot} ${styles.arrive}` : styles.slot}>{children}</div>;
}
