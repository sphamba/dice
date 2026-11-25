import { BOX, GLASS, dieModes, plateGrid } from './modes.js';

export const MIN_IMPULSE = 1e-4;

export const MAX_IMPULSE = 0.015;

export const LIMITER_CEILING = 10 ** (-3 / 20);

export const FRAME_LAG = 1 / 60;

export const FRICTION_IMPULSE_REF = 1e-4;

export const SLIP_MIN = 0.02;

export const SILENCE_FLOOR = 1e-6;

export const ROUGHNESS_PER_METRE = 2000;

export const MAX_BANK_MODES = 24;

export const MAX_PENDING = 1024;

// Mirrors physics FIXED_DT; kept local so the worklet bundle stays free of the physics module.
export const STEP_DT = 1 / 480;

// One pooled soundStep record: t, a, b, surface, px, py, pz, normal, friction, slip.
export const HIT_STRIDE = 10;

export const SURFACE_CODES = { die: 0, floor: 1, wall: 2, lid: 3 };

// Calibrated so one typical impact (normal 0.005 N·s) peaks at the legacy full scale.
const SPIKE_GAIN = 0.6;

const SPIKE = 0;

const SPAN = 1;

// Linear in the impulse: MIN_IMPULSE is silence and MAX_IMPULSE is a full voice.
export function gainForImpulse(impulse) {
  if (!(impulse > MIN_IMPULSE)) return 0;
  return Math.min(1, impulse / MAX_IMPULSE);
}

// A step at simulation time t sounds FRAME_LAG after the newest step of its frame
// (simNow): older steps of the same frame land proportionally earlier, which spreads
// the series instead of bunching it at the block edge. Late steps clamp to zero.
export function stepSampleOffset(t, simNow, sampleRate, lag = FRAME_LAG) {
  const offset = Math.round((t + lag - simNow) * sampleRate);
  return offset > 0 ? offset : 0;
}

const NOISE_SIZE = 4096;

const NOISE_MASK = NOISE_SIZE - 1;

const NOISE = new Float32Array(NOISE_SIZE);

let noiseSeed = 0x9e3779b9;

for (let index = 0; index < NOISE_SIZE; index += 1) {
  noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0;
  NOISE[index] = noiseSeed / 2147483648 - 1;
}

// Surface roughness as a deterministic function of the accumulated slip distance,
// so the scrape texture is stable at any speed and shifts in pitch with the slip.
function roughness(distance) {
  return NOISE[(((distance * ROUGHNESS_PER_METRE) | 0) & NOISE_MASK)];
}

function makeBank(modes, sampleRate) {
  const count = modes.length;
  const rc = new Float64Array(count);
  const r2 = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    const mode = modes[index];
    const decay = Math.exp(-1 / (mode.tau * sampleRate));
    rc[index] = 2 * decay * Math.cos((2 * Math.PI * mode.f) / sampleRate);
    r2[index] = decay * decay;
  }
  return {
    modes,
    count,
    rc,
    r2,
    y1: new Float64Array(count),
    y2: new Float64Array(count),
    active: false,
  };
}

function makeDieBank(die, radius, sampleRate) {
  const modes = dieModes(die, radius);
  const bank = makeBank(modes, sampleRate);
  bank.amps = Float32Array.from(modes, (mode) => mode.amp);
  return bank;
}

function makePlateBank(a, b, material, sampleRate) {
  const modes = plateGrid(a, b, material, MAX_BANK_MODES);
  const bank = makeBank(modes, sampleRate);
  bank.a = a;
  bank.b = b;
  bank.m = Int32Array.from(modes, (mode) => mode.m);
  bank.n = Int32Array.from(modes, (mode) => mode.n);
  return bank;
}

function plateAmps(bank, u, v) {
  const cu = Math.min(Math.max(u, 0), bank.a);
  const cv = Math.min(Math.max(v, 0), bank.b);
  const amps = new Float32Array(bank.count);
  for (let index = 0; index < bank.count; index += 1) {
    amps[index] =
      Math.abs(Math.sin((bank.m[index] * Math.PI * cu) / bank.a)) *
      Math.abs(Math.sin((bank.n[index] * Math.PI * cv) / bank.b));
  }
  return amps;
}

export function createEngine(sampleRate) {
  const dice = new Map();
  const pending = [];
  const pairs = new Map();
  let surfaces = null;
  let box = null;
  let banks = [];
  let scratch = new Float64Array(128);

  function rebuild() {
    banks = [...dice.values()];
    if (surfaces) banks.push(surfaces.floor, surfaces.lid, surfaces.wallX, surfaces.wallY);
  }

  function targetsFor(aId, bId, surface, px, py, pz) {
    const targets = [];
    const first = dice.get(aId);
    if (first) targets.push({ bank: first, amps: first.amps });
    const second = bId >= 0 ? dice.get(bId) : undefined;
    if (second && second !== first) targets.push({ bank: second, amps: second.amps });
    if (!surfaces) return targets;
    if (surface === SURFACE_CODES.floor) {
      targets.push({ bank: surfaces.floor, amps: plateAmps(surfaces.floor, px + box.W / 2, py + box.H / 2) });
    } else if (surface === SURFACE_CODES.lid) {
      targets.push({ bank: surfaces.lid, amps: plateAmps(surfaces.lid, px + box.W / 2, py + box.H / 2) });
    } else if (surface === SURFACE_CODES.wall) {
      const xEdge = Math.abs(px) - box.W / 2;
      const yEdge = Math.abs(py) - box.H / 2;
      const onX = xEdge >= yEdge;
      const wall = onX ? surfaces.wallX : surfaces.wallY;
      targets.push({ bank: wall, amps: plateAmps(wall, onX ? py + box.H / 2 : px + box.W / 2, pz) });
    }
    return targets;
  }

  function handleSteps(message, now) {
    const startFrame = Math.round(now * sampleRate);
    const hits = message.hits;
    for (let index = 0; index < message.hitCount; index += 1) {
      const o = index * HIT_STRIDE;
      const aId = hits[o + 1];
      const bId = hits[o + 2];
      const surface = hits[o + 3];
      const px = hits[o + 4];
      const py = hits[o + 5];
      const pz = hits[o + 6];
      const e = gainForImpulse(hits[o + 7]);
      const friction = hits[o + 8];
      const slip = hits[o + 9];
      const fGain = friction > 0 ? Math.min(1, friction / FRICTION_IMPULSE_REF) : 0;
      const sliding = fGain > 0 && slip > SLIP_MIN;
      if (e <= 0 && !sliding) continue;
      const targets = targetsFor(aId, bId, surface, px, py, pz);
      if (targets.length === 0) continue;
      let total = 0;
      for (const target of targets) {
        for (let i = 0; i < target.amps.length; i += 1) total += target.amps[i];
      }
      if (!(total > 0)) continue;
      if (e > 0 && pending.length < MAX_PENDING) {
        pending.push({ kind: SPIKE, frame: startFrame + stepSampleOffset(hits[o], message.simNow, sampleRate), targets, level: (e * SPIKE_GAIN) / total });
      }
      if (sliding && pending.length < MAX_PENDING) {
        const key = `${aId}|${bId}|${surface}`;
        const dist = pairs.get(key) ?? 0;
        pairs.set(key, dist + slip * STEP_DT);
        pending.push({
          kind: SPAN,
          start: startFrame + stepSampleOffset(hits[o], message.simNow, sampleRate) - STEP_DT * sampleRate,
          end: startFrame + stepSampleOffset(hits[o], message.simNow, sampleRate),
          targets,
          // Spread over STEP_DT * sampleRate samples: the same discrete impulse the
          // spike path delivers, so a scrape never overdrives narrow resonators.
          level: (fGain * SPIKE_GAIN) / (total * sampleRate),
          slip,
          dist,
        });
      }
    }
  }

  function render(out, now) {
    out.fill(0);
    const n = out.length;
    if (n > scratch.length) scratch = new Float64Array(n);
    const startFrame = Math.round(now * sampleRate);
    const endFrame = startFrame + n;
    let groups = null;
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const event = pending[index];
      if (event.kind === SPIKE) {
        if (event.frame >= endFrame) continue;
        const sample = Math.max(0, event.frame - startFrame);
        groups ??= new Map();
        for (const target of event.targets) {
          let group = groups.get(target.bank);
          if (!group) {
            group = { spikes: [], spans: [] };
            groups.set(target.bank, group);
          }
          group.spikes.push({ sample, amps: target.amps, level: event.level });
        }
        pending.splice(index, 1);
      } else {
        if (event.end <= startFrame) {
          pending.splice(index, 1);
          continue;
        }
        if (event.start >= endFrame) continue;
        const from = Math.max(event.start, startFrame) - startFrame;
        const to = Math.min(event.end, endFrame) - startFrame;
        const noise = new Float64Array(to - from);
        for (let j = 0; j < noise.length; j += 1) {
          noise[j] =
            event.level *
            roughness(event.dist + (startFrame + from + j - event.start) * event.slip / sampleRate);
        }
        groups ??= new Map();
        for (const target of event.targets) {
          let group = groups.get(target.bank);
          if (!group) {
            group = { spikes: [], spans: [] };
            groups.set(target.bank, group);
          }
          group.spans.push({ from, to, noise, amps: target.amps });
        }
        if (event.end <= endFrame) pending.splice(index, 1);
      }
    }
    for (const bank of banks) {
      const group = groups?.get(bank);
      if (!bank.active && !group) continue;
      bank.active = true;
      let energy = 0;
      for (let mode = 0; mode < bank.count; mode += 1) {
        scratch.fill(0, 0, n);
        if (group) {
          for (const spike of group.spikes) scratch[spike.sample] += spike.amps[mode] * spike.level;
          for (const span of group.spans) {
            const amp = span.amps[mode];
            for (let j = span.from; j < span.to; j += 1) scratch[j] += amp * span.noise[j - span.from];
          }
        }
        const rc = bank.rc[mode];
        const r2 = bank.r2[mode];
        let y1 = bank.y1[mode];
        let y2 = bank.y2[mode];
        for (let j = 0; j < n; j += 1) {
          const y0 = scratch[j] + rc * y1 - r2 * y2;
          y2 = y1;
          y1 = y0;
          out[j] += y0;
        }
        bank.y1[mode] = y1;
        bank.y2[mode] = y2;
        const magnitude = Math.max(Math.abs(y1), Math.abs(y2));
        if (magnitude > energy) energy = magnitude;
      }
      if (energy < SILENCE_FLOOR && !group) bank.active = false;
    }
    for (let j = 0; j < n; j += 1) out[j] *= LIMITER_CEILING;
  }

  return {
    addBody(id, die, radius) {
      dice.set(id, makeDieBank(die, radius, sampleRate));
      rebuild();
    },
    removeBody(id) {
      if (!dice.delete(id)) return;
      rebuild();
      const removed = String(id);
      for (const key of [...pairs.keys()]) {
        const [a, b] = key.split('|');
        if (a === removed || b === removed) pairs.delete(key);
      }
    },
    setBox(W, H, D) {
      if (!(W > 0 && H > 0 && D > 0)) return;
      box = { W, H, D };
      surfaces = {
        floor: makePlateBank(W, H, BOX, sampleRate),
        lid: makePlateBank(W, H, GLASS, sampleRate),
        wallX: makePlateBank(H, D, BOX, sampleRate),
        wallY: makePlateBank(W, D, BOX, sampleRate),
      };
      rebuild();
      pairs.clear();
    },
    handleSteps,
    render,
    dice,
    get surfaces() {
      return surfaces;
    },
    get pending() {
      return pending;
    },
  };
}
