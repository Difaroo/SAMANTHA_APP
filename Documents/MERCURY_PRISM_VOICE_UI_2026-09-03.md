# PRISM Voice UI release — 2026-09-03

## Product invariant

PRISM must open on a collision-free Voice surface whose visible state truthfully reflects the live conversation: Samantha is only shown as Speaking while LiveKit identifies her as an active speaker, subtitles remain readable over the centred brand lockup, and the primary action is always unambiguous.

## Outcome

Released PRISM Android **2.4.2** (`versionCode 4`) with the following Voice control contract:

- Voice is the initial view on every fresh app launch.
- The native splash and Voice view use the same black-to-purple background and centred purple flame/SAMANTHA lockup.
- The progress panel and top connected lozenge are removed. One colour-coded text status appears between the main control and navigation: Initializing, Fetching token, Joining room, Audio ready, Connected, Ready, Speaking, Thinking, Listening, Standby, or an error.
- Samantha's lockup remains centred and fades to 20% opacity after connection; subtitles render above it.
- Subtitles are always on, use a 5% smaller type size, omit quotation marks, group consecutive captures from one speaker into one card, and fade into the darkness behind the main control.
- The central control connects while offline and disconnects while connected. In PTT mode it becomes the hold-to-talk microphone control.
- The side PTT toggle uses a stop-microphone icon: purple when PTT is off and white when it is on.
- Voice speed is a bottom-left readout. Hold it to reveal a vertical fixed-speed slider; tap it to return control to Samantha in Auto mode.

## Speaking/listening root cause

The remote HTML audio element's `timeupdate` event was being treated as proof that Samantha was speaking. A live media track's clock continues to advance through silence, so the UI repeatedly reverted to Speaking while Samantha was actually listening. Incoming transcription packets could also force the same incorrect state.

LiveKit `ActiveSpeakersChanged` is now the sole authority for Samantha's Speaking state. Media element events retain only delivery-observation duties while Samantha is already known to be speaking. A final local-user transcript transitions the display to Thinking; Samantha subtitle delivery does not invent a speaking state.

## Verification

- `npm run lint` — passed.
- `npm run test:e2e` — **34 passed**.
- Final navigation, Voice UI, contract, and protocol regression subset — **20 passed** after the final status wording adjustment.
- `npm run cap:sync` — passed, including production mobile route verification.
- Android Gradle `assembleDebug` — passed; only existing Gradle deprecation/flat-directory advisories remain.
- Scoped `git diff --check` — passed.
- Pixel-equivalent browser QA at 393 × 852 verified disconnected, connected, PTT, subtitle-overlay, and held-speed-slider layouts without overlap.
- Physical Android connection progressed through the connection states, rendered Samantha's first-turn subtitle, entered Speaking during her audio, and returned to Listening when her active-speaker state ended.
- Installed the final APK on the tethered Huawei CLT-L09. Package inspection reports `versionName=2.4.2`, `versionCode=4`, and `RECORD_AUDIO` granted.

## Native splash verification constraint

The generated portrait splash asset was rendered and visually inspected, packaged by the successful Android build, and installed in the final APK. The handset was secured by its owner lock during final verification, so no claim is made that a native cold-launch screenshot was captured from the physical screen.

## Artifact

- APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- SHA-256: `8db182cceccb79467cb6bf0e1807972aff62d04aea082f960cba6e0c59bf45cf`

## Constraints

- The change is limited to the PRISM app root and its Android package.
- Existing unrelated working-tree changes were preserved.
- The Voice Bridge transport and Samantha personality were not redesigned for this UI release.
