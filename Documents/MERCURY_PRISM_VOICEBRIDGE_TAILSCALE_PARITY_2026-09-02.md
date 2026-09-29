# PRISM VoiceBridge Tailscale parity — 2026-09-02

## Outcome

The PRISM app now uses the same raw Tailscale VoiceBridge endpoint as the working
standalone Samantha Voice app. A production-bundle acceptance run on the Tailnet
reached `Connected & ready · Listening`, published a live microphone track, and
attached Samantha's remote audio.

Product invariant: PRISM desktop sync remains on its existing HTTPS route, while
Voice credential and LiveKit traffic use the standalone app's exact raw Tailnet
routes. Voice must not depend on handset MagicDNS or a public relay.

## Contract

Production routing is:

```text
VITE_API_BASE=https://xenya.tail6504c1.ts.net/prism
VITE_VOICE_TOKEN_ENDPOINT=http://100.113.109.60:3010/api/voice/token
VITE_LIVEKIT_URL=ws://100.113.109.60:7880
```

The standalone app's checked-in `app.json` confirms the same bare credential
endpoint and Android cleartext support. Its credential client calls that endpoint
without query parameters and then joins the `serverUrl` returned by VoiceBridge.
PRISM now follows the same request contract. This matters because VoiceBridge
returns HTTP 400 for the former parameterized PRISM request.

Both the JavaScript build verifier and the Android Gradle packaging gate require
the exact routes above. They reject the stale MagicDNS Voice ports and any other
raw Tailscale route, so the exception remains narrow and reviewable.

## Changes

- `.env.production`: replaced both MagicDNS Voice values with `100.113.109.60`.
- `src/services/voiceBridge.ts`: fetches a fresh credential from the bare token
  endpoint with `Accept: application/json`, matching standalone VoiceBridge.
- `scripts/verify-mobile-routing.mjs` and `tests/mobile_routing.test.mjs`: encode
  and test the production parity contract.
- `android/app/build.gradle`: enforces the same contract before every APK build.
- `tests/voice_control.spec.ts`: proves that credential requests have no query.

No backend, public TURN, LiveKit Cloud, or Funnel route was added or used. The
existing status stages, subtitles, and drag-and-drop behavior were left intact.

## Verification

- Bare credential probe: HTTP 200.
- LiveKit raw IP port probe: TCP connection to `100.113.109.60:7880` succeeded.
- `npm run test:routing`: 5/5 passed.
- `npm run lint`: passed.
- `npm run test:e2e`: 31/31 passed, including Voice status, subtitles, DnD, and
  the new bare-token-request assertion.
- `npm run cap:sync`: passed; copied Android assets passed routing verification.
- `./gradlew assembleDebug`: `BUILD SUCCESSFUL`; Gradle routing gate passed.
- Real production-bundle Tailnet acceptance:
  - observed token request exactly
    `http://100.113.109.60:3010/api/voice/token` with an empty query;
  - progressed through token fetch, room join, and audio initialization;
  - final status `Connected & ready · Listening`;
  - synthetic microphone audio track was live and enabled;
  - one remote audio element attached;
  - no browser console errors.
- APK verification: zip alignment passed; APK Signature Scheme v2 passed.
- Packaged route inspection found both required raw-IP routes and no stale
  MagicDNS Voice route.
- Download verification: HTTP 200, Android APK MIME type, 6,465,011 bytes, and
  remote SHA-256 exactly matches the local artifact.

Private visual proof is stored at
`.ai/private-evidence/mercury-voice-tailscale-parity-connected.png`.

## Artifact

- APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- SHA-256: `c3f2868240a693e4e71bb03dd10b975cc8130f3571e8bc7d290c254357cb7051`
- Tailnet-only download:
  `https://xenya.tail6504c1.ts.net/downloads/samantha-prism-2.4.0-tailscale-parity.apk`

## Constraints and operation

- Tailscale must be connected on the handset before Voice is connected.
- Off-Tailnet Voice remains explicitly out of scope.
- This is a debug-signed APK. Android may require uninstalling a build signed by
  a different key before installation.
