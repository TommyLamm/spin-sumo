export class SoundEffects {
  private static ctx: AudioContext | null = null;
  private static muted: boolean = false;

  public static setMuted(val: boolean) {
    this.muted = val;
  }

  public static isMuted(): boolean {
    return this.muted;
  }

  public static init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  public static unlock() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public static playCountdownBeep(isGo: boolean = false) {
    if (this.muted || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = isGo ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isGo ? 880 : 440, t); // A5 for GO, A4 for count

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (isGo ? 0.45 : 0.2));

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + (isGo ? 0.45 : 0.2));
    } catch {
      // Audio context error guard
    }
  }

  public static playClang(intensity: number = 1.0) {
    if (this.muted || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const safeIntensity = Math.min(Math.max(intensity, 0.4), 2.2);

      // 1. Metal tone oscillator
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(320 * safeIntensity, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.12);

      oscGain.gain.setValueAtTime(0.2 * Math.min(safeIntensity, 1.2), t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      // 2. White noise punch
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.08);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.Q.setValueAtTime(3.0, t);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.25 * Math.min(safeIntensity, 1.2), t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.12);
      noise.start(t);
      noise.stop(t + 0.08);
    } catch {
      // Audio error guard
    }
  }

  public static playFall() {
    if (this.muted || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.65);

      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.65);
    } catch {
      // Audio error guard
    }
  }

  public static playItemPickup() {
    if (this.muted || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const noteT = t + idx * 0.045;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteT);

        gain.gain.setValueAtTime(0.14, noteT);
        gain.gain.exponentialRampToValueAtTime(0.001, noteT + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(noteT);
        osc.stop(noteT + 0.12);
      });
    } catch {
      // Audio error guard
    }
  }

  public static playExplosion() {
    if (this.muted || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.5);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(380, t);
      filter.frequency.linearRampToValueAtTime(60, t + 0.45);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(t);
      noise.stop(t + 0.5);
    } catch {
      // Audio error guard
    }
  }

  public static playBombTick() {
    if (this.muted || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1100, t);

      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.05);
    } catch {
      // Audio error guard
    }
  }

  public static playRoundWin() {
    if (this.muted || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const noteT = t + idx * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteT);

        gain.gain.setValueAtTime(0.18, noteT);
        gain.gain.exponentialRampToValueAtTime(0.001, noteT + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(noteT);
        osc.stop(noteT + 0.25);
      });
    } catch {
      // Audio error guard
    }
  }

  public static playMatchVictory() {
    if (this.muted || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      // Fanfare: C4, E4, G4, C5 (long)
      const fanfare = [
        { f: 523.25, d: 0.12 },
        { f: 523.25, d: 0.12 },
        { f: 523.25, d: 0.12 },
        { f: 659.25, d: 0.28 },
        { f: 783.99, d: 0.28 },
        { f: 1046.5, d: 0.75 },
      ];
      let cur = t;
      fanfare.forEach((n) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(n.f, cur);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, cur);

        gain.gain.setValueAtTime(0.16, cur);
        gain.gain.exponentialRampToValueAtTime(0.001, cur + n.d);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(cur);
        osc.stop(cur + n.d);
        cur += n.d * 0.9;
      });
    } catch {
      // Audio error guard
    }
  }

  public static playButtonClick() {
    if (this.muted || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.05);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.05);
    } catch {
      // Audio error guard
    }
  }
}
