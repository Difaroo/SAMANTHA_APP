# Mercury VoiceBridge public HTTPS endpoint — 2026-09-02

## Status

Blocked on the Orion-owned public Voice endpoint delivery. No app configuration was changed and no replacement APK was built, because disabling cleartext before verified HTTPS/WSS routes exist would regress the currently working Tailnet Voice path.

Product invariant: a production Android build must never advertise Voice as available unless both credential exchange and LiveKit transport are reachable through authenticated TLS from the phone's actual network.

## Outcome required

The Samantha/PRISM Android app must connect on ordinary 5G with Tailscale disabled using:

- a public `https://` Voice token endpoint; and
- a public `wss://` LiveKit endpoint.

The resulting Android package must disallow cleartext traffic and mixed content, reach Audio ready and Connected & ready on the real status surface, and be downloadable without Tailnet access.

## Current facts

The brief's cited private-IP values are not the exact values in the current production file. The checked-in app configuration currently contains:

- `VITE_VOICE_TOKEN_ENDPOINT=http://xenya.tail6504c1.ts.net:3010/api/voice/token`
- `VITE_LIVEKIT_URL=ws://xenya.tail6504c1.ts.net:7880`

Those values use MagicDNS rather than a literal `100.64.0.0/10` address, but they are still Tailnet-only plaintext HTTP/WS and therefore do not satisfy the 5G/public contract.

The Android package currently also contains:

- `android:usesCleartextTraffic="true"`; and
- Capacitor `allowMixedContent: true`.

Those settings were necessary for the previous raw-port Tailnet route. They must be removed or set false only in the same change that installs verified public TLS routes.

## Upstream blocker

Samantha created the paired Orion brief:

`orion-voicebridge-public-reachability-2026-09-02`

PRISM rejected it before delivery with:

- state: `blocked`
- code: `ROUTE_UNKNOWN_WORKSTREAM`
- reason: Voice project workstream `app-architecture` is unknown
- registered Voice workstream: `voice-architecture`

Consequently, there is no Orion reply and no public token endpoint, LiveKit WSS endpoint, TLS status, or off-Tailnet proof for Mercury to consume. Exposing or changing Voice production routing directly would violate this brief's ownership constraint.

## App contract ready for implementation

Once Orion provides the two URLs, the app-side change is bounded:

1. Set `VITE_VOICE_TOKEN_ENDPOINT` to Orion's exact `https://` token URL.
2. Set `VITE_LIVEKIT_URL` to Orion's exact `wss://` LiveKit URL.
3. Update the production routing verifier so builds reject:
   - non-HTTPS token endpoints;
   - non-WSS LiveKit endpoints;
   - private Tailnet IPv4 endpoints;
   - the known plaintext MagicDNS raw-port routes.
4. Set Android `usesCleartextTraffic` to false.
5. Set Capacitor `allowMixedContent` to false or remove the override.
6. Build and verify both the web bundle and copied Android assets contain only the public secure routes.
7. Exercise the production-configured app against the real room and record the visible progression through Fetching token, Joining room, Audio ready, and Connected & ready.
8. Verify from a genuinely non-Tailnet network, with Tailscale disabled on the phone.
9. Rebuild, sign, align, hash, and place the new APK behind a genuinely public HTTPS download URL.

## Required verification

- Public token request returns HTTP 200 without Tailnet routing and exposes no LiveKit server key or secret.
- LiveKit accepts the issued token over WSS and completes the generation-scoped readiness handshake.
- Android network configuration contains no cleartext opt-in.
- The Voice status UI reaches Audio ready and Connected & ready on 5G with Tailscale disabled.
- Existing subtitle, drag-and-drop, PRISM sync, purple-flame icon, and stage-specific error contracts remain green.
- Full lint, Playwright, production build, Capacitor sync, Gradle, signature, and alignment checks pass.
- The public APK download returns HTTP 200 with Android package MIME type and a streamed SHA-256 equal to the local artifact.

## Unblock payload needed from Orion

- Public token endpoint (`https://.../api/voice/token` or documented equivalent)
- Public LiveKit endpoint (`wss://...`)
- TLS certificate/hostname status
- Confirmation that LiveKit signing keys remain server-side
- External-network token and room-connection proof

## Constraints observed

- All report writes stayed inside `/Users/apple/samantha-app`.
- No Samantha app source/configuration was changed while the secure replacement routes are absent.
- No PRISM dispatch/control, gateway, Voice service, reverse proxy, tunnel, DNS, or production routing was changed.
- Existing dirty-worktree changes and the last working APK/download route were preserved.
