# Sound studio

A local-first music editor for the komo launch film. Import a song, inspect its waveform, choose an excerpt, align a beat to a scene cut, preview volume/fades, and save a repeatable mix. No accounts, cloud uploads, catalog keys, or new runtime dependencies.

## Run

Requires Node 22.12+. From the repository root:

```sh
pnpm audio:studio
```

Open http://127.0.0.1:4341. By default it reads `../komo-promo/out/film.mp4` and the tracked `tools/launch-video/remotion/edit.json`. Render that film using its existing README. For the older local `videos/` buildout:

```sh
pnpm audio:studio --video videos/out/film.mp4 --edit videos/src/edit.json
```

The server binds only to localhost and serves an explicit file allowlist. You can also replace the video in the browser; its original cut map is then removed rather than applied to a different edit. The first frame remains an alignment target. Missing media does not stop the editor: choose a video from disk.

1. Choose a song, or try the original 120 BPM demo (also downloads a WAV for export).
2. Drag the highlighted waveform excerpt, use the slider, or enter a start time.
3. Select a scene cut and choose **Align beat to selected cut**. Adjust estimated BPM / first beat by ear if needed.
4. Play, set volume and fades, then **Save mix settings**.
5. Export with the command below.

**Loop on** beside Play repeats the video and the complete music/effects mix until paused. Turn it off to stop at the next ending. Looping is a preview setting; exported MP4s contain one full pass.

## Export full-quality MP4

Install FFmpeg (including FFprobe) through your usual package manager. Files remain local. Paths with spaces must be quoted.

```sh
node videos/audio/mix.mjs \
  --video /path/film.mp4 \
  --song /path/song.wav \
  --mix /path/komo-mix.json \
  --out /path/film-with-music.mp4
```

Run this after the normal Remotion build/assembly; there is no reason to re-render the pictures to audition another song. The exporter copies the video stream and adds a 192 kbps AAC track. **Music replaces any original audio.** It refuses to overwrite an existing output, rejects stale duration / short excerpts / invalid fades, and never shells user values into commands. Outputs should stay outside Git, alongside your existing rendered film.

The hosted browser preview saves the mix recipe; the local studio also provides a direct MP4 download through FFmpeg. Keep the original song and video alongside it; the JSON stores timing, not embedded media. Changing or reordering an edit requires reviewing and saving its mix again even if the total duration stays the same.

## Tempo, not RPM

The song analyzer estimates BPM from its onset envelope and autocorrelation. It also estimates a beat phase. Syncopated music, intros, changing tempos, and half/double time can confuse it: all values are editable, and weak/no pulse is labeled. This is a constant-tempo grid, not downbeat or time-stretch detection.

A silent film has no intrinsic musical BPM. **Suggested cut rhythm** finds the 70–180 BPM grid that best fits scene lengths; it is an editing suggestion, not a measurement of all visual motion. Matching the song BPM to it is optional. Alignment moves the song excerpt so one beat falls on the selected cut; it does not retime scenes or promise every cut hits a beat.

The browser decodes supported formats locally (up to 100 MB / 15 minutes). Playback uses the video as its clock, corrects audio drift, and pauses the complete soundtrack on buffering or seeking. Encoded export is authoritative for frame-accurate review.

## Catalogs

Spotify cannot power this feature: its [Developer Policy](https://developer.spotify.com/policy) prohibits synchronizing recordings with visual media. Its streaming access is not an audio file export license.

[Jamendo Licensing](https://licensing.jamendo.com/) offers music licenses for video. Import a licensed download here. Its [public API](https://developer.jamendo.com/v3.0/docs) and [API terms](https://devportal.jamendo.com/api_terms_of_use) are separate from commercial sync licensing; do not assume a public API result grants a commercial video license. A future searchable catalog requires an appropriate provider agreement and credentials. This version deliberately works without them.

## Review preview

After `pnpm build`, stage the editor and a matching film/cut map into the existing site Worker output:

```sh
node videos/audio/preview.mjs /path/film.mp4 /path/edit.json
pnpm exec wrangler versions upload --config packages/komo-site/wrangler.jsonc --preview-alias audio-studio
```

Open the returned preview URL at `/audio/`. This is a preview version of `komo-site`, not a production deployment. Normal site builds do not include the editor or video. Staging checks film duration against the cut map and grants blob media playback only on this review route. Song imports stay in the browser on the hosted preview too.

## Verify

```sh
node --test videos/audio/timing.test.mjs
```

The tests cover pulse estimation, trimmed cut timing, beat alignment at excerpt boundaries, and export validation. The helpers in the existing untracked `videos/` Remotion scaffold are private skill assets; this directory contains only the new independently authored audio tools.

## Animation sound effects

The model authors `videos/audio/cues.json` from the animation source, using a **scene name and scene-local frame**. The supplied 78 cues cover title words and pins; all three incoming conversation comments and their typing/reactions; all six feed arrivals; search click, expansion, eight keystrokes and filtering; toolbar morphs, menu focus changes, click/release pairs, copy confirmation, composer focus, paste, send feedback and logo arrival. Primary clicks use higher levels than typing and hover textures. A cue is resolved through the edit's trims into a film frame. Trimmed-away cues are omitted; unknown or repeated scene names fail rather than silently drifting. When an animation's internal timing changes, update its cue frame too.

```json
{
  "id": "copy",
  "scene": "copy",
  "frame": 42,
  "sound": "click",
  "volume": 0.55,
  "label": "Copy prompt"
}
```

Effects use all 17 sounds from [Cuelume](https://cuelume-site.pages.dev/) v0.2.2, MIT licensed, copyright Daniel Belyi. The pinned upstream engine is rendered through offline Web Audio into cached 48 kHz WAVs; its license ships with the bank. Generated samples stay outside Git and are prepared automatically by the local server, mixer, tests and preview staging. Legacy `click`, `pop`, and `whoosh` recipes map to `press`, `droplet`, and `page`. Keep the cue sheet's `version: 1`, `fps: 30`, and `cues` array. The local server accepts `--cues /path/cues.json`; **Import cue sheet** replaces the browser's cues. Replacing the film in the browser clears old scene cues to prevent accidental reuse.

In the editor, each cue has an absolute film **Frame**, sound, and volume. Click a timeline marker to seek, **Hear** to audition, or **Add at playhead** to add a cue. You can remove cues, restore the loaded scene sheet, and mute or adjust the entire effects layer. These edits are included in the saved version-2 mix JSON. Cue timing stays attached to the video when the song excerpt moves. Version-1 music-only mixes remain exportable.

Preview and export use the same cached Cuelume 48 kHz samples, stereo music summation, fades and peak headroom calculation. Overlapping effects are summed; the combined track is only attenuated if needed to keep its sample peak at or below 0.95. The final MP4 uses AAC, so encoded samples differ from the uncompressed preview. The original video soundtrack is replaced by this complete mix.

### Export everything

**Local studio:** click **Export MP4**. The browser passes the selected files and recipe to its localhost server, which runs FFmpeg and returns a **Download MP4** link for `komo-with-sound.mp4`. Uploaded inputs are deleted after encoding. The download remains available for ten minutes (at most five recent exports), then its temporary file is removed. The endpoint accepts only same-origin local studio requests, caps uploads at 160 MB, and runs one export at a time. Films are limited to ten minutes and cue sheets to 500 events.

**Hosted review preview:** use **Export MP4 locally** to save the recipe, then run the documented mixer command on your machine. There is no cloud upload or remote encoder. For an effects-only mix, omit `--song`; the recipe's `musicEnabled` must be `false`. The MP4 includes the original picture, optional music, and every enabled effect.

```sh
pnpm audio:test
```

These checks additionally cover scene-trim resolution, known animation click frames, sample-exact onset placement, stereo summation, deterministic sounds, overlapping cue headroom, effect muting, and malformed cue validation.

The preview staging command accepts an optional third positional path to an already-exported demo MP4; when supplied it adds a **Watch exported demo** link. Generated media remains outside Git.
