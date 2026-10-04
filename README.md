# Nerdboard

Desktop virtual guitar, piano, drums, synthesizer, harmonium, and tabla played with a physical keyboard. Built with React, TypeScript, Vite, CSS, and the Web Audio API. Choose an instrument in the header; switching stops the previous instrument and its keyboard listeners.

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

## Tabla

- `A S D F`: Na, Tin, Tun, Te on the dayan (treble drum).
- `J K`: Ge, Ke on the bayan (bass drum).
- `L`: Dha (Na + Ge). `;`: Dhin (Tin + Ge). Combined strokes sound both drums with one key; individual keys can also be played together.
- Tap a key or click a pad. Na, Tin, Tun, and Ge ring out; Te and Ke are short and muted. Release and press again to repeat a stroke; holding a key ignores auto-repeat.
- Pads flash on each hit, with indicators while the sound rings. Focus a pad with Tab and use Enter/Space to strike it.
- Two visible practice loops show stroke names and keyboard keys. Play one stroke per beat at your own pace; these are short exercises rather than full traditional taal lessons.
- `Escape` or **Stop all** silences the tabla. Window blur, tab hiding, and instrument switching also stop sound.

The tabla uses original synthesized approximations of ringing treble, resonant bass, and damped strokes; it includes no acoustic recordings or audio downloads. Generated buffers and simultaneous voices are bounded. Stroke terminology varies by tradition; this mapping is informed by [David Courtney's tabla bol guide](https://chandrakantha.com/music-and-dance/instrumental-music/indian-instruments/tabla/tabla-basic-strokes-bols/). It does not simulate full hand technique or continuous bayan pressure bends.

To verify manually, select **Tabla**, try all eight keys and mouse pads, play `A + J` together and compare with `L`, then try the practice loops. Confirm repeated taps work, holding keys does not retrigger, Escape stops ringing, and switching away/back leaves no old notes or keyboard listeners. Browser playback and acoustic realism must be judged by listening.

## Synthesizer

- Opens with an **Alors-style pluck** preset: an original synthesized approximation of the opening sound in Stromae's *Alors on danse*.
- Uses the piano's white/black key mapping and mouse controls. Starts at C3–E4; `←` / `→` move the starting octave from C2 to C6.
- Mono playing: each new note takes over; held keys naturally decay. Release and press a key again to retrigger it. Enter/Space activates a focused key as a short note.
- **Brightness**, **Decay**, and **Echo** affect the next note. Echo adds one repeat at a fixed eighth-note delay of about 246 ms (122 BPM).
- **Reset preset** restores the starting tone and C3 octave. `Escape`, **Stop all**, blur, tab hiding, and instrument switching clear notes and echoes.

The original opening bass sound was played through Reason's NN-19 sampler, as shown in [Stromae's Reason interview](https://www.reasonstudios.com/news/post/stromae). This app uses two pulse oscillators, a triangle sub, a closing low-pass filter, and a short gain envelope, informed by [Syntorial's pluck remake](https://www.syntorial.com/preset-recipe/stromae-alors-on-danse-pluck/). It does not include the original sample, saxophone, drum backing, or song playback.

## Harmonium

- Uses the piano's white/black key mapping. Starts at C3–E4; `←` / `→` move the starting octave from C2 through C6. Hold several notes together for chords. Changing octave releases notes.
- **Manual pump** is the starting mode. Hold `Space` while holding note keys, or hold the **Hold to pump** button, to build air pressure. When you stop pumping, air fades out. Without air, held notes are silent.
- **Steady air** maintains a 65% supply so you can play with both hands without pumping.
- **Hinge bellows** starts disabled until you connect. No external sensor, cable, native installation, or macOS switch is needed. **Connect lid sensor** opens the browser's device chooser. On a compatible MacBook, select **las** if listed, or the Apple lid-angle sensor, then click the popup's **Connect / Pair** button. A successful connection normally selects **Hinge bellows**; move the lid gently while holding notes to supply air. You can switch back to manual or steady air while keeping the sensor connected for diagnostics.
- The sensor panel displays actual angle readings, the last interval, recent update rate, and reading age. The pressure model uses actual reported angle changes; it does not invent higher-frequency sensor samples. A low update rate may make hinge playing delayed or miss movements between samples.
- The browser path requires WebHID (for example, desktop Chrome/Edge), a compatible Apple lid-angle sensor, and HTTPS or localhost. Safari/Firefox and hardware without that sensor can still use manual or steady air. Hardware compatibility and responsiveness must be checked on your own machine.
- Focused buttons retain keyboard activation. Hold Enter/Space on the pump button to pump; Enter/Space on a note button plays a short note. Space on other focused buttons activates them instead of pumping.
- `Escape`, **Stop all**, window blur, and tab hiding stop notes, empty the air reservoir, and return to Manual pump. They keep an existing sensor connection available; **Disconnect** or instrument switching closes it. Selecting Hinge bellows again starts a fresh movement baseline.

The harmonium generates an original sustained reed approximation locally, with two subtly detuned harmonic reeds per note, a smooth pressure-controlled gain, and a bounded voice count. It includes no downloaded harmonium recordings or native helper. Inspired by [Hingemonium](https://github.com/Rocktopus101/Hingemonium); the direct browser input-report approach is also demonstrated in [LidPerspective](https://github.com/TANG617/LidPerspective) and [iPhone Solo](https://github.com/soloiaros/iphone-solo). Our sensor adapter only opens the selected sensor and listens to input reports; it does not write feature/output reports or change system settings. Browser permission is requested only when you click Connect.

The **Built-in lid sensor** panel includes visible check/connect/disable steps, troubleshooting, saved-permission removal, and an optional read-only macOS hardware check. A changing angle verifies actual readings; an enabled Connect button only verifies browser support and the page's secure context. An empty chooser does not prove the hardware is absent.

**Disconnect** closes the active connection but keeps the browser grant. To remove the grant in Chrome, click the site information icon left of the address, find the HID device / las entry, and click Remove. Reload this page before granting access again. If requests are blocked, check Chrome **Settings → Privacy and security → Site settings → Additional permissions → HID devices**; managed restrictions require the administrator. See [Chrome's device permission guide](https://support.google.com/chrome/answer/12576972?hl=en). The app does not change these browser settings.

### Manual verification

1. Run `npm run dev`, open the printed localhost URL on a desktop, and select **Harmonium**.
2. Choose **Steady air**, hold `A D G`, and release the keys. Confirm the chord sustains while held and stops after release. Check octave changes and keyboard/mouse note holds.
3. Select **Manual pump**. Hold `A` and `Space`; confirm pressure and volume rise. Release Space and keep A held; confirm both fade. Repeat with the pump button.
4. Click **Connect lid sensor** and explicitly select the sensor. Move the lid gently and check angle, interval, rate, and pressure. Judge whether the response is usable; the code/build alone cannot establish this.
5. Cancel the chooser, disconnect/reconnect, press Escape, switch instruments, leave the window, and hide the tab. Confirm notes do not stick, pressure resets, and switching closes the sensor connection.
6. In a browser without WebHID, confirm the sensor panel explains its unavailability and manual/steady air still work. No OS or browser flags should need changing for these fallbacks.
