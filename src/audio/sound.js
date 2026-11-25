import { HIT_STRIDE, LIMITER_CEILING, SURFACE_CODES } from './banks.js';
import processorUrl from './processor.js?worker&url';

export { LIMITER_CEILING, MAX_IMPULSE, MIN_IMPULSE, SURFACE_CODES, gainForImpulse } from './banks.js';

export const CLIPPER_RANGE = 4;

const CURVE_POINTS = 4097;

const MAX_CURVE = 1 - 2 ** -24;

function clipperCurve() {
  const curve = new Float32Array(CURVE_POINTS);
  const half = (CURVE_POINTS - 1) / 2;
  for (let index = 0; index < CURVE_POINTS; index += 1) {
    const s = ((index - half) / half) * CLIPPER_RANGE;
    const magnitude = Math.abs(s);
    const shaped =
      magnitude <= LIMITER_CEILING
        ? s
        : Math.sign(s) *
          (LIMITER_CEILING +
            (1 - LIMITER_CEILING) *
              Math.tanh((magnitude - LIMITER_CEILING) / (1 - LIMITER_CEILING)));
    curve[index] = Math.min(Math.max(shaped, -MAX_CURVE), MAX_CURVE);
  }
  return curve;
}

const MAX_MSG_HITS = 768;

export function createSound() {
  let context = null;
  let master = null;
  let node = null;
  let loading = null;
  let boxState = null;
  let nextId = 0;
  const bodyIds = new Map();
  const hitsBuf = new Float64Array(MAX_MSG_HITS * HIT_STRIDE);

  function idOf(body) {
    let id = bodyIds.get(body);
    if (id === undefined) {
      id = nextId;
      nextId += 1;
      bodyIds.set(body, id);
    }
    return id;
  }

  function post(message) {
    node?.port.postMessage(message);
  }

  function resumeLater() {
    context.resume().catch((error) => {
      console.warn('The AudioContext could not resume', error);
    });
  }

  async function loadWorklet(WorkletNode) {
    try {
      await context.audioWorklet.addModule(processorUrl);
      const shaper = context.createWaveShaper();
      shaper.curve = clipperCurve();
      shaper.oversample = 'none';
      master = context.createGain();
      master.gain.value = 1 / CLIPPER_RANGE;
      node = new WorkletNode(context, 'dice-resonator', {
        numberOfInputs: 0,
        outputChannelCount: [1],
      });
      node.connect(master);
      master.connect(shaper);
      shaper.connect(context.destination);
      for (const [body, id] of bodyIds) sendBody(id, body);
      if (boxState) post({ type: 'box', W: boxState.W, H: boxState.H, D: boxState.D });
    } catch (error) {
      console.warn('The audio worklet module failed to load', error);
    }
  }

  globalThis.document?.addEventListener('visibilitychange', () => {
    if (globalThis.document.visibilityState !== 'visible') return;
    if (!context) return;
    if (context.state === 'running') return;
    if (!globalThis.navigator?.userActivation?.hasBeenActive) return;
    resumeLater();
  });

  function sendBody(id, body) {
    post({ type: 'add', id, die: body?.shape?.type, radius: body?.shape?.radius });
  }

  return {
    resume() {
      const AudioCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      const WorkletNode = globalThis.AudioWorkletNode;
      if (typeof AudioCtor !== 'function' || typeof WorkletNode !== 'function') return Promise.resolve();
      if (!context) {
        context = new AudioCtor({ latencyHint: 'interactive' });
        if (typeof context.audioWorklet?.addModule !== 'function') {
          context = null;
          return Promise.resolve();
        }
      }
      if (context.state !== 'running') resumeLater();
      if (node || loading) return loading ?? Promise.resolve();
      loading = loadWorklet(WorkletNode).finally(() => {
        loading = null;
      });
      return loading;
    },
    addBody(body) {
      if (!body) return;
      sendBody(idOf(body), body);
    },
    removeBody(body) {
      const id = bodyIds.get(body);
      if (id === undefined) return;
      bodyIds.delete(body);
      post({ type: 'remove', id });
    },
    setBox(box) {
      if (!(box?.W > 0 && box?.H > 0 && box?.D > 0)) return;
      boxState = { W: box.W, H: box.H, D: box.D };
      post({ type: 'box', W: box.W, H: box.H, D: box.D });
    },
    playSteps(steps, simNow = 0) {
      if (!node) return 0;
      let hitCount = 0;
      for (const record of steps ?? []) {
        if (hitCount >= MAX_MSG_HITS) break;
        const o = hitCount * HIT_STRIDE;
        hitCount += 1;
        hitsBuf[o] = record?.t ?? 0;
        hitsBuf[o + 1] = record?.a ? (bodyIds.get(record.a) ?? -1) : -1;
        hitsBuf[o + 2] = record?.b ? (bodyIds.get(record.b) ?? -1) : -1;
        hitsBuf[o + 3] = SURFACE_CODES[record?.surface] ?? 0;
        hitsBuf[o + 4] = record?.px ?? 0;
        hitsBuf[o + 5] = record?.py ?? 0;
        hitsBuf[o + 6] = record?.pz ?? 0;
        hitsBuf[o + 7] = record?.normal ?? 0;
        hitsBuf[o + 8] = record?.friction ?? 0;
        hitsBuf[o + 9] = record?.slip ?? 0;
      }
      node.port.postMessage({
        type: 'steps',
        simNow,
        hitCount,
        hits: hitsBuf.subarray(0, hitCount * HIT_STRIDE),
      });
      return hitCount;
    },
  };
}
