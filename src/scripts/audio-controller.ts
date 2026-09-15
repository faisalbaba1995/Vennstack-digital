export function initAudio() {
  const button = document.getElementById('audio-toggle');
  if (!(button instanceof HTMLButtonElement)) return { dispose() {} };
  const label = button.querySelector<HTMLElement>('[data-audio-label]');
  const status = document.getElementById('audio-status');
  const abort = new AbortController();
  let context: AudioContext | null = null;
  let source: AudioBufferSourceNode | null = null;
  let gain: GainNode | null = null;
  let desired = false;
  let disposed = false;
  let operation = 0;
  let suspendTimer: number | undefined;

  function paint(message?: string) {
    const active = desired && !document.hidden && context?.state === 'running';
    button!.setAttribute('aria-pressed', String(active));
    button!.setAttribute('aria-label', active ? 'Ambient sound, Sound on' : 'Ambient sound, Sound off');
    if (label) label.textContent = active ? 'Sound on' : 'Sound off';
    if (status && message !== undefined) status.textContent = message;
  }

  function releaseGraph() {
    window.clearTimeout(suspendTimer);
    suspendTimer = undefined;
    try { source?.stop(); } catch { /* A partial graph may already be stopped. */ }
    if (context && context.state !== 'closed') void context.close().catch(() => {});
    source = null; gain = null; context = null;
  }

  function createGraph() {
    const ctx = new AudioContext();
    context = ctx;
    gain = ctx.createGain();
    gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const length = Math.floor(ctx.sampleRate * 4);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < length; i++) {
      brown = (brown + .02 * (Math.random() * 2 - 1)) / 1.02;
      // Short fades prevent a discontinuity at the loop boundary.
      const edge = Math.min(1, i / (ctx.sampleRate * .04), (length - 1 - i) / (ctx.sampleRate * .04));
      data[i] = brown * edge;
    }
    source = ctx.createBufferSource();
    source.buffer = buffer; source.loop = true;
    source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    source.start();
    ctx.addEventListener('statechange', () => paint(), { signal: abort.signal });
    return ctx;
  }

  async function synchronize() {
    const token = ++operation;
    window.clearTimeout(suspendTimer);
    suspendTimer = undefined;
    const shouldPlay = desired && !document.hidden;
    try {
      if (shouldPlay) {
        const ctx = context ?? createGraph();
        // Called synchronously from the user's click before awaiting.
        await ctx.resume();
        if (disposed || token !== operation || ctx !== context || !gain) return;
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(.12, ctx.currentTime + .4);
        paint('Ambient sound playing.');
      } else {
        paint(desired ? 'Ambient sound paused while this tab is hidden.' : 'Ambient sound off.');
        if (!context || !gain) return;
        const ctx = context;
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + .15);
        suspendTimer = window.setTimeout(() => {
          suspendTimer = undefined;
          if (disposed || token !== operation || ctx !== context) return;
          void ctx.suspend().catch(() => {});
        }, 180);
      }
    } catch {
      if (disposed || token !== operation) return;
      desired = false;
      releaseGraph();
      paint('Ambient sound unavailable. You can continue browsing with sound off.');
    }
  }

  button.addEventListener('click', () => { desired = !desired; void synchronize(); }, { signal: abort.signal });
  document.addEventListener('visibilitychange', () => { if (context) void synchronize(); }, { signal: abort.signal });
  button.hidden = false;
  paint('Ambient sound off.');
  return {
    dispose() {
      if (disposed) return;
      disposed = true; desired = false; operation++;
      abort.abort(); releaseGraph(); paint(); button.hidden = true;
    }
  };
}
