import { gainAt } from "./timing.mjs";
export const SOUNDS = Object.freeze({
  click: 0.055,
  pop: 0.16,
  whoosh: 0.32,
  chime: 0.5,
});
export const SAMPLE_RATE = 48000;

// Scene-local frames survive preceding trim changes. Cues removed by a trim
// are omitted; unknown/ambiguous scene names fail rather than drift silently.
export function resolveCues(edit, sheet) {
  if (sheet.version !== 1 || sheet.fps !== 30 || !Array.isArray(sheet.cues))
    throw Error("Invalid cue sheet. Use version 1 at 30 fps.");
  const scenes = new Map();
  let offset = 0;
  for (const cut of edit.cuts) {
    if (scenes.has(cut.scene)) throw Error(`Ambiguous scene: ${cut.scene}`);
    scenes.set(cut.scene, { ...cut, offset });
    offset += cut.out - cut.in;
  }
  return sheet.cues.flatMap((cue) => {
    const cut = scenes.get(cue.scene);
    if (!cut) throw Error(`Unknown cue scene: ${cue.scene}`);
    if (!Number.isInteger(cue.frame) || cue.frame < 0)
      throw Error("Cue frames must be nonnegative integers.");
    if (cue.frame < cut.in || cue.frame >= cut.out) return [];
    return [
      {
        id: cue.id,
        label: cue.label,
        sound: cue.sound,
        volume: cue.volume,
        frame: cut.offset + cue.frame - cut.in,
      },
    ];
  });
}
export function validateEffects(mix) {
  if (!Number.isFinite(mix.duration) || mix.duration <= 0 || mix.duration > 600)
    throw Error("Use a film between 0 and 600 seconds.");
  if (!Number.isInteger(mix.fps) || mix.fps < 1 || mix.fps > 120)
    throw Error("Invalid cue frame rate.");
  if (!Array.isArray(mix.effects) || mix.effects.length > 500)
    throw Error("Use at most 500 sound cues.");
  if (
    !Number.isFinite(mix.effectsVolume) ||
    mix.effectsVolume < 0 ||
    mix.effectsVolume > 1 ||
    typeof mix.effectsEnabled !== "boolean" ||
    typeof mix.musicEnabled !== "boolean"
  )
    throw Error("Invalid audio layer settings.");
  const ids = new Set();
  for (const cue of mix.effects) {
    if (typeof cue.id !== "string" || !cue.id || ids.has(cue.id))
      throw Error("Cue IDs must be unique.");
    ids.add(cue.id);
    if (
      typeof cue.label !== "string" ||
      cue.label.length > 120 ||
      !Object.hasOwn(SOUNDS, cue.sound)
    )
      throw Error("Invalid cue label or sound.");
    if (
      !Number.isInteger(cue.frame) ||
      cue.frame < 0 ||
      cue.frame / mix.fps >= mix.duration
    )
      throw Error(`Cue outside the film: ${cue.label}`);
    if (!Number.isFinite(cue.volume) || cue.volume < 0 || cue.volume > 1)
      throw Error("Cue volume must be between 0 and 1.");
  }
}

// Seeded noise: replay, seeking, and native export produce identical samples.
export function synthesize(sound, rate = SAMPLE_RATE) {
  if (!Object.hasOwn(SOUNDS, sound)) throw Error("Unknown sound.");
  const data = new Float32Array(Math.round(SOUNDS[sound] * rate));
  let seed = 127;
  for (let i = 0; i < data.length; i++) {
    const t = i / rate,
      p = i / data.length;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    const edge = Math.min(
      1,
      i / (rate * 0.001),
      (data.length - 1 - i) / (rate * 0.008),
    );
    if (sound === "click")
      data[i] =
        (noise * 0.4 + Math.sin(2 * Math.PI * 1800 * t) * 0.6) *
        Math.exp(-t * 100) *
        edge;
    if (sound === "pop")
      data[i] =
        Math.sin(2 * Math.PI * (420 * t - 650 * t * t)) *
        Math.exp(-t * 28) *
        edge;
    if (sound === "whoosh")
      data[i] = noise * Math.sin(Math.PI * p) ** 3 * 0.35 * edge;
    if (sound === "chime")
      data[i] =
        (Math.sin(2 * Math.PI * 1046.5 * t) +
          0.4 * Math.sin(2 * Math.PI * 1568 * t)) *
        0.5 *
        Math.exp(-t * 8) *
        edge;
  }
  return data;
}

/** Music channels must be decoded/resampled to rate. Both paths share fades,
 * cue samples, summation and peak headroom; normalization never boosts quiet audio. */
export function renderSoundtrack(
  mix,
  musicChannels = [],
  rate = SAMPLE_RATE,
  musicStart = mix.start,
) {
  if (mix.version === 2) validateEffects(mix);
  const length = Math.round(mix.duration * rate);
  if (!Number.isFinite(length) || length < 1 || length > rate * 600)
    throw Error("Invalid soundtrack length.");
  const channels = [new Float32Array(length), new Float32Array(length)];
  if (mix.musicEnabled !== false) {
    if (!musicChannels.length)
      throw Error("Load the music file before exporting.");
    const start = Math.round(musicStart * rate);
    for (let i = 0; i < length; i++) {
      const volume = gainAt(i / rate, mix);
      channels[0][i] = (musicChannels[0][start + i] || 0) * volume;
      channels[1][i] =
        (musicChannels[1]?.[start + i] ?? musicChannels[0][start + i] ?? 0) *
        volume;
    }
  }
  if (mix.effectsEnabled) {
    const cache = new Map();
    for (const cue of mix.effects) {
      if (!cache.has(cue.sound))
        cache.set(cue.sound, synthesize(cue.sound, rate));
      const sound = cache.get(cue.sound),
        start = Math.round((cue.frame / mix.fps) * rate);
      for (let i = 0; i < sound.length && start + i < length; i++) {
        const value = sound[i] * cue.volume * mix.effectsVolume;
        channels[0][start + i] += value;
        channels[1][start + i] += value;
      }
    }
  }
  let peak = 0;
  for (let i = 0; i < length; i++)
    peak = Math.max(peak, Math.abs(channels[0][i]), Math.abs(channels[1][i]));
  const headroom = peak > 0.95 ? 0.95 / peak : 1;
  if (headroom < 1)
    for (const channel of channels)
      for (let i = 0; i < length; i++) channel[i] *= headroom;
  return { channels, headroom };
}
export function encodeWav(channels, rate = SAMPLE_RATE) {
  const length = channels[0].length,
    count = channels.length;
  const bytes = new ArrayBuffer(44 + length * count * 4),
    view = new DataView(bytes);
  const text = (offset, value) =>
    [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 3, true);
  view.setUint16(22, count, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * count * 4, true);
  view.setUint16(32, count * 4, true);
  view.setUint16(34, 32, true);
  text(36, "data");
  view.setUint32(40, length * count * 4, true);
  for (let i = 0; i < length; i++)
    for (let ch = 0; ch < count; ch++)
      view.setFloat32(44 + (i * count + ch) * 4, channels[ch][i], true);
  return new Uint8Array(bytes);
}
