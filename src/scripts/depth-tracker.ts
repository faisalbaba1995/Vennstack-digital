import { mixHex, sampleDepth, type DepthGeometry } from '../experience/depth-model';
export function initDepthTracker(getGeometry: () => DepthGeometry) {
  const value = document.getElementById('depth-value');
  const zone = document.getElementById('depth-zone');
  const pressure = document.getElementById('depth-pressure');
  const ocean = document.getElementById('ocean-bg');
  let lastValue = '', lastZone = '', lastPressure = '', lastPalette = '';
  return { update(scrollY = window.scrollY) {
    const state = sampleDepth(scrollY, getGeometry());
    const nextValue = Math.round(state.depth).toLocaleString();
    const nextPressure = `scaleX(${state.progress.toFixed(4)})`;
    const top = mixHex(state.zone.top, state.next.top, state.mix);
    const bottom = mixHex(state.zone.bottom, state.next.bottom, state.mix);
    const accent = mixHex(state.zone.accent, state.next.accent, state.mix);
    if (value && nextValue !== lastValue) value.textContent = lastValue = nextValue;
    if (zone && state.zone.zone !== lastZone) zone.textContent = lastZone = state.zone.zone;
    if (pressure && nextPressure !== lastPressure) pressure.style.transform = lastPressure = nextPressure;
    const palette = `${top}|${bottom}|${accent}`;
    if (palette !== lastPalette) {
      if (ocean) ocean.style.background = `linear-gradient(180deg, ${top}, ${bottom})`;
      const number = Number.parseInt(accent.slice(1), 16);
      document.documentElement.style.setProperty('--accent', accent);
      document.documentElement.style.setProperty('--accent-rgb', `${number >> 16}, ${(number >> 8) & 255}, ${number & 255}`);
      lastPalette = palette;
    }
    return state;
  } };
}
