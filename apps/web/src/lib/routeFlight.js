"use client";

// Le paysage part avant le changement de route : le texte de la page quittée
// a le temps de s'effacer, puis router.push laisse le fondu d'arrivée se poser
// en même temps que la bande.

import { gpsTune } from "@/lib/gpsTune";

export const LEAVE_MS = 280;
// Trajet en vue GPS vers le résultat. Le push n'a lieu qu'à l'approche de l'arrivée.
export const FLIGHT_MS = 15000;
export const READ_MS = 0;

const listeners = new Set();
const readingListeners = new Set();
let pending = false;

export function onDepart(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function onReading(listener) {
  readingListeners.add(listener);
  return () => readingListeners.delete(listener);
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

export function flyTo(router, path) {
  if (gpsTune.permanent) return;
  if (pending) return;
  pending = true;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  depart(path);
  const toResult = path === "/result";
  const wait = reduce ? 0 : toResult ? FLIGHT_MS - 450 : LEAVE_MS;
  window.setTimeout(() => {
    pending = false;
    router.push(path);
  }, wait);
}
