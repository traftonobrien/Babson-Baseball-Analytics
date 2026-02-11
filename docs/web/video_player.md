## Web App Video Player

The `VideoPlayer` component (`web/app/components/VideoPlayer.tsx`) plays overlay videos for selected pitches.

### Keyboard shortcuts

- **J** — Step back one frame (1/30s)
- **L** — Step forward one frame (1/30s)

These are global hotkeys (attached to `window`). Disabled when focus is on input/textarea/select elements or when modifier keys are held. Controlled by `DEBUG_HOTKEYS` and `VIDEO_FPS` constants.

### Fallback behavior

If the overlay video fails to load, the player falls back to the raw clip video.

### File resolution

- Overlay: `${overlayDir}/pitch_${id}_overlay.mp4`
- Clip: `${clipsDir}/pitch_${id}.mp4`

The pitch number from the CSV `pitch_number` column is used to construct filenames. Zero-padded to 3 digits.
