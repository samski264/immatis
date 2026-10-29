"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import LandscapeStrip from "./LandscapeStrip";
import { clearCruise, onDepart, onReset, registerCruise } from "@/lib/routeFlight";
import { gpsTune, onTune } from "@/lib/gpsTune";
import styles from "./css/RouteStage.module.css";

// Une seule scène WebGL pour / et /result. La remonter dans le layout évite le flash :
// router.push ne démonte plus le canvas (pas de second chargement des tuiles), et /result
// n'a pas de loading.js — le segment statique préfetché s'échange dans le même commit.
// Le vol vers le résultat démarre avec le scan et reste en croisière jusqu'à la réponse.
// Pendant le vol, LandscapeStrip lit `motion` (pitch + accélération du défilement).

const HOME = { key: "home", top: 325, height: 413, opacity: 1 };
const RESULT = { key: "result", top: 0, height: 616, opacity: 0.28 };
const QUIET = { key: "quiet", top: 0, height: 0, opacity: 0 };

const frameFor = (path) => {
  if (path === "/") return HOME;
  if (path === "/result") return RESULT;
  return QUIET;
};

const placeClass = (frame) => {
  if (frame.key === "result") return styles.result;
  if (frame.key === "quiet") return styles.quiet;
  return styles.home;
};

const measure = (frame) => {
  const probe = document.createElement("div");
  probe.className = `${styles.stage} ${placeClass(frame)}`;
  probe.style.transition = "none";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  const box = { w: rect.width, h: rect.height, top: rect.top + window.scrollY, height: rect.height };
  if (frame.key !== "home") return box;
  // Le dépôt mobile dépasse la cote de la bande : le canvas descend jusqu'à son bas.
  const depot = document.getElementById("depot");
  if (!depot) return box;
  const bottom = depot.getBoundingClientRect().bottom + window.scrollY;
  const height = Math.max(box.height, bottom - box.top);
  return { ...box, h: height, height };
};

const pinFull = (el) => {
  el.style.position = "fixed";
  el.style.top = "0px";
  el.style.left = "0px";
  el.style.right = "0px";
  el.style.width = "100%";
  el.style.maxWidth = "none";
  el.style.height = "100dvh";
  el.style.margin = "0px";
  el.style.opacity = "1";
};

const unpinFull = (el) => {
  el.style.position = "";
  el.style.left = "";
  el.style.right = "";
  el.style.width = "";
  el.style.maxWidth = "";
  el.style.margin = "";
};

// Lent au décollage, vif au milieu, posé à l'arrivée.
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// Même vol que la branche : 15 s, caméra sur les 3 premières, pose sur la dernière seconde et demie.
// Si le scan dure plus longtemps, la croisière attend la réponse avant de se poser.
const FLIGHT_MS = 15000;
const DOCK_AT = 0.9;
const DOCK_MS = 1500;

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
    interactive: pathname === "/",
    target: null,
  });
  const goRef = useRef(null);

  goRef.current = (to, snap = false) => {
    const el = stageRef.current;
    if (!el) return;
    if (!snap && flightRef.current?.to.key === to.key) return;
    if (!flightRef.current && poseRef.current.key === to.key) return;
    clearCruise();
    if (flightRef.current) cancelAnimationFrame(flightRef.current.raf);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    motion.current.interactive = to.key === "home";

    const place = placeClass(to);

    if (reduce || snap) {
      flightRef.current = null;
      poseRef.current = to;
      setPose(to);
      setExpanded(false);
      motion.current.flight = 0;
      motion.current.rush = 1;
      motion.current.gps = 0;
      motion.current.detail = false;
      unpinFull(el);
      el.style.top = "";
      el.style.height = "";
      el.style.transition = "";
      el.style.opacity = "";
      el.className = `${styles.stage} ${place}`;
      motion.current.target = measure(to.key === "quiet" ? HOME : to);
      return;
    }

    const fromRect = el.getBoundingClientRect();
    const fromTop = fromRect.top + window.scrollY;
    const fromH = fromRect.height;
    const raw = el.style.opacity || getComputedStyle(el).opacity;
    const fromOpacity = Number.isFinite(parseFloat(raw)) ? parseFloat(raw) : to.opacity;
    const dest = measure(to.key === "quiet" ? HOME : to);
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
    unpinFull(el);
    el.style.top = "";
    el.style.height = "";
    el.className = `${styles.stage} ${place}`;
    setPose(to);

    const toResult = to.key === "result";
    const duration = 1000;
    // `detail` resserre le pas et multiplie les particules. Le vol agrandit en CSS.
    motion.current.detail = false;
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
        unpinFull(el);
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
        pinFull(el);
        return false;
      }
      unpinFull(el);
      el.style.top = `${fromTop + (dest.top - fromTop) * dock}px`;
      el.style.height = `${fromH + (dest.height - fromH) * dock}px`;
      el.style.opacity = String(fromOpacity + (to.opacity - fromOpacity) * dock);
      return false;
    };

    const t0 = performance.now();
    const flight = {
      to,
      raf: 0,
      phase: "fly",
      landCallback: null,
      dockFrom: 0,
      finish(done) {
        this.landCallback = done;
        if (this.phase === "hold") {
          this.phase = "dock";
          this.dockFrom = performance.now();
          this.raf = requestAnimationFrame(tick);
        }
      },
    };
    const tick = (now) => {
      if (!toResult) {
        const t = Math.min(1, (now - t0) / duration);
        if (apply(t)) return;
        flight.raf = requestAnimationFrame(tick);
        return;
      }
      if (flight.phase === "fly") {
        const t = Math.min(DOCK_AT, (now - t0) / FLIGHT_MS);
        apply(t);
        if (t >= DOCK_AT) flight.phase = flight.landCallback ? "dock" : "hold";
        if (flight.phase === "dock") flight.dockFrom = now;
        if (flight.phase === "hold") return;
      }
      if (flight.phase === "dock") {
        const p = Math.min(1, (now - flight.dockFrom) / DOCK_MS);
        if (apply(DOCK_AT + p * 0.1)) {
          const done = flight.landCallback;
          flight.landCallback = null;
          done?.();
          return;
        }
      }
      flight.raf = requestAnimationFrame(tick);
    };
    flightRef.current = flight;
    flight.raf = requestAnimationFrame(tick);
    if (toResult) registerCruise((done) => flight.finish(done));
  };

  useLayoutEffect(() => {
    goRef.current(frameFor(pathname));
  }, [pathname]);

  useLayoutEffect(() => onDepart((path) => goRef.current(frameFor(path))), []);

  useLayoutEffect(() => onReset(() => goRef.current(HOME, true)), []);

  useEffect(() => onTune(() => setTuneRev((n) => n + 1)), []);

  const atResult = pose.key === "result";
  const quiet = pose.key === "quiet";
  const [expanded, setExpanded] = useState(false);
  const hold = gpsTune.permanent;
  const full = hold || expanded;

  useLayoutEffect(() => {
    if (!full) {
      const fitHome = () => {
        if (flightRef.current) return;
        const el = stageRef.current;
        const home = poseRef.current.key === "home";
        const frame = measure(atResult ? RESULT : HOME);
        if (el && home) el.style.height = `${frame.height}px`;
        else if (el) el.style.height = "";
        motion.current.target = { w: frame.w, h: frame.h };
      };
      fitHome();
      const depot = document.getElementById("depot");
      const ro = depot ? new ResizeObserver(fitHome) : null;
      ro?.observe(depot);
      window.addEventListener("resize", fitHome);
      return () => {
        ro?.disconnect();
        window.removeEventListener("resize", fitHome);
      };
    }
    // La fenêtre en pixels réels, avec le pas serré, atteint le plafond de 3,6 M
    // de particules et reconstruit la grille sur le thread principal. On garde
    // l'aire de la bande d'accueil et le format de la fenêtre : le canvas est
    // ensuite étiré en CSS.
    const home = measure(HOME);
    const cap = home.w * home.h;
    const fit = () => {
      const view = window.visualViewport;
      const w = view?.width ?? window.innerWidth;
      const h = view?.height ?? window.innerHeight;
      const area = w * h;
      const scale = area > cap ? Math.sqrt(cap / area) : 1;
      motion.current.target = { w: Math.max(2, w * scale), h: Math.max(2, h * scale) };
    };
    fit();
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
    };
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
        className={full ? `${styles.stage} ${styles.full}` : `${styles.stage} ${placeClass(pose)}`}
        aria-hidden="true"
      >
        <LandscapeStrip motion={motion} />
      </div>
      <div className={full || atResult || quiet ? `${styles.veil} ${styles.veilOff}` : styles.veil} aria-hidden="true" />
    </>
  );
}
