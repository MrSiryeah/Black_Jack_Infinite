// Web Audio API Synthesizer for self-contained, high-fidelity sound effects

class SoundController {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("Web Audio API not supported in this browser:", e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle(state) {
    this.enabled = state !== undefined ? state : !this.enabled;
    return this.enabled;
  }

  // Helper to generate white noise (useful for card slide brush sounds)
  createNoiseBuffer() {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Card deal/slide sound - filtered soft white noise + low frequency rustle
  playCardDeal() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // 1. White Noise for the card sliding friction (brush sound)
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(800, now);
    noiseFilter.Q.setValueAtTime(2.0, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(150, now + 0.15);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    // 2. Low pop for the card slapping the felt
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

    oscGain.gain.setValueAtTime(0.12, now + 0.03);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);

    // Start
    noise.start(now);
    noise.stop(now + 0.15);
    osc.start(now + 0.03);
    osc.stop(now + 0.08);
  }

  // Chip clink sound - realistic double/triple click using high-freq sines
  playChipClick() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    const playSingleClink = (time, pitchOffset = 1.0) => {
      // Create three metallic frequencies (not perfectly harmonic)
      const frequencies = [800 * pitchOffset, 1500 * pitchOffset, 2200 * pitchOffset];
      const gains = [0.06, 0.04, 0.03];

      frequencies.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        
        gain.gain.setValueAtTime(gains[idx], time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(time);
        osc.stop(time + 0.05);
      });
    };

    // Play a double clink for realism (two chips contacting)
    playSingleClink(now, 1.0);
    playSingleClink(now + 0.02, 1.15);
  }

  // Multiple quick chip clicks for betting all-in or placing many chips
  playChipCollect() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const delay = i * 0.06;
      setTimeout(() => {
        if (!this.enabled) return;
        this.playChipClick();
      }, delay * 1000);
    }
  }

  // Card shuffle sound - series of quick card deal sounds
  playShuffle() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Play 8 quick soft brush sounds
    for (let i = 0; i < 8; i++) {
      const time = now + (i * 0.12);
      
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer();

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(500 + Math.random() * 400, time);
      filter.Q.setValueAtTime(1.5, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.03, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(time);
      noise.stop(time + 0.1);
    }
  }

  // Win chime - ascending major pentatonic scale (e.g. C, E, G, A, C) with delay/echo
  playWin() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 440.00, 523.25, 659.25]; // C4, E4, G4, A4, C5, E5
    
    notes.forEach((freq, i) => {
      const time = now + (i * 0.08);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.0, time);
      gain.gain.linearRampToValueAtTime(0.12, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.3);
    });
  }

  // Lose sound - descending minor chord slide (dissonant/sad)
  playLose() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // First low tone
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(180, now);
    osc1.frequency.linearRampToValueAtTime(120, now + 0.5);

    const filter1 = this.ctx.createBiquadFilter();
    filter1.type = 'lowpass';
    filter1.frequency.setValueAtTime(500, now);
    filter1.frequency.linearRampToValueAtTime(150, now + 0.5);

    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.linearRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(this.ctx.destination);

    // Second dissonant tone (half-step offset)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(170, now);
    osc2.frequency.linearRampToValueAtTime(110, now + 0.5);

    const filter2 = this.ctx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.frequency.setValueAtTime(500, now);
    filter2.frequency.linearRampToValueAtTime(150, now + 0.5);

    gain2.gain.setValueAtTime(0.15, now);
    gain2.gain.linearRampToValueAtTime(0.001, now + 0.5);

    osc2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(this.ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.5);
    osc2.start(now);
    osc2.stop(now + 0.5);
  }

  // Push / Tie sound - two quick warm neutral tones
  playPush() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    const playTone = (time, freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.1, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.3);
    };

    playTone(now, 330); // E4
    playTone(now + 0.12, 330); // E4 again
  }
}

export const sounds = new SoundController();
export default sounds;
