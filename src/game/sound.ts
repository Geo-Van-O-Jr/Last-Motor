/**
 * Web Audio API procedural sound synthesizer for ÚLTIMO MOTOR.
 * Completely self-contained, no external asset loading required.
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private boostOsc: OscillatorNode | null = null;
  private boostNoiseNode: AudioBufferSourceNode | null = null;
  private boostGain: GainNode | null = null;

  private driftGain: GainNode | null = null;
  private driftSource: AudioBufferSourceNode | null = null;

  private isEngineRunning: boolean = false;
  private isBoostingAudio: boolean = false;
  private isDriftingAudio: boolean = false;
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.createNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.ctx) {
      if (this.engineGain) this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
      if (this.boostGain) this.boostGain.gain.setValueAtTime(0, this.ctx.currentTime);
      if (this.driftGain) this.driftGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public startEngine() {
    this.initContext();
    if (!this.ctx || this.isEngineRunning) return;

    try {
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineGain = this.ctx.createGain();

      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.setValueAtTime(45, this.ctx.currentTime);

      this.engineOsc2.type = 'triangle';
      this.engineOsc2.frequency.setValueAtTime(90, this.ctx.currentTime);

      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(350, this.ctx.currentTime);
      this.engineFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

      this.engineGain.gain.setValueAtTime(this.isMuted ? 0 : 0.12, this.ctx.currentTime);

      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc1.start();
      this.engineOsc2.start();
      this.isEngineRunning = true;
    } catch {
      // Audio context might be restricted
    }
  }

  public stopEngine() {
    if (!this.isEngineRunning) return;
    try {
      if (this.engineOsc1) {
        this.engineOsc1.stop();
        this.engineOsc1.disconnect();
      }
      if (this.engineOsc2) {
        this.engineOsc2.stop();
        this.engineOsc2.disconnect();
      }
    } catch {
      // Ignored
    }
    this.isEngineRunning = false;
  }

  public updateEnginePitch(speedRatio: number, throttle: boolean) {
    if (!this.ctx || !this.isEngineRunning || !this.engineOsc1 || !this.engineOsc2 || !this.engineFilter || !this.engineGain) return;
    if (this.isMuted) return;

    const baseFreq = 45 + speedRatio * 130 + (throttle ? 20 : 0);
    const now = this.ctx.currentTime;
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2.05, now, 0.05);

    const filterCutoff = 300 + speedRatio * 900 + (throttle ? 250 : 0);
    this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.05);

    const volume = 0.08 + speedRatio * 0.1 + (throttle ? 0.05 : 0);
    this.engineGain.gain.setTargetAtTime(volume, now, 0.05);
  }

  public setBoostSound(active: boolean) {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    if (active && !this.isBoostingAudio) {
      this.isBoostingAudio = true;
      try {
        if (!this.noiseBuffer) this.createNoiseBuffer();
        if (this.noiseBuffer) {
          this.boostNoiseNode = this.ctx.createBufferSource();
          this.boostNoiseNode.buffer = this.noiseBuffer;
          this.boostNoiseNode.loop = true;

          const filter = this.ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1400, this.ctx.currentTime);
          filter.Q.setValueAtTime(1.8, this.ctx.currentTime);

          this.boostGain = this.ctx.createGain();
          this.boostGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
          this.boostGain.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + 0.1);

          this.boostNoiseNode.connect(filter);
          filter.connect(this.boostGain);
          this.boostGain.connect(this.ctx.destination);
          this.boostNoiseNode.start();
        }
      } catch {
        // Safe fail
      }
    } else if (!active && this.isBoostingAudio) {
      this.isBoostingAudio = false;
      if (this.boostGain && this.ctx) {
        this.boostGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
        setTimeout(() => {
          try {
            this.boostNoiseNode?.stop();
            this.boostNoiseNode?.disconnect();
          } catch {
            // Ignored
          }
        }, 120);
      }
    }
  }

  public setDriftSound(active: boolean) {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    if (active && !this.isDriftingAudio) {
      this.isDriftingAudio = true;
      try {
        if (!this.noiseBuffer) this.createNoiseBuffer();
        if (this.noiseBuffer) {
          this.driftSource = this.ctx.createBufferSource();
          this.driftSource.buffer = this.noiseBuffer;
          this.driftSource.loop = true;

          const filter = this.ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(2800, this.ctx.currentTime);
          filter.Q.setValueAtTime(6.0, this.ctx.currentTime);

          this.driftGain = this.ctx.createGain();
          this.driftGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
          this.driftGain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + 0.08);

          this.driftSource.connect(filter);
          filter.connect(this.driftGain);
          this.driftGain.connect(this.ctx.destination);
          this.driftSource.start();
        }
      } catch {
        // Safe fail
      }
    } else if (!active && this.isDriftingAudio) {
      this.isDriftingAudio = false;
      if (this.driftGain && this.ctx) {
        this.driftGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.08);
        setTimeout(() => {
          try {
            this.driftSource?.stop();
            this.driftSource?.disconnect();
          } catch {
            // Ignored
          }
        }, 100);
      }
    }
  }

  public playCollision(intensity: number = 0.5) {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    const clampedIntensity = Math.min(Math.max(intensity, 0.1), 1.0);
    const now = this.ctx.currentTime;

    try {
      // Low boom
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140 * clampedIntensity, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + 0.25);

      oscGain.gain.setValueAtTime(0.4 * clampedIntensity, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);

      // Metal clatter noise
      if (this.noiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200 + Math.random() * 800, now);
        filter.Q.setValueAtTime(4.0, now);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.35 * clampedIntensity, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.25);
      }
    } catch {
      // Safe fail
    }
  }

  public playTakedown() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;

    try {
      // Massive explosion sub-bass
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(180, now);
      subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.6);

      subGain.gain.setValueAtTime(0.7, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.7);

      // High cinematic metal shred
      const metalOsc = this.ctx.createOscillator();
      const metalGain = this.ctx.createGain();
      metalOsc.type = 'sawtooth';
      metalOsc.frequency.setValueAtTime(650, now);
      metalOsc.frequency.exponentialRampToValueAtTime(120, now + 0.4);

      metalGain.gain.setValueAtTime(0.4, now);
      metalGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      metalOsc.connect(metalGain);
      metalGain.connect(this.ctx.destination);
      metalOsc.start(now);
      metalOsc.stop(now + 0.5);

      // Noise burst
      if (this.noiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const nFilter = this.ctx.createBiquadFilter();
        nFilter.type = 'lowpass';
        nFilter.frequency.setValueAtTime(3000, now);
        nFilter.frequency.linearRampToValueAtTime(200, now + 0.6);

        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.5, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.7);
      }
    } catch {
      // Safe fail
    }
  }

  public playVictory() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    const notes = [261.63, 329.63, 392.0, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, idx) => {
      const now = this.ctx!.currentTime + idx * 0.12;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    });
  }

  public playGameOver() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    const notes = [320, 280, 240, 180];
    notes.forEach((freq, idx) => {
      const now = this.ctx!.currentTime + idx * 0.16;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    });
  }
}

export const soundManager = new SoundManager();
