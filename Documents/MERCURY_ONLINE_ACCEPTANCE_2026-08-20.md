# Mercury Online Handset Acceptance — 2026-08-20

## Outcome

The corrected APK was installed successfully on the physical CLT-L09 and the
installed package bytes match the approved artifact. Production PRISM and the
Tailscale Serve route are healthy at revision 56.

Online acceptance is still blocked on the handset: the device can reach the
Tailscale host by IP but cannot resolve `xenya.tail6504c1.ts.net`, so the app
reports `Offline` / `Failed to fetch` and retains its cached board.

## Contract

- Install only APK SHA-256
  `4f2b581855e14ddf668431e50852380d1a389112ad152a08f80853957beb1378`.
- Target only ADB serial `LCL0218329002211`, model `CLT_L09`.
- Use `adb install -r` so existing application data is preserved.
- Accept online only when the physical app reports `Synced` after reaching
  production `POST /api/v1/sync`.
- Accept board parity only from exact revision-matched task IDs with non-null
  `nextRank`; counts alone are insufficient.
- Do not mutate Portfolio, Samantha core, PRISM, Tailscale, or Voice state.

## Physical installation proof

| Evidence | Result |
|---|---|
| ADB target | `LCL0218329002211 device usb:0-1.2 model:CLT_L09` |
| Install command | `adb -s LCL0218329002211 install -r .../app-debug.apk` |
| Install result | `Performing Streamed Install` → `Success` |
| Package | `com.samantha.voice` |
| Installed version | `versionCode=2`, `versionName=2.4.0` |
| First install | `2026-07-17 15:06:09` |
| Last update | `2026-08-20 23:48:18` |
| Installed base APK hash | `4f2b581855e14ddf668431e50852380d1a389112ad152a08f80853957beb1378` |

The unchanged first-install timestamp and updated last-update timestamp prove a
data-preserving replacement rather than an uninstall/reinstall.

## Production service proof

Tailscale Serve reports:

```text
https://xenya.tail6504c1.ts.net (tailnet only)
|-- /prism proxy http://127.0.0.1:3333
```

Production health reports Schema 1, revision 56, 22 projects, and 26 tasks.
Production `POST /api/v1/sync` returns these ranked tasks:

| ID | Text | `nextRank` |
|---|---|---|
| `arc-go-live` | ArcSpline Go-Live | `000000002000` |
| `sa-voicebridge-update` | Update Samantha app to latest VoiceBridge | `000000004000` |
| `sa-prism-sync-verify` | Verify PRISM sync on Android | `000000005000` |
| `cj-v2` | Candy Jones v2 refresh | `000000006000` |

## On-device app proof

The phone remained locked; its Face Recognition boundary was not bypassed. The
installed debug WebView was inspected read-only through its ADB debug socket.

| On-device signal | Observed value |
|---|---|
| App title/origin | `Samantha`, `https://localhost` |
| Sync control text | `Offline` |
| Sync control title | `Failed to fetch` |
| Requested route | `https://xenya.tail6504c1.ts.net/prism/api/v1/sync` |
| Cached Next count | 16 |
| Required revision-56 IDs in device Next DOM | none |

This proves the corrected route is executing on the physical handset, but the
request does not complete and revision 56 is not applied.

## Remaining blocker

The CLT-L09 has the Tailscale package and an active validated VPN. From the
device:

- `ping 100.113.109.60` succeeds with 0% packet loss;
- `ping xenya.tail6504c1.ts.net` returns `unknown host`;
- Samantha runs as UID 10399, which is included in the VPN UID range.

The remaining boundary is therefore device-side Tailscale/MagicDNS hostname
resolution, not APK routing, PRISM health, CORS, installation, or app UID VPN
exclusion. The brief forbids changing Tailscale configuration, so acceptance
cannot proceed further in this workstream.

## Acceptance rerun

After `xenya.tail6504c1.ts.net` resolves on the CLT-L09 without changing the APK:

1. launch Samantha while the handset is unlocked;
2. tap the sync control if an automatic retry has not already completed;
3. confirm the control reads `Synced`;
4. capture the visible Next screen containing the four ranked IDs above;
5. compare the complete device Next ID/order list with the same PRISM revision.
