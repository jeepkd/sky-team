// Procedural sound cues via Web Audio API — no audio files required.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) ctx = new AudioContext();
  // Resume if suspended (autoplay policy)
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.12): void {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const vol = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  vol.gain.setValueAtTime(gain, c.currentTime);
  vol.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(vol);
  vol.connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + duration);
}

export const sounds = {
  diePlaced() { tone(440, 0.08, 'triangle', 0.1); },
  dieSelected() { tone(330, 0.05, 'sine', 0.07); },
  reveal() { tone(523, 0.15, 'sine', 0.12); },
  roundEnd() {
    tone(440, 0.12, 'sine', 0.1);
    setTimeout(() => tone(550, 0.15, 'sine', 0.1), 120);
    setTimeout(() => tone(660, 0.2, 'sine', 0.12), 260);
  },
  victory() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sine', 0.12), i * 120));
  },
  crash() {
    tone(200, 0.3, 'sawtooth', 0.15);
    setTimeout(() => tone(140, 0.5, 'sawtooth', 0.1), 150);
  },
  warning() { tone(880, 0.1, 'square', 0.08); },
};
