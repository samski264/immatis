"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import LandscapeStrip from "./LandscapeStrip";
import { FLIGHT_MS, onDepart } from "@/lib/routeFlight";
import { gpsTune, onTune } from "@/lib/gpsTune";
import styles from "./css/RouteStage.module.css";

// Une seule scène WebGL pour / et /result. La remonter dans le layout évite le flash :
// router.push ne démonte plus le canvas (pas de second chargement des tuiles), et /result
// n'a pas de loading.js — le segment statique préfetché s'échange dans le même commit.
// Le vol commence dans flyTo(), avant le push, pour que le texte parte avec la bande.
// Pendant le vol, LandscapeStrip lit `motion` (pitch + accélération du défilement).

const HOME = { key: "home", top: 325, height: 413, opacity: 1 };
const RESULT = { key: "result", top: 0, height: 616, opacity: 0.28 };

const frameFor = (path) => (path === "/result" ? RESULT : HOME);

const measure = (frame) => {
  const probe = document.createElement("div");
  probe.className = `${styles.stage} ${frame.key === "result" ? styles.result : styles.home}`;
  probe.style.transition = "none";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  return { w: rect.width, h: rect.height, top: rect.top + window.scrollY, height: rect.height };
};

// Lent au décollage, vif au milieu, posé à l'arrivée.
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export default function RouteStage() {
  const pathname = usePathname();
  const stageRef = useRef(null);
  const poseRef = useRef(frameFor(pathname));
  const flightRef = useRef(null);
  const [pose, setPose] = useState(poseRef.current);
  const [, setTuneRev] = useState(0);
  const motion = useRef({
    flight: 0,
    rush: 1,
    gps: 0,
    detail: false,
    interactive: pathname !== "/result",
    target: null,
  });
  const goRef = useRef(null);

  goRef.current = (to) => {
    const el = stageRef.current;
    if (!el) return;
    if (flightRef.current?.to.key === to.key) return;
    if (!flightRef.current && poseRef.current.key === to.key) return;
    if (flightRef.current) cancelAnimationFrame(flightRef.current.raf);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    motion.current.interactive = to.key !== "result";

    const place = to.key === "result" ? styles.result : styles.home;

    if (reduce) {
      flightRef.current = null;
      poseRef.current = to;
      setPose(to);
      motion.current.flight = 0;
      motion.current.rush = 1;
      motion.current.gps = 0;
      motion.current.detail = false;
      el.style.top = "";
      el.style.height = "";
      el.style.transition = "";
      el.style.opacity = "";
      el.className = `${styles.stage} ${place}`;
      motion.current.target = measure(to);
      return;
    }

    const fromRect = el.getBoundingClientRect();
    const fromTop = fromRect.top + window.scrollY;
    const fromH = fromRect.height;
    const raw = el.style.opacity || getComputedStyle(el).opacity;
    const fromOpacity = Number.isFinite(parseFloat(raw)) ? parseFloat(raw) : to.opacity;
    const dest = measure(to);
    // Grille reconstruite pendant que la bande est estompée : au décollage vers
    // l'accueil, à l'approche du résultat.
    let armed = false;
    const arm = () => {
      if (armed) return;
      armed = true;
      motion.current.target = { w: dest.w, h: dest.h };
    };
    if (to.opacity > fromOpacity) arm();

    el.style.transition = "none";
    el.style.top = "";
    el.style.height = "";
    el.className = `${styles.stage} ${place}`;
    setPose(to);

    const toResult = to.key === "result";
    const duration = toResult ? FLIGHT_MS : 1000;
    motion.current.detail = toResult;
    if (toResult) setExpanded(true);
    else setExpanded(false);

    const apply = (t) => {
      const done = t >= 1;
      const into = Math.min(1, t / 0.2);
      const intoEased = into * into * (3 - 2 * into);
      const dockT = toResult && t > 0.9 ? (t - 0.9) / 0.1 : toResult ? 0 : t;
      const dock = toResult ? easeInOut(Math.min(1, dockT)) : easeInOut(t);
      motion.current.flight = 0;
      motion.current.rush = done || !toResult ? 1 : gpsTune.rush;
      motion.current.gps = done || !toResult ? 0 : intoEased * (1 - dock);
      if (!armed && (done || (toResult ? dockT > 0 : true))) arm();
      if (done) {
        poseRef.current = to;
        el.style.top = "";
        el.style.height = "";
        el.style.transition = "";
        el.style.opacity = "";
        el.className = `${styles.stage} ${place}`;
        flightRef.current = null;
        motion.current.detail = false;
        motion.current.target = { w: dest.w, h: dest.h };
        if (toResult) setExpanded(false);
        return true;
      }
      if (toResult && dock === 0) {
        el.style.top = "";
        el.style.height = "";
        el.style.opacity = "1";
        return false;
      }
      el.style.top = `${fromTop + (dest.top - fromTop) * dock}px`;
      el.style.height = `${fromH + (dest.height - fromH) * dock}px`;
      el.style.opacity = String(fromOpacity + (to.opacity - fromOpacity) * dock);
      return false;
    };

    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      if (apply(t)) return;
      flightRef.current.raf = requestAnimationFrame(tick);
    };
    flightRef.current = { to, raf: requestAnimationFrame(tick) };
  };

  useLayoutEffect(() => {
    goRef.current(frameFor(pathname));
  }, [pathname]);

  useLayoutEffect(() => onDepart((path) => goRef.current(frameFor(path))), []);

  useEffect(() => onTune(() => setTuneRev((n) => n + 1)), []);

  const atResult = pose.key === "result";
  const [expanded, setExpanded] = useState(false);
  const hold = gpsTune.permanent;
  const full = hold || expanded;

  useLayoutEffect(() => {
    if (!full) {
      motion.current.target = measure(atResult ? RESULT : HOME);
      return;
    }
    const fit = () => {
      motion.current.target = { w: window.innerWidth, h: window.innerHeight };
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [full, atResult]);

  useLayoutEffect(
    () => () => {
      if (flightRef.current) cancelAnimationFrame(flightRef.current.raf);
    },
    []
  );

  return (
    <>
      <div
        ref={stageRef}
        className={full ? `${styles.stage} ${styles.full}` : atResult ? `${styles.stage} ${styles.result}` : `${styles.stage} ${styles.home}`}
        aria-hidden="true"
      >
        <LandscapeStrip motion={motion} />
      </div>
      <div className={full || atResult ? `${styles.veil} ${styles.veilOff}` : styles.veil} aria-hidden="true">
        <div />
        <div />
        <div />
        <div />
      </div>
    </>
  );
}
