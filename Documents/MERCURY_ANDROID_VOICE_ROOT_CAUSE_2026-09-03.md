# Android voice root-cause fix — 2026-09-03

## Product invariant

After **Connect**, the PRISM Android app must publish the handset microphone before announcing readiness. The worker must then deliver Samantha's first-turn audio, accept handset speech as the authenticated participant, and return spoken audio.

## Root causes

1. `com.samantha.voice` declared `RECORD_AUDIO`, but had never received the Android runtime grant. The existing `WebChromeClient` granted the WebView request without first obtaining the package-level permission. Chromium therefore joined LiveKit without a recording device, and the worker remained at `waiting_for=session+client+audio`.
2. The foreground-service loader returned a Capacitor plugin proxy from an async function. Promise resolution inspected the proxy's `then` property, causing Capacitor to invoke the nonexistent native method `ForegroundService.then()`.

## Fix

- `MainActivity` now bridges WebView audio capture to Android's runtime `RECORD_AUDIO` request, grants only `RESOURCE_AUDIO_CAPTURE` after approval, and denies unrelated WebView permission requests.
- The foreground-service loader now returns a plain typed wrapper around the Capacitor proxy, preventing Promise thenable assimilation.

## Verification

- `npm run lint` — passed.
- `PLAYWRIGHT_BROWSERS_PATH=.ai/playwright-browsers npm run test:e2e` — 31/31 passed.
- `npm run cap:sync` — passed, including production and copied-Android routing verification.
- `./gradlew assembleDebug` using Android Studio JBR — `BUILD SUCCESSFUL`.
- Rebuilt APK installed over USB on physical Huawei CLT-L09 / Android 10 — succeeded.
- Android package state — `android.permission.RECORD_AUDIO: granted=true`.
- Android runtime — `AudioRecord` opened for `com.samantha.voice`.
- LiveKit worker — handset audio track subscribed; `connected_and_ready` received; readiness completed in 1.424 s.
- First turn — central OpenClaw turn dispatched; Kokoro generated two clauses; the handset acknowledged both audio deliveries.
- Spoken-input loop — authenticated handset STT final accepted; OpenClaw generated “I can hear you, love. The loop's working.”; Kokoro rendered both clauses; the handset acknowledged both audio deliveries. End-to-end response latency was 4.339 s.

APK SHA-256:

`1a97c784fe451982d6fad85ea15a011d7be4f985c4891e9d534227d7297dea02`

## Constraints

- Android runtime grants are package-specific; installing a separate Samantha package with microphone access does not grant PRISM access.
- A fresh install will show the standard Android microphone prompt on first Connect. Denial intentionally prevents readiness rather than falsely reporting a working voice session.
- The verification session observed one transient local OpenClaw transport refusal before a subsequent authenticated utterance completed normally. This did not affect microphone capture, LiveKit transport, or TTS delivery, but it remains backend-operational evidence rather than an Android client defect.
