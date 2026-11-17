// Synthesised sound with WebAudio: no audio files, no network. Every sound
// is a short oscillator blip, created on the first user gesture (browsers
// block audio before one) and silent when muted or unavailable.
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context !== null;
    }
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.14;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, endFreq, duration, type, volume, delay) {
    if (muted || !ensure()) return;
    try {
      const start = context.currentTime + (delay ?? 0);
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + duration);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    } catch {
      // Sound is garnish: a failure here must never break the game.
    }
  }

  return {
    /** Call from a user gesture so the browser lets audio start. */
    unlock() {
      ensure();
    },
    isMuted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    coin() {
      tone(880, 880, 0.07, 'sine', 0.5);
      tone(1318, 1318, 0.12, 'sine', 0.5, 0.06);
    },
    gold() {
      tone(660, 660, 0.09, 'sine', 0.5);
      tone(880, 880, 0.09, 'sine', 0.5, 0.08);
      tone(1318, 1318, 0.18, 'sine', 0.5, 0.16);
    },
    jump() {
      tone(300, 620, 0.13, 'sine', 0.4);
    },
    dash() {
      tone(900, 280, 0.14, 'square', 0.22);
    },
    hit() {
      tone(170, 55, 0.28, 'sawtooth', 0.6);
    },
    shield() {
      tone(520, 780, 0.16, 'triangle', 0.45);
    },
    win() {
      [523, 659, 784, 1046].forEach((freq, index) => tone(freq, freq, 0.22, 'sine', 0.5, index * 0.11));
    },
    over() {
      [392, 330, 262, 196].forEach((freq, index) => tone(freq, freq, 0.22, 'triangle', 0.45, index * 0.13));
    },
  };
}
