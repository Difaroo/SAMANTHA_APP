# Mercury App Architecture Brief — 2026-08-20

## Outcome

Samantha App is registered with the Samantha project resolver, its existing
VoiceBridge client is aligned with the released Orion reference, and its PRISM
sync path is mechanically verified. Final Android acceptance is blocked by the
current PRISM data and device state described below.

## Architecture contract

### Project registration

- `.ai/project.json` uses source schema version 1 and the canonical project name
  `samantha-app`.
- The `application` source owns the React UI, PRISM synchronization, IndexedDB
  outbox, and LiveKit VoiceBridge client.
- The `deployment` source owns Capacitor Android packaging, permissions, and
  build-time endpoint configuration.
- Resource `PRISM sync` must resolve to `application`; resource `Android build`
  must resolve to `deployment`.
- `.gitignore` preserves machine-local `.ai` state while allowing
  `.ai/project.json` to be versioned.

### VoiceBridge

- The brief's authoritative reference is `/Users/apple/samantha-voice`.
- The inspected reference is clean at commit
  `daeaa8e40a8a8caa40aa23d9319c65174fba69d3`, package version `2.6.0`, with
  commit subject `Release voice bridge v2.6.0 architecture stabilization`.
- Samantha App owns only the LiveKit client, connection lease, microphone/PTT
  controls, subtitles, delivery acknowledgement, and session speaker-correction
  UI. Kokoro, Deepgram, OpenClaw, token issuance, and worker lifecycle remain
  outside this repository.
- A parallel `3.0.0-beta.1` VNext worktree was not adopted: its own UAT contract
  assigns it a separate room, token port, and Android package and states that
  production remains unchanged.

### PRISM synchronization

- The client uses canonical `POST /api/v1/sync` with schema version 1, device ID,
  cursor, and bounded mutation batches.
- PRISM is authoritative after acknowledgement. Offline mutations remain in the
  Zustand store's IndexedDB-backed outbox until acknowledged.
- A task belongs in Next only when `nextRank` is a non-empty string. The client
  must not infer Next membership from ticket identity or stale
  `inGlobalBacklog` state.

## Implemented tasks

1. Added the two-source `.ai/project.json` manifest and a narrow ignore rule for
   that durable manifest.
2. Revalidated the unreleased VoiceBridge 2.6.0 integration already present in
   the app against Orion's released source of truth.
3. Exercised the live PRISM service through its canonical sync endpoint and the
   rendered Samantha UI at a 412 × 915 Android-sized viewport.
4. Built and synchronized the Capacitor Android shell without changing PRISM,
   Portfolio, Samantha core, or Voice backend repositories.

## Verification and proof

| Check | Result |
|---|---|
| Project resolver, resource `PRISM sync` | `status: ok`, project `samantha-app`, source `application`, kind `application`, path `.` |
| Project resolver, resource `Android build` | `status: ok`, source `deployment`, kind `deployment`, path `android` |
| `npm run lint` | Pass |
| `npm run build` | Pass; Vite production bundle generated |
| `npm run test:e2e` | Pass; 26 Playwright tests plus 6 Node memory tests |
| VoiceBridge 2.6.0 protocol subset | Pass; 6/6 |
| `npm run cap:sync` | Pass; two Capacitor plugins synchronized |
| Android `assembleDebug` with Android Studio JBR 21 | Pass; 153 tasks, 24 executed and 129 up to date |
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk`, SHA-256 `ed3304cceeb915df5cc5e129df1ff12ba14fe53c22e24e19287272ced33e7725` |
| PRISM health | Healthy at schema 1, revision 34 |
| Rendered app sync indicator | `Synced` |

Live `POST /api/v1/sync` returned both requested Samantha App tasks:

| Ticket | Text | `nextRank` | `inGlobalBacklog` | Rendered result |
|---|---|---:|---:|---|
| `sa-voicebridge-update` | Update Samantha app to latest VoiceBridge | `null` | `false` | Visible in project view with `Add to Next`; absent from Next |
| `sa-prism-sync-verify` | Verify PRISM sync on Android | `null` | `false` | Visible in project view with `Add to Next`; absent from Next |

The rendered Next view contained 16 server-ranked task IDs. Neither requested ID
was present, which is the correct client behavior for the payload above.

## Constraints preserved

- All writes were confined to `/Users/apple/samantha-app` except the required
  PRISM brief reply.
- Portfolio, Samantha core, PRISM control/data, and Voice repositories were not
  changed.
- Existing unreleased project-color, touch, scroll, and prior Voice/PRISM work
  was preserved.
- No ticket was promoted to Next because the brief did not authorize changing
  PRISM's canonical task data.

## Acceptance blocker

Physical acceptance cannot pass in the current state:

1. `adb devices -l` reports no attached device, so there is no handset install or
   screenshot/interaction proof.
2. PRISM revision 34 returns `nextRank: null` for both required tickets, so a
   contract-correct client cannot display them in Next on any device.

Acceptance can be rerun after PRISM assigns non-null Next ranks to both ticket
IDs and an Android handset is visible to ADB. No further app-code change is
required for those two conditions.
