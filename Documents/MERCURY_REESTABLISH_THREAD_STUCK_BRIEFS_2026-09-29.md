# Mercury thread recovery and stuck-brief execution — 2026-09-29

## Outcome

The bound `samantha-app/app-architecture` thread is active again as
`01a00292-0b7c-70c2-ba14-f44c623937ae` (`Mercury: Chief Architect`). Both
2026-09-04 briefs were picked up and implemented in PRISM Android 2.4.14.

The candidate is built, served, hashed, and covered by automated verification.
Final brief closure remains blocked on the two required physical handset checks:
the current host reports no device from `adb devices -l`, and there is no
configured Android emulator.

## Product contracts

### Voice output parity

- The Android audio session exists only while a voice-room lifecycle is active.
- Communication routes are selected in the same order as VoiceBridge prod:
  Bluetooth communication device, wired/USB headset, then built-in earpiece.
- The built-in loudspeaker is never selected as a communication fallback.
- The pre-session audio mode, speakerphone state, and communication device are
  restored on disconnect or plugin destruction.
- LiveKit signaling, backend, token routing, and transport remain unchanged.

### Keyboard-safe task editing

- Android resizes the activity when the soft keyboard opens.
- The task-detail modal follows the dynamic usable viewport and retains a
  bounded scroll area.
- The active field is scrolled back into view when either `window` or
  `VisualViewport` resizes; focus and data handling are preserved.
- The larger outcomes field contracts on short viewports so its text remains
  visible while typing.

## Implementation

Voice route:

- `android/app/src/main/java/com/samantha/voice/VoiceAudioRoutePlugin.java`
- `android/app/src/main/java/com/samantha/voice/MainActivity.java`
- `src/services/voiceAudioRoute.ts`
- `src/services/voiceBridge.ts`
- `android/app/src/test/java/com/samantha/voice/VoiceAudioRoutePluginTest.java`

Keyboard handling:

- `android/app/src/main/AndroidManifest.xml`
- `src/views/EpicDetailView.tsx`
- `tests/backlog_projects.spec.ts`

Release metadata:

- `package.json`
- `package-lock.json`
- `android/app/build.gradle`

## Verification

- `npm run lint` — passed.
- `npm run test:routing` — 5/5 passed.
- `npm run test:memory` — 6/6 passed.
- `npm run test:e2e` — 41/41 passed.
- Keyboard regression — focused outcomes field remains focused and fully within
  a 390 × 420 keyboard-resized viewport.
- `npm run build` — passed, including production mobile-route verification.
- `npm run cap:sync` — passed, including compiled Android-route verification.
- `./gradlew testDebugUnitTest assembleDebug` with JDK 21 — passed.
- APK manifest — `versionName=2.4.14`, `versionCode=16`, min SDK 24, target SDK
  36, and `windowSoftInputMode=adjustResize` (`0x10`).
- APK DEX inspection — contains `com.samantha.voice.VoiceAudioRoutePlugin`.
- `git diff --check` — passed.

## APK proof

- Artifact: `android/app/build/outputs/apk/debug/app-debug.apk`
- Size: 6,908,412 bytes.
- SHA-256: `03017a6b82fa01560526409ae99b12bd7fc737c5ea65d9db5f37ceebd6d25fba`
- Tailnet download:
  `https://xenya.tail6504c1.ts.net/downloads/samantha-prism-2.4.14-earpiece-keyboard.apk`
- Remote response: HTTP 200, `application/vnd.android.package-archive`,
  6,908,412 bytes.
- Streamed remote SHA-256 exactly matches the local artifact.

## Required physical checks still blocked

1. Install 2.4.14 on the same phone used for VoiceBridge, connect without an
   external headset, and confirm Samantha plays through the earpiece rather than
   the loudspeaker.
2. Open a task detail, enter Edit, focus Description and Prompt & Outcomes, type
   with the Android soft keyboard open, and confirm the active field and text
   stay visible.

At execution time `adb devices -l` returned an empty device list and
`emulator -list-avds` returned no configured emulator. These are external-state
verification blockers, not implementation failures.

## PRISM delivery evidence

- Earpiece reply:
  `20260929-221407-mercury-app-mercury-prism-earpiece-audio-routing-parity-2026-09-04-reply`
- Keyboard reply:
  `20260929-221407-mercury-app-mercury-prism-edit-field-hidden-by-keyboard-2026-09-04-reply`
- Both child canonical deliveries reached `agent:main:main`, are `delivered`,
  and have receiver ACK files under `Prism/briefs/acks/`.
- Parent reply:
  `20260929-221459-mercury-app-mercury-reestablish-thread-pick-up-stuck-2026-09-29-reply`
  was created and queued to the same canonical session; its receiver ACK was
  still pending when this report closed.

## Constraints observed

- Source changes stayed inside `/Users/apple/samantha-app`.
- Existing unrelated dirty-worktree changes were preserved.
- No prompt, secret, backend, authentication, database, data-model, or LiveKit
  transport changes were made.
