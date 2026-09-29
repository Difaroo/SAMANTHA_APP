# Mercury VoiceBridge status feedback and APK delivery — 2026-09-02

## Outcome

The PRISM app now shows a live, truthful Voice bridge connection journey and names the exact checkpoint on failure. The rebuilt purple-flame APK is available from a Tailnet HTTPS download URL suitable for David's Android over 5G with Tailscale connected.

Product invariant: a Voice connection attempt must always expose its current checkpoint, and a failed attempt must retain the checkpoint that failed rather than collapsing to a generic error.

## Contract

The app exposes five ordered connection checkpoints:

1. Initialising
2. Fetching token
3. Joining room
4. Audio ready
5. Connected & ready

Each checkpoint is rendered as Waiting, In progress, Complete, or Failed. The state is driven by real adapter boundaries:

- Initialising begins when the connection lease and abort lifecycle start.
- Fetching token begins immediately before the production credential request.
- Joining room begins immediately before `room.connect`.
- Audio ready begins while the microphone session and local audio publication are established; it completes only when the client advances to the worker handshake.
- Connected & ready begins while waiting for the complete generation-scoped `ready_ack`; the compact connected status appears only after that acknowledgement.

The adapter retains `failedStep` independently of its terminal `error` stage, so cleanup or retry handling cannot erase the point of failure. The failure alert repeats that checkpoint and includes the underlying actionable error.

## Root cause and implementation

The live stage data already existed in `VoiceBridgeSnapshot`, but the Voice screen rendered it into a single absolutely positioned line whose `top` and `bottom` bounds cross on a typical Android viewport. The resulting region had no usable height, making the status effectively invisible. Moving more strings through that hidden region would not have fixed the user outcome.

The fix:

- adds a domain-level `VoiceConnectionStep` and `failedStep` contract to the adapter snapshot;
- emits a checkpoint at each actual token, room, audio, and readiness boundary;
- renders a fixed, accessible five-step progress card during disconnected/connecting/error states;
- renders a compact `Connected & ready` live-status pill after readiness;
- marks completed/current/pending/failed steps visually and through accessible text;
- names the failed step in both the progress card and loud error alert;
- removes the invalid hidden status region;
- suppresses the decorative centre flame only on terminal failure so it cannot overlap the alert on a 390 × 844 Android viewport.

## Verification

- Full Playwright suite: 31/31 passed.
- New contracts cover:
  - all five stages visible while disconnected;
  - Initialising complete and Fetching token active during a deliberately held credential request;
  - Connected & ready status after a successful mock connection;
  - Fetching token marked Failed and repeated in the alert after HTTP 404.
- ESLint: passed when rerun sequentially. An earlier parallel lint invocation raced with Playwright deleting `test-results`; it was a filesystem timing issue, not a lint finding.
- Production TypeScript/Vite build and mobile routing verification: passed.
- Capacitor Android sync and copied-asset routing verification: passed.
- Gradle `assembleDebug`: passed, 154 tasks (28 executed, 126 up to date).
- APK signature and ZIP alignment verification: passed.
- All 15 purple-flame launcher resources still byte-match their packaged APK entries.

### Real Voice acceptance

The final production-configured build was exercised against the real `samantha-room` with a deterministic synthetic microphone track. The visible UI history was:

`Fetching token → Joining room → Audio ready → Connected & ready`

The connected screen displayed `Connected & ready · Samantha is speaking`, had one subscribed remote audio element, and retained a live outgoing audio track. Worker proof for generation 27 recorded:

- `Received connected_and_ready from david`
- `Audio track subscribed for david`
- readiness complete in 1.030 seconds

Screenshots:

- `.ai/private-evidence/mercury-voice-status-live-fetching.png`
- `.ai/private-evidence/mercury-voice-status-live-connected.png`
- `.ai/private-evidence/mercury-voice-status-failure.png`

## APK and download

- Local path: `android/app/build/outputs/apk/debug/app-debug.apk`
- Size: 6,465,011 bytes (6.2 MB)
- SHA-256: `489aa440ff75811451603a48b06e6e8e06481aed44fe85f7cd340cd57e67683a`
- Download URL: `https://xenya.tail6504c1.ts.net/downloads/samantha-prism-2.4.0-status.apk`

The Tailnet URL returns HTTP 200 with `application/vnd.android.package-archive`, content length 6,465,011, and a streamed SHA-256 equal to the local APK.

Delivery is deliberately narrow:

- PM2 process `samantha-apk-download` serves only the debug APK output directory on `127.0.0.1:8090`.
- Tailscale Serve exposes only the exact APK path above.
- The existing `/prism` proxy remains unchanged.

## Android install steps

1. Connect the Android phone to the Difaroo Tailnet in the Tailscale app.
2. Open `https://xenya.tail6504c1.ts.net/downloads/samantha-prism-2.4.0-status.apk` in the phone browser.
3. Download the APK and tap the completed download.
4. If Android asks, allow that browser to install unknown apps.
5. Choose Update/Install. The package remains `com.samantha.voice`, so it updates the current debug build when signed with the same local debug key.
6. Open Samantha, select Voice, and tap Connect. The five-stage card now identifies the live checkpoint or exact failure.

## Constraints observed

- All source, asset, APK, evidence, and report writes stayed inside `/Users/apple/samantha-app`.
- The only external runtime changes were the explicitly requested narrow APK server and Tailscale download route.
- PRISM dispatch, gateway configuration, database state, and Voice production services were not changed.
- The Voice join, subtitles, drag-and-drop, and purple-flame launcher work remain intact and are covered by the passing regression suite.
- Pre-existing dirty-worktree changes were preserved.
