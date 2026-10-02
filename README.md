# Nerdboard

Desktop virtual guitar, piano, and drums played with a physical keyboard. Built with React, TypeScript, Vite, CSS, and the Web Audio API. Choose an instrument in the header; switching stops the previous instrument and its keyboard listeners.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Audio starts after the first playing gesture. All instruments generate their sound locally; no audio downloads are needed.

## Guitar

- `Q W E R T Y`: pluck the six strings, low E through high E.
- Hold `A S D F G`: open string or frets 1–4. Release a fret key to release notes fretted with it.
- Hold `Z X C V B N M`: C, G, D, A, E, Am, Em chord shapes. Press `Space` to strum, or pick individual strings.
- `Space`: downstroke. `Shift` + `Space`: upstroke.
- Hold `H`: vibrato on sounding notes.
- While notes sound, drag horizontally across the guitar to bend their pitch. Release the mouse to return to pitch.

Keyboard auto-repeat is ignored. Releasing a pluck/strum key releases its notes; releasing a fret or chord key also releases notes it held. Window blur and tab hiding stop all sound.

## Piano

- White keys: `A S D F G H J K L ;` → C D E F G A B C D E.
- Black keys: `W E T Y U O P` → C♯ D♯ F♯ G♯ A♯ C♯ D♯.
- Starts at C4–E5. `←` / `→` or the octave buttons move the starting octave from C2 through C6, reaching E7. Changing octave stops current notes and resets sustain.
- Play several keys together for chords. Try `A D G` for C major.
- Hold `Space` to sustain notes after releasing their keys. Release Space to damp them. Click **Sustain** to latch the pedal; click again to release it. A latched pedal stays on when Space is released.
- Press and hold a piano key with the mouse, or focus it with Tab and use Enter/Space for a short note. Space activates a focused button instead of the pedal.
- `Escape` or **Stop all** silences the piano and resets sustain. Window blur, tab hiding, and instrument switching also stop sound.

The piano uses a synthesized hammer strike and decaying harmonics, not recorded piano samples. Notes naturally decay even with the pedal held. Keyboard auto-repeat is ignored; the sound engine caps simultaneous voices and caches a bounded number of generated samples.

## Drums

- `A`: kick. `S`: snare. `D`: closed hi-hat. `F`: open hi-hat.
- `J`: high tom. `K`: low tom. `L`: crash. `;`: ride.
- Tap a mapped key or click a pad to strike it. Several keys can strike together. Each hit rings out after release; holding a key does not repeat it.
- The closed hi-hat chokes an open hi-hat that is still ringing.
- Pads flash on each hit; their indicator stays lit while the sound rings.
- Focus a pad with Tab and use Enter/Space to strike it.
- `Escape` or **Stop all** silences the kit. Window blur, tab hiding, and instrument switching also stop sound.

The kit uses synthesized percussion, not recorded acoustic drum samples. Generated sounds are cached and simultaneous voices are capped.
