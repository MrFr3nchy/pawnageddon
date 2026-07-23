// Synthesized chess sounds using Web Audio API — no files needed
let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function ramp(gain, from, to, start, dur) {
  gain.setValueAtTime(from, start);
  gain.linearRampToValueAtTime(to, start + dur);
}

function noise(ac, dur, freq = 600, q = 1, vol = 0.25) {
  const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(ac.destination);
  return src;
}

function simpleOsc(ac, type, freq, vol, t, dur) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  ramp(g.gain, vol, 0, t, dur);
  o.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function playMove() {
  const ac = getCtx(), t = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
  o.type = 'sine'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(80, t + 0.08);
  f.type = 'lowpass'; f.frequency.value = 400;
  ramp(g.gain, 0.55, 0, t, 0.12);
  o.connect(f); f.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.14);
  const c = ac.createOscillator(), cg = ac.createGain();
  c.frequency.value = 900; ramp(cg.gain, 0.12, 0, t, 0.025);
  c.connect(cg); cg.connect(ac.destination); c.start(t); c.stop(t + 0.03);
}

function playCapture() {
  const ac = getCtx(), t = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.15);
  ramp(g.gain, 0.8, 0, t, 0.18); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.2);
  noise(ac, 0.06, 600, 1, 0.25).start(t);
}

function playCheck() {
  const ac = getCtx(), t = ac.currentTime;
  for (const [i, freq] of [880, 1108, 1320].entries()) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.3 / (i + 1), t + i * 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.8);
    o.connect(g); g.connect(ac.destination); o.start(t + i * 0.04); o.stop(t + i * 0.04 + 0.85);
  }
}

function playCardDraw() {
  const ac = getCtx(), t = ac.currentTime;
  for (const [i, freq] of [523, 659, 784].entries()) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    ramp(g.gain, 0.18, 0, t + i * 0.07, 0.18);
    o.connect(g); g.connect(ac.destination); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.2);
  }
}

function playCardPlay() {
  const ac = getCtx(), t = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.08); o.frequency.exponentialRampToValueAtTime(200, t + 0.2);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3, t + 0.04); g.gain.linearRampToValueAtTime(0, t + 0.22);
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 3;
  o.connect(f); f.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.25);
}

function playChaosEvent() {
  const ac = getCtx(), t = ac.currentTime;
  const d = ac.createOscillator(), dg = ac.createGain();
  d.type = 'sawtooth'; d.frequency.setValueAtTime(110, t); d.frequency.linearRampToValueAtTime(55, t + 0.4);
  ramp(dg.gain, 0.4, 0, t, 0.5); d.connect(dg); dg.connect(ac.destination); d.start(t); d.stop(t + 0.55);
  simpleOsc(ac, 'sine', 1200, 0.25, t, 0.3);
}

function playPhaseUp() {
  const ac = getCtx(), t = ac.currentTime;
  for (const [i, freq] of [392, 523, 659, 784].entries()) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t + i * 0.1); g.gain.linearRampToValueAtTime(0.2, t + i * 0.1 + 0.03); g.gain.linearRampToValueAtTime(0, t + i * 0.1 + 0.1);
    o.connect(g); g.connect(ac.destination); o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.12);
  }
}

function playGameOver() {
  const ac = getCtx(), t = ac.currentTime;
  for (const [freq, when] of [[523,0],[659,0.15],[784,0.30],[1047,0.45]]) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    ramp(g.gain, 0.35, 0, t + when, 0.35);
    o.connect(g); g.connect(ac.destination); o.start(t + when); o.stop(t + when + 0.4);
  }
}

function playError() {
  const ac = getCtx(), t = ac.currentTime;
  simpleOsc(ac, 'square', 180, 0.15, t, 0.1);
}

// ── Ultimate attack — rising charge → explosion ──
function playUltimate() {
  const ac = getCtx(), t = ac.currentTime;
  const charge = ac.createOscillator(), cg = ac.createGain();
  charge.type = 'sawtooth';
  charge.frequency.setValueAtTime(80, t); charge.frequency.exponentialRampToValueAtTime(800, t + 0.4);
  cg.gain.setValueAtTime(0, t); cg.gain.linearRampToValueAtTime(0.5, t + 0.35); cg.gain.linearRampToValueAtTime(0, t + 0.42);
  charge.connect(cg); cg.connect(ac.destination); charge.start(t); charge.stop(t + 0.45);
  // Explosion burst
  noise(ac, 0.35, 300, 0.5, 0.6).start(t + 0.4);
  simpleOsc(ac, 'sine', 55, 0.8, t + 0.4, 0.5);
  for (let i = 0; i < 3; i++) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(200 - i * 40, t + 0.42 + i * 0.08); o.frequency.exponentialRampToValueAtTime(40, t + 0.52 + i * 0.08);
    ramp(g.gain, 0.4, 0, t + 0.42 + i * 0.08, 0.1);
    o.connect(g); g.connect(ac.destination); o.start(t + 0.42 + i * 0.08); o.stop(t + 0.55 + i * 0.08);
  }
}

// ── Equip gear — metallic clank ──
function playEquip() {
  const ac = getCtx(), t = ac.currentTime;
  for (let i = 0; i < 2; i++) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(800 + i * 200, t + i * 0.06); o.frequency.exponentialRampToValueAtTime(400, t + i * 0.06 + 0.05);
    ramp(g.gain, 0.3, 0, t + i * 0.06, 0.06);
    o.connect(g); g.connect(ac.destination); o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.08);
  }
  noise(ac, 0.04, 4000, 2, 0.12).start(t);
}

// ── Shield block — energy dome ──
function playShieldBlock() {
  const ac = getCtx(), t = ac.currentTime;
  simpleOsc(ac, 'sine', 440, 0.4, t, 0.05);
  simpleOsc(ac, 'sine', 660, 0.3, t + 0.05, 0.15);
  simpleOsc(ac, 'triangle', 880, 0.2, t + 0.1, 0.2);
}

const sounds = {
  move: playMove, capture: playCapture, check: playCheck,
  cardDraw: playCardDraw, cardPlay: playCardPlay,
  chaosEvent: playChaosEvent, phaseUp: playPhaseUp,
  gameOver: playGameOver, error: playError,
  ultimate: playUltimate, equip: playEquip, shieldBlock: playShieldBlock,
};

export function play(name) {
  try { sounds[name]?.(); } catch (_) { /* silent fail */ }
}

export function bindToGameState(gs) {
  gs.on('pieceMoved',    ({ captureInfo }) => play(captureInfo ? 'capture' : 'move'));
  gs.on('check',         () => play('check'));
  gs.on('cardDrawn',     () => play('cardDraw'));
  gs.on('cardPlayed',    () => play('cardPlay'));
  gs.on('chaosEvent',    () => play('chaosEvent'));
  gs.on('phaseUp',       () => play('phaseUp'));
  gs.on('gameOver',      () => play('gameOver'));
  gs.on('ultimateUsed',  () => play('ultimate'));
  gs.on('gearEquipped',  () => play('equip'));
  gs.on('shieldBlocked', () => play('shieldBlock'));
}
