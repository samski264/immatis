"use client";

// Le paysage voyage pendant le scan, pas après. Il décolle au dépôt du fichier
// et se pose dès que le certificat et le bilan sont là.

import { gpsTune } from "@/lib/gpsTune";

export const LEAVE_MS = 280;

const listeners = new Set();
const readingListeners = new Set();
const resetListeners = new Set();
let pending = false;
let cruiseFinish = null;

export function onDepart(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function onReading(listener) {
  readingListeners.add(listener);
  return () => readingListeners.delete(listener);
}

export function onReset(listener) {
  resetListeners.add(listener);
  return () => resetListeners.delete(listener);
}

export function depart(path) {
  listeners.forEach((listener) => listener(path));
}

export function beginReading() {
  readingListeners.forEach((listener) => listener(true));
}

export function endReading() {
  readingListeners.forEach((listener) => listener(false));
}

export function clearCruise() {
  cruiseFinish = null;
}

// Appelé par RouteStage quand le vol vers le résultat est en cours.
// `finish` joue la pose d'arrivée, puis appelle `done`.
export function registerCruise(finish) {
  cruiseFinish = finish;
  return () => {
    if (cruiseFinish === finish) cruiseFinish = null;
  };
}

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function startProcessing() {
  if (reduceMotion()) beginReading();
  else depart("/result");
}

export function completeProcessing(router) {
  endReading();
  const finish = cruiseFinish;
  cruiseFinish = null;
  if (finish) finish(() => router.push("/result"));
  else router.push("/result");
}

export function abortProcessing() {
  endReading();
  cruiseFinish = null;
  resetListeners.forEach((listener) => listener());
}

export function flyTo(router, path) {
  if (gpsTune.permanent) return;
  if (pending) return;
  pending = true;
  const reduce = reduceMotion();
  depart(path);
  const wait = reduce ? 0 : LEAVE_MS;
  window.setTimeout(() => {
    pending = false;
    router.push(path);
  }, wait);
}
