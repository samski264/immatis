// Réglages live de la vue GPS. Le panneau les modifie, le shader les lit chaque frame.

const listeners = new Set();

export const gpsTune = {
  permanent: false,
  dense: true,
  gps: 0,
  rush: 1.1,
  back: 0.55,
  horizon: 0,
  anchor: 0.54,
  fill: 0.39,
  relief: 0.43,
  riseStart: 0,
  riseEnd: 0.41,
  near: 1.5,
};

export function onTune(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setTune(partial) {
  Object.assign(gpsTune, partial);
  listeners.forEach((listener) => listener());
}

export function gpsSnapshot() {
  const { permanent, ...values } = gpsTune;
  return values;
}
