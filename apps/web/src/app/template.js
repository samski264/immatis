"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { flushSync } from "react-dom";
import { onDepart, onReading, onReset } from "@/lib/routeFlight";
import styles from "./template.module.css";

// Le fondu d'arrivée ne joue pas au premier affichage (ni au double montage de Strict Mode).
let seenAt = 0;

export default function Template({ children }) {
  const pathname = usePathname();
  const [arrive, setArrive] = useState(false);
  const [leave, setLeave] = useState(false);
  const [reading, setReading] = useState(false);
  const played = useRef(false);

  useLayoutEffect(() => {
    const now = performance.now();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce && pathname !== "/result" && seenAt && now - seenAt > 80 && !played.current) {
      played.current = true;
      setArrive(true);
    }
    seenAt = now;
    const offDepart = onDepart(() => {
      flushSync(() => setLeave(true));
    });
    const offReading = onReading(setReading);
    const offReset = onReset(() => {
      setLeave(false);
      setReading(false);
    });
    return () => {
      offDepart();
      offReading();
      offReset();
    };
  }, []);

  const className = [styles.slot, arrive && styles.arrive, leave && styles.leave].filter(Boolean).join(" ");
  return (
    <div className={className}>
      <div className={reading ? styles.quiet : undefined} aria-hidden={reading || undefined}>
        {children}
      </div>
    </div>
  );
}
