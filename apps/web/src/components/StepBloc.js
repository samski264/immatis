"use client";

import { useLayoutEffect, useRef, useState } from "react";
import ParticleScene from "./ParticleScene";
import styles from "./css/StepBloc.module.css";

function toHex(color) {
  const [r, g, b] = color.match(/\d+/g).slice(0, 3).map(Number);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

// Carte d'étape. `tone` : neutral | lime | sky, couleurs du design system.
// La scène lit le fond et l'encre calculés, le canvas n'accepte pas les variables CSS.
export default function StepBloc({ tone = "lime", scene, title, children }) {
  const ref = useRef(null);
  const [palette, setPalette] = useState(null);

  useLayoutEffect(() => {
    const style = getComputedStyle(ref.current);
    setPalette({ ink: toHex(style.color), background: toHex(style.backgroundColor) });
  }, [tone]);

  return (
    <article ref={ref} className={`${styles.bloc} ${styles[tone]}`}>
      {palette ? (
        <ParticleScene
          className={styles.picture}
          scene={scene}
          ink={palette.ink}
          background={palette.background}
        />
      ) : (
        <div className={styles.picture} />
      )}
      <div className={styles.text}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.body}>{children}</p>
      </div>
    </article>
  );
}
