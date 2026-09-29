# PRISM VoiceBridge conversation-loop parity — 2026-09-02

## Status

Implementation and real-service verification are complete. Final acceptance is
blocked only on the required same-phone APK run because `adb devices -l` reports
no attached Android device.

## Outcome

The PRISM client now follows VoiceBridge prod's connection ordering: establish
the Android foreground/audio lifecycle, join LiveKit, publish the microphone via
LiveKit's microphone lifecycle, then send `connected_and_ready`. A real Tailnet
run proved the first greeting, microphone-to-STT turn, OpenClaw response, TTS
audio, and client delivery acknowledgement.

Product invariant: a room is not declared ready until the user's microphone
track is published and the worker acknowledges session, client, and audio
readiness. The app transports microphone, remote audio, subtitles, and control
events; STT, turn policy, OpenClaw, and TTS remain owned by VoiceBridge.

## Exact behavioural diff

VoiceBridge prod performs:

1. start foreground service and native communication audio session;
2. fetch credentials and join the room;
3. call `localParticipant.setMicrophoneEnabled(...)`;
4. send `{ "action": "connected_and_ready" }` until a complete `ready_ack`;
5. let the worker initiate the greeting and process microphone turns.

PRISM previously performed:

1. fetch credentials and join the room;
2. call web `room.startAudio()`;
3. start the Android foreground service after the join;
4. manually create and publish a web audio track;
5. only then send `connected_and_ready`.

The failed handset run made the boundary unambiguous: LiveKit recorded the
Android WebView participant joining, but VoiceBridge recorded neither an audio
track subscription nor `connected_and_ready`. Execution had stalled in PRISM's
post-join foreground/manual-track path. Without the audio track and readiness
event, the worker correctly withheld both the first turn and STT ingestion.

## Fix

`src/services/voiceBridge.ts` now:

- starts the foreground/audio lifecycle before any LiveKit join attempt;
- uses `localParticipant.setMicrophoneEnabled(...)`, matching VoiceBridge prod,
  instead of manually creating and publishing a separate local track;
- publishes `connected_and_ready` only after microphone publication completes;
- keeps the foreground service alive across bounded room-rejoin attempts;
- preserves existing PTT, subtitles, delivery acknowledgement, status stages,
  reconnect handling, and cleanup behavior.

No VoiceBridge backend or prompt was changed.

## Verification

- `npm run lint`: passed.
- `npm run test:e2e`: 31/31 passed, including Voice controls/protocol, subtitles,
  routing, sync, and drag-and-drop contracts.
- `npm run build`: passed with production routing verification.
- `npm run cap:sync`: passed with copied Android routing verification.
- `./gradlew assembleDebug`: `BUILD SUCCESSFUL`; Android pre-build routing gate
  passed.
- APK Signature Scheme v2: passed.
- APK zip alignment: passed.
- Packaged routes: exact raw-IP Voice token and LiveKit routes present; stale
  MagicDNS Voice routes absent.

### Real Tailnet conversation proof

Using the production bundle and actual VoiceBridge services, a deterministic
spoken-audio fixture was injected into the published microphone stream. The
worker recorded this complete sequence:

1. participant joined;
2. `connected_and_ready` received;
3. microphone audio track subscribed;
4. readiness complete in 0.016 seconds;
5. central OpenClaw first turn dispatched;
6. first greeting text arrived in 3.103 seconds and Kokoro audio was delivered;
7. authenticated David speech reached final STT and turn policy submitted it;
8. STT transcription delay was 0.323 seconds;
9. reply text arrived in 2.648 seconds;
10. Kokoro reply audio was delivered and acknowledged by the PRISM client.

The UI traversed `Listening`, `Samantha is speaking`, `Inputting`, and
`Samantha is speaking` again. The microphone track remained live/enabled, one
remote audio element was attached, and the browser emitted no console errors.

Private screenshot proof:
`.ai/private-evidence/mercury-mic-stt-parity.png`.

## Artifact

- APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Bytes: `6,465,011`
- SHA-256: `82d768eba96e19009e784811fec6502b2bc1de72ee81f5d70b1e877e9d9ef980`
- Tailnet-only download:
  `https://xenya.tail6504c1.ts.net/downloads/samantha-prism-2.4.0-conversation-loop-parity.apk`
- Remote download: HTTP 200 with Android APK MIME type; remote SHA-256 matches
  the local artifact.

## Remaining acceptance blocker

The rebuilt APK must be installed on David's same phone with Tailscale enabled,
then checked for first greeting and one spoken reply. No ADB device is available
to this workstream, so this last physical-device assertion is not claimed.
