# Mercury APK Routing Brief — 2026-08-20

## Outcome

The Android release pipeline now fails closed unless the compiled and copied web
assets contain the canonical production PRISM route and no private Tailnet IPv4
route. A fresh debug APK was emitted with the correct effective routing.

The app-visible online acceptance is blocked by the current Tailscale edge and
device state, not by the APK configuration.

## Contract

### Production routing

| Variable | Required value |
|---|---|
| `VITE_API_BASE` | `https://xenya.tail6504c1.ts.net/prism` |
| `VITE_VOICE_TOKEN_ENDPOINT` | `https://xenya.tail6504c1.ts.net/token/api/voice/token` |
| `VITE_LIVEKIT_URL` | `wss://xenya.tail6504c1.ts.net/livekit` |

- The sync client appends `/api/v1/sync` to `VITE_API_BASE`.
- `.env.production` is durable public client configuration.
- Local/default `.env` remains ignored and may contain development-only routes.
- Existing shell variables may override Vite env files; compiled-bundle
  verification therefore remains mandatory after the build.
- Gradle may package only copied web assets that pass the native routing gate.

### Boundaries

- Samantha App owns build-mode selection, bundle verification, Capacitor asset
  copying, and APK packaging.
- PRISM owns the service on port 3333.
- Tailscale owns the HTTPS edge that must expose `/prism` to the phone.
- No Portfolio, Samantha-core, PRISM, Tailscale, or Voice repository/configuration
  was changed.

## Architecture and tasks

1. Version only `.env.production` and `.env.example`; continue ignoring local
   environment variants.
2. Run `vite build --mode production` explicitly from `npm run build`.
3. Verify `dist` contains every production endpoint and `/api/v1/sync`, and
   rejects the Tailscale CGNAT range `100.64.0.0/10`.
4. Make `npm run cap:sync` rebuild, copy, and verify Android assets.
5. Run the same PRISM/private-route invariant from Android `preBuild` so a direct
   Gradle build cannot silently package stale assets.
6. Inspect the final APK rather than inferring its configuration from source.

## Verification

| Check | Result |
|---|---|
| `npm run test:routing` | Pass, 4/4 |
| `npm run lint` | Pass |
| `npm run build` | Pass; explicit production mode and `dist` verification |
| `npx cap sync android` | Pass |
| `npm run verify:android-routing` | Pass; 6 compiled files inspected |
| Android `assembleDebug` | Pass; `:app:verifyMobileRouting` executed |
| Fresh APK | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Build timestamp | `2026-08-20T23:31:14+0100` |
| APK size | 6,306,103 bytes |
| APK SHA-256 | `4f2b581855e14ddf668431e50852380d1a389112ad152a08f80853957beb1378` |
| APK production routes | PRISM, Voice token, and LiveKit present |
| APK private Tailnet route count | 0 |
| Local PRISM health | Healthy, Schema 1, revision 56, 22 projects, 26 tasks |

## Bounded online proof and blocker

The production bundle was served at a 412 × 915 Android viewport. The visible
cloud control reported `Offline`, consistent with the following network proof:

- `xenya.tail6504c1.ts.net` resolves to `100.113.109.60`.
- TCP port 443 refuses connections, including from the host on its Tailnet.
- `tailscale serve status` reports `No serve config`.
- `adb devices -l` reports no attached device.

Therefore the requested online indicator and handset board pull cannot be
truthfully accepted in the present state. The APK route is correct, but the
configured HTTPS edge is not serving PRISM and no physical handset is available
for installation proof.

## Acceptance rerun

After the Tailscale HTTPS edge serves `/prism` to local PRISM port 3333 and a
handset is ADB-visible:

1. install the APK linked above;
2. confirm `GET /prism/api/v1/health` reports revision 56 or newer;
3. launch Samantha and confirm the cloud control changes from `Offline` to
   `Synced`;
4. compare the handset board task IDs/order with the revision-matched PRISM
   snapshot.
