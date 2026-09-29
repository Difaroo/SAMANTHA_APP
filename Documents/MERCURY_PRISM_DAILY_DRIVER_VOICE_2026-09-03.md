# PRISM daily-driver voice release — 2026-09-03

## Product invariant

When PRISM reports **audio ready**, the Android handset must have a real audio publication, must receive and acknowledge Samantha's first rendered turn, and any user-selected voice speed must be the speed sent to Kokoro. Voice speed is a transport setting, not a suggestion that depends on the language model remembering a prompt convention.

## Released versions

- PRISM Android: **2.4.1** (`versionCode 3`)
- Samantha Voice Bridge: **2.6.1**
- Voice Bridge comparison point: repository HEAD `58c3910` already contained the current public signaling ingress on top of the `daeaa8e` 2.6.0 stabilization release. The post-2.6.0 delta did not contain a newer client conversation or speed-control implementation to copy into PRISM.

## Root causes

### First turn and microphone

PRISM's initial push-to-talk connection attempted to mute the microphone before LiveKit had ever published an audio track. The Voice Bridge therefore reached session/client readiness but could remain waiting for audio forever. PRISM now publishes the microphone once, then mutes it for PTT. This gives the worker a real subscribed track without leaving the microphone open between presses.

### Voice speed

Voice Bridge 2.6.0 treated model-authored `<speed ratio>` tags as the effective control plane. Explicit speech such as “Can you slow your voice down?” only worked if Samantha inferred the request and emitted the tag. After context compaction or prompt drift she could say “Slower now” while every Kokoro request remained at `speed=0.9`.

Voice Bridge 2.6.1 has one explicit speed authority:

- a numeric fixed speed always reaches the Kokoro payload;
- Auto mode continues to permit expressive model-authored speed tags;
- unambiguous spoken commands update the same authority before response generation;
- `set_voice_speed` accepts a validated ratio from `0.5` to `2.0`, or `null` to restore Auto;
- `voice_settings` acknowledges the effective ratio and mode to PRISM;
- PRISM persists the fixed preference and sends it before the readiness handshake, so it applies to the first turn after reconnect.

## PRISM control surface

The Voice view now exposes a **VOICE SPEED** slider (`0.50×`–`2.00×`), an exact effective value, Fixed/Auto state, and an **AUTO** reset. A valid speed acknowledgement received after a spoken command also updates the UI and persisted preference.

## Physical Android proof

Target: tethered Huawei CLT-L09, Android 10, package `com.samantha.voice`.

1. Installed PRISM 2.4.1 over the tethered device; `RECORD_AUDIO` is granted.
2. Connected in PTT mode. Worker log confirmed `Audio track subscribed for david`.
3. Set `0.70×` in PRISM. Worker accepted `Voice speed fixed → 0.70x`; Kokoro rendered “Still here, love” and the following segment at `speed=0.7`; the handset acknowledged both delivery IDs.
4. Through the physical handset, repeated the previously failing sentence: “Can you slow your voice down? Does that work?”
5. Worker changed the authoritative speed to `0.55×` before Samantha's response. Kokoro rendered “Yes, love — I can” and “Slower now” at that speed, and the handset acknowledged the first delivered segment. PRISM displayed **FIXED · 0.55×**.
6. Rebuilt PRISM was then left connected while `samantha-v5` was restarted. On participant rejoin, PRISM replayed `0.55×` before readiness; the replacement worker logged the setting, subscribed the handset audio track, rendered all three first-turn segments at `speed=0.55`, and received all three handset delivery acknowledgements.

The pre-fix failure and post-fix canary are preserved in the local Voice Bridge transcript/log history. The persisted control currently remains fixed at `0.55×`; use **AUTO** or the slider in PRISM to change it.

## Verification

### Voice Bridge 2.6.1

- `npm test` — **292 passed, 10 skipped**
- Python compilation of the modified runtime modules — passed
- scoped `git diff --check` — passed
- PM2 `samantha-v5` — online, reported version **2.6.1**
- startup gates — gateway, Kokoro, and LiveKit healthy; worker connected

### PRISM 2.4.1

- `npm run lint` — passed
- `npm run test:e2e` — **34 passed**; routing and memory node suites also passed
- final Voice UI/protocol regression subset after the PTT status polish — **14 passed**
- `npm run build` — passed; only the existing Vite large-chunk advisory remains
- `npm run cap:sync` — passed, including production/mobile route verification
- Android Gradle APK build — passed
- physical install and package inspection — `versionName=2.4.1`, `versionCode=3`, microphone permission granted

## APK

- Local artifact: `android/app/build/outputs/apk/debug/app-debug.apk`
- Tailnet download: `https://xenya.tail6504c1.ts.net/downloads/samantha-prism-2.4.1-daily-driver.apk`
- SHA-256: `feff72ea60ac595db60645cfc980024908bc3cdb7acaf8256ddcfbda57c8208f`
- The downloaded bytes were hashed and matched the local artifact.

## Constraints and ownership

- PRISM owns the mobile preference, display, reconnect resend, and microphone publication lifecycle.
- Voice Bridge owns validation, authoritative effective speed, spoken-command interpretation, and the final Kokoro ratio.
- Samantha's core prompt remains useful for expressive Auto-mode prosody, but correctness no longer depends on prompt obedience.
- No adjacent Samantha core/personality files were modified.
- Both repositories already contained unrelated working-tree changes; they were preserved.
