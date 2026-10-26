function hash(i) {
  let x = Math.imul(i ^ 0x9e3779b9, 374761393);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}

// Physique légère : impulsion au contact, collisions, ressort vers la place d'origine.
export function createContactSim(homes) {
  const n = homes.length / 2;
  const pos = new Float32Array(homes);
  const vel = new Float32Array(n * 2);
  const cool = new Float32Array(n);
  const head = new Int32Array(Math.max(16, n * 2));
  const next = new Int32Array(n);
  let hot = false;
  let wasInside = false;

  function impulse(i, mx, my, tune, scale) {
    if (tune.rippleAmp < 0.001) return;
    const angle = hash(i) * Math.PI * 2;
    const mag = tune.rippleAmp * (0.45 + hash(i + 19)) * scale;
    const side = (hash(i + 5) - 0.5) * tune.swirl * 0.35;
    const dx = pos[i * 2] - mx;
    const dy = pos[i * 2 + 1] - my;
    const dist = Math.hypot(dx, dy) || 1;
    vel[i * 2] += Math.cos(angle) * mag + (dx / dist) * mag * 0.2 + (-dy / dist) * side;
    vel[i * 2 + 1] += Math.sin(angle) * mag + (dy / dist) * mag * 0.2 + (dx / dist) * side;
    cool[i] = 0.2;
    hot = true;
  }

  function kickAll(mx, my, tune) {
    const reach = Math.max(tune.reach, 1);
    for (let i = 0; i < n; i++) {
      const dx = homes[i * 2] - mx;
      const dy = homes[i * 2 + 1] - my;
      const fall = 1 - Math.min(1, Math.hypot(dx, dy) / reach);
      impulse(i, mx, my, tune, 0.55 + 0.45 * fall * (0.4 + hash(i + 8)));
    }
  }

  function kickTouched(mx, my, tune, dt) {
    const radius = Math.max(tune.core, 0.5);
    const radiusSq = radius * radius;
    for (let i = 0; i < n; i++) {
      cool[i] = Math.max(0, cool[i] - dt);
      if (cool[i] > 0) continue;
      const dx = pos[i * 2] - mx;
      const dy = pos[i * 2 + 1] - my;
      if (dx * dx + dy * dy > radiusSq) continue;
      impulse(i, mx, my, tune, 1);
    }
  }

  function collide(tune) {
    const radius = 0.55 + tune.grow * 1.4;
    const inv = 1 / (radius * 2);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 2];
      const y = pos[i * 2 + 1];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const cols = Math.max(1, Math.ceil((maxX - minX) * inv) + 1);
    const rows = Math.max(1, Math.ceil((maxY - minY) * inv) + 1);
    const cells = cols * rows;
    if (cells > head.length) return;
    head.fill(-1, 0, cells);
    for (let i = 0; i < n; i++) {
      const cx = Math.min(cols - 1, Math.max(0, Math.floor((pos[i * 2] - minX) * inv)));
      const cy = Math.min(rows - 1, Math.max(0, Math.floor((pos[i * 2 + 1] - minY) * inv)));
      const cell = cy * cols + cx;
      next[i] = head[cell];
      head[cell] = i;
    }
    const radiusSq = radius * radius;
    for (let i = 0; i < n; i++) {
      const cx = Math.min(cols - 1, Math.max(0, Math.floor((pos[i * 2] - minX) * inv)));
      const cy = Math.min(rows - 1, Math.max(0, Math.floor((pos[i * 2 + 1] - minY) * inv)));
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          for (let j = head[ny * cols + nx]; j >= 0; j = next[j]) {
            if (j <= i) continue;
            const dx = pos[j * 2] - pos[i * 2];
            const dy = pos[j * 2 + 1] - pos[i * 2 + 1];
            const distSq = dx * dx + dy * dy;
            if (distSq >= radiusSq || distSq < 1e-8) continue;
            const dist = Math.sqrt(distSq);
            const nxn = dx / dist;
            const nyn = dy / dist;
            const push = (radius - dist) * 0.5;
            const jitter = (hash(i + j * 13) - 0.5) * tune.swirl * 0.02;
            pos[i * 2] -= (nxn + jitter) * push;
            pos[i * 2 + 1] -= (nyn - jitter) * push;
            pos[j * 2] += (nxn + jitter) * push;
            pos[j * 2 + 1] += (nyn - jitter) * push;
            const rel = (vel[i * 2] - vel[j * 2]) * nxn + (vel[i * 2 + 1] - vel[j * 2 + 1]) * nyn;
            if (rel > 0) {
              vel[i * 2] -= rel * nxn * 0.65;
              vel[i * 2 + 1] -= rel * nyn * 0.65;
              vel[j * 2] += rel * nxn * 0.65;
              vel[j * 2 + 1] += rel * nyn * 0.65;
            }
          }
        }
      }
    }
  }

  function step(dt, tune) {
    if (!hot) return false;
    const omega = 1.55;
    const zeta = 0.58;
    const damp = Math.exp(-dt * (1.15 + (1 - tune.decay) * 3));
    let energy = 0;
    for (let i = 0; i < n; i++) {
      const ix = i * 2;
      const ax = (homes[ix] - pos[ix]) * omega * omega - vel[ix] * 2 * zeta * omega;
      const ay = (homes[ix + 1] - pos[ix + 1]) * omega * omega - vel[ix + 1] * 2 * zeta * omega;
      vel[ix] = (vel[ix] + ax * dt) * damp;
      vel[ix + 1] = (vel[ix + 1] + ay * dt) * damp;
      pos[ix] += vel[ix] * dt;
      pos[ix + 1] += vel[ix + 1] * dt;
      energy += vel[ix] * vel[ix] + vel[ix + 1] * vel[ix + 1];
    }
    collide(tune);
    if (energy / n < 0.015) {
      pos.set(homes);
      vel.fill(0);
      hot = false;
    }
    return true;
  }

  return {
    pos,
    touch(inside, mx, my, tune, dt) {
      if (inside && !wasInside) kickAll(mx, my, tune);
      else if (inside) kickTouched(mx, my, tune, dt);
      wasInside = inside;
    },
    step,
  };
}
