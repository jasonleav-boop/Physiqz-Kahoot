// Web Audio API sound generator for interactive physics game feedback

class SoundEffects {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.1) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  tick() {
    this.playTone(800, 'square', 0.05, 0.03);
  }

  answerSubmitted() {
    this.playTone(520, 'triangle', 0.1, 0.08);
  }

  correct() {
    if (this.muted) return;
    this.init();
    // Two-tone cheerful arpeggio
    setTimeout(() => this.playTone(587.33, 'sine', 0.15, 0.1), 0);
    setTimeout(() => this.playTone(880.00, 'sine', 0.25, 0.12), 120);
  }

  incorrect() {
    if (this.muted) return;
    this.init();
    // Low buzzer
    setTimeout(() => this.playTone(220, 'sawtooth', 0.2, 0.08), 0);
    setTimeout(() => this.playTone(180, 'sawtooth', 0.3, 0.08), 150);
  }

  fanfare() {
    if (this.muted) return;
    this.init();
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.3, 0.15), idx * 130);
    });
  }
}

export default new SoundEffects();
