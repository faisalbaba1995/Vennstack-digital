let audioCtx: AudioContext | null = null;
let gainNode: GainNode | null = null;
let noiseSource: AudioBufferSourceNode | null = null;
let lfoFilter: BiquadFilterNode | null = null;
let isPlaying = false;

// Generate underwater ambient sound using Web Audio API
// No external audio file needed - pure synthesis
function createUnderwaterAmbience(ctx: AudioContext): AudioBufferSourceNode {
  const sampleRate = ctx.sampleRate;
  const duration = 10; // Loop length in seconds
  const bufferSize = sampleRate * duration;
  const buffer = ctx.createBuffer(2, bufferSize, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < bufferSize; i++) {
      // Brown noise (deeper, more oceanic than white noise)
      const white = Math.random() * 2 - 1;
      if (i > 0) {
        data[i] = (data[i - 1] + 0.02 * white) / 1.02;
      } else {
        data[i] = white * 0.02;
      }
      // Add subtle low-frequency rumble
      data[i] += Math.sin(2 * Math.PI * 0.5 * i / sampleRate) * 0.003;
      // Add whale-like distant tones
      data[i] += Math.sin(2 * Math.PI * 52 * i / sampleRate) * 0.001 *
        Math.sin(2 * Math.PI * 0.1 * i / sampleRate);
      // Add bubble-like high frequency pings (very subtle)
      if (Math.random() < 0.0001) {
        for (let j = 0; j < Math.min(200, bufferSize - i); j++) {
          data[i + j] += Math.sin(2 * Math.PI * (800 + Math.random() * 1200) * j / sampleRate) *
            Math.exp(-j * 0.03) * 0.005;
        }
      }
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function startAudio() {
  if (isPlaying) return;

  audioCtx = new AudioContext();
  gainNode = audioCtx.createGain();
  gainNode.gain.value = 0;

  // Low-pass filter that shifts with a subtle LFO for movement
  lfoFilter = audioCtx.createBiquadFilter();
  lfoFilter.type = 'lowpass';
  lfoFilter.frequency.value = 400;
  lfoFilter.Q.value = 1;

  // Create a very subtle LFO to modulate the filter
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  lfo.frequency.value = 0.05; // Very slow
  lfoGain.gain.value = 100;
  lfo.connect(lfoGain);
  lfoGain.connect(lfoFilter.frequency);
  lfo.start();

  noiseSource = createUnderwaterAmbience(audioCtx);
  noiseSource.connect(lfoFilter);
  lfoFilter.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  noiseSource.start();

  // Fade in
  gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 2);

  isPlaying = true;
}

function stopAudio() {
  if (!isPlaying || !gainNode || !audioCtx) return;

  // Fade out
  gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1);

  setTimeout(() => {
    noiseSource?.stop();
    audioCtx?.close();
    audioCtx = null;
    gainNode = null;
    noiseSource = null;
    lfoFilter = null;
    isPlaying = false;
  }, 1200);
}

export function initAudio() {
  const toggle = document.getElementById('audio-toggle');
  if (!toggle) return;

  const iconOn = toggle.querySelector('.audio-toggle__icon--on') as HTMLElement;
  const iconOff = toggle.querySelector('.audio-toggle__icon--off') as HTMLElement;

  function updateIcons() {
    if (iconOn && iconOff) {
      iconOn.style.display = isPlaying ? 'block' : 'none';
      iconOff.style.display = isPlaying ? 'none' : 'block';
    }
  }

  toggle.addEventListener('click', () => {
    if (isPlaying) {
      stopAudio();
      setTimeout(updateIcons, 100);
    } else {
      startAudio();
      updateIcons();
    }
  });

  updateIcons();

  // Cleanup
  document.addEventListener('astro:before-swap', () => {
    stopAudio();
  }, { once: true });
}
