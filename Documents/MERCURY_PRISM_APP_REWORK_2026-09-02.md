# Mercury PRISM app UAT rework — 2026-09-02

## Outcome

The Samantha app now reaches the production Voice bridge, exposes live subtitles with an on/off control, and supports persistent drag reordering from both pointer and Android-style touch-hold input. A debug APK is ready for handset re-test.

Product invariant: a control-surface action must either complete against the real PRISM/Voice contract or fail visibly; it must never remain in a silent pending state.

## Contract

- Production builds use the canonical PRISM sync base, Voice token endpoint, and LiveKit endpoint. The build fails if those routes are missing, stale, or replaced with a private Tailnet IPv4 address.
- Voice reports `connected` only after the real room is joined, the microphone track is published, and the worker returns a complete generation-scoped `ready_ack` (`sessionReady`, `clientReady`, and `audioReady`).
- A non-success token response and an exhausted transport/readiness attempt produce a visible `role="alert"` with an actionable error and Retry control.
- Subtitles accept both LiveKit `TranscriptionReceived` segments and the Voice bridge `raw_subtitle` data topic. The captions control hides and restores the live transcript without disconnecting the room.
- Next tasks, projects, and project tasks expose dedicated 44 px drag buttons. Mouse/pointer, keyboard, and a 250 ms touch hold can activate sorting. Rank changes update the local durable store immediately and flow through the existing PRISM sync queue.

## Exact root causes and fixes

### 1. Voice bridge join

Root cause: the checked-in production routing pointed at `https://xenya.tail6504c1.ts.net/token/api/voice/token` and `wss://xenya.tail6504c1.ts.net/livekit`. The active Tailscale Serve configuration exposes `/prism`, but neither `/token` nor `/livekit`, so the token request returned HTTP 404 before LiveKit could be joined. The app then retried generically and left the primary control looking like a long-running Cancel state.

Fix:

- Route token requests to `http://xenya.tail6504c1.ts.net:3010/api/voice/token` and LiveKit to `ws://xenya.tail6504c1.ts.net:7880`, matching the healthy services already listening on the host.
- Keep the current full Voice 2.6 readiness protocol and bounded reconnect lifecycle.
- Classify HTTP 4xx token failures as non-retryable configuration/auth failures and surface them immediately in a prominent alert. Transient network/5xx failures retain bounded retries.
- Add build-time route verification for both web output and copied Android assets.

No Voice service, gateway, Tailscale Serve, or PRISM server configuration was changed.

### 2. Subtitles control

Root cause: the modular Voice adapter already subscribed to LiveKit transcription events and `raw_subtitle`, but its snapshot had no captions preference and the Voice view rendered no captions control. The data path survived the migration; the user control did not.

Fix:

- Add `captionsEnabled` to the Voice bridge state and adapter contract.
- Restore an accessible captions button (`Disable subtitles` / `Enable subtitles`, with `aria-pressed`).
- Preserve incoming caption updates while hidden so restoring captions shows the current transcript without reconnecting.

### 3. Next and Projects drag-and-drop

Root cause: sorting used only a distance-based pointer sensor inside a vertical scrolling surface whose ancestor declares `touch-action: pan-y`. The visible grip was not a dedicated touch activator, so Android gave the gesture to scrolling before dnd-kit could begin a drag.

Fix:

- Add a touch sensor with a 250 ms activation delay and 8 px tolerance alongside mouse and keyboard sensors.
- Convert each grip to a labelled 44 px button, attach dnd-kit's activator ref, and set `touch-action: none` on the handle only.
- Retain vertical scrolling everywhere outside the handle and retain the existing fractional-rank persistence path.

## Verification and proof

- Real production Voice acceptance passed from the built app code against `samantha-room`:
  - token endpoint returned credentials;
  - LiveKit join completed;
  - the worker logged `Received connected_and_ready from david`, `Audio track subscribed for david`, and generation 19 becoming ready in 0.008 seconds;
  - the app had one subscribed remote audio element and a live outgoing synthetic microphone track;
  - the live data track rendered `Samantha: Here, love. Go on.`;
  - captions hid and restored while the room remained connected.
- Loud-failure browser contract passes for HTTP 404 and exposes Retry.
- Full Playwright suite: 30/30 passed, including touch-hold Next reorder and persisted Next/Projects ranks.
- Routing tests: 4/4 passed.
- Memory bridge tests: 6/6 passed.
- ESLint: passed.
- Production TypeScript/Vite build: passed. The existing bundle-size advisory remains non-blocking.
- Capacitor Android sync and copied-asset routing verification: passed.
- Gradle `assembleDebug`: passed (154 tasks; 28 executed, 126 up to date).

No ADB handset was attached during this run. Android touch behavior was exercised through Chromium touch emulation, and the APK below is ready for David's physical-device re-test.

## APK

- Path: `android/app/build/outputs/apk/debug/app-debug.apk`
- Size: 6.0 MB
- SHA-256: `845202560d9c57670b270b8d1631e42c2121678266ac0804a448f04ff9e8c744`

## Constraints observed

- All implementation and report writes stayed inside `/Users/apple/samantha-app`.
- External PRISM and Voice files were read only to establish the current contracts.
- No PRISM dispatch, gateway, production Voice service, database, or Tailscale configuration was mutated.
- The pre-existing dirty worktree and unrelated user changes were preserved.
