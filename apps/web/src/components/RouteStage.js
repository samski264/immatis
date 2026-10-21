"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import LandscapeStrip from "./LandscapeStrip";
import styles from "./css/RouteStage.module.css";

// Une seule scène WebGL pour / et /result. La remonter dans le layout évite le flash :
// router.push ne démonte plus le canvas (pas de second chargement des tuiles), et /result
// n'a pas de loading.js — le segment statique préfetché s'échange dans le même commit.
// Pendant le vol, LandscapeStrip lit `motion` (pitch + accélération du défilement).

const HOME = { top: 325, height: 413, opacity: 1 };
const RESULT = { top: 0, height: 616, opacity: 0.28 };
const DUR = 1200;

const frameFor = (path) => (path === "/result" ? RESULT : HOME);

export default function RouteStage() {
  const pathname = usePathname();
  const stageRef = useRef(null);
  const poseRef = useRef(frameFor(pathname));
  const motion = useRef({
    flight: 0,
    rush: 1,
    interactive: pathname !== "/result",
    target: null,
  });

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const to = frameFor(pathname);
    const from = poseRef.current;
    motion.current.interactive = pathname !== "/result";
    if (from.top === to.top && from.height === to.height) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const destination = () => {
      const probe = document.createElement("div");
      probe.className = `${styles.stage} ${to === RESULT ? styles.result : styles.home}`;
      probe.style.transition = "none";
      probe.style.visibility = "hidden";
      document.body.appendChild(probe);
      const rect = probe.getBoundingClientRect();
      probe.remove();
      return { w: rect.width, h: rect.height };
    };

    if (reduce) {
      poseRef.current = to;
      motion.current.flight = 0;
      motion.current.rush = 1;
      el.style.opacity = "";
      motion.current.target = destination();
      return;
    }

    // Buffer calé sur la taille d'arrivée : le CSS étire le canvas pendant le vol,
    // et à l'atterrissage le bitmap coïncide avec la boîte (pas de seconde grille).
    motion.current.target = destination();
    el.style.opacity = String(from.opacity);

    const t0 = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / DUR);
      const bell = Math.sin(Math.PI * t);
      const done = t >= 1;
      motion.current.flight = done ? 0 : bell;
      motion.current.rush = done ? 1 : 1 + bell * 14;
      if (done) {
        poseRef.current = to;
        el.style.opacity = "";
        return;
      }
      const base = from.opacity + (to.opacity - from.opacity) * t;
      el.style.opacity = String(Math.min(1, base + bell * 0.55));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  const pose = frameFor(pathname);

  return (
    <>
      <div
        ref={stageRef}
        className={pose === RESULT ? `${styles.stage} ${styles.result}` : `${styles.stage} ${styles.home}`}
        aria-hidden="true"
      >
        <LandscapeStrip motion={motion} />
      </div>
      <div className={pose === RESULT ? `${styles.veil} ${styles.veilOff}` : styles.veil} aria-hidden="true">
        <div />
        <div />
        <div />
        <div />
      </div>
    </>
  );
}
