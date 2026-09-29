# Mercury Handset MagicDNS Resolution Proof

Date: 2026-08-21 (Europe/London)
Brief: `mercury-fix-magicdns-handset-resolution-2026-08-20`
Status: Completed

## Outcome

The production Samantha Android app on the physical CLT-L09 now resolves
`xenya.tail6504c1.ts.net` to `100.113.109.60`, reaches PRISM through the existing
Tailscale Serve route, and completes a live sync at server revision 56.

## Acceptance contract

- Device: `LCL0218329002211` (`CLT-L09`).
- Production API base remains `https://xenya.tail6504c1.ts.net/prism`.
- The hostname must resolve on the handset to `100.113.109.60`.
- Samantha must report a healthy PRISM state. In the current UI this is the
  `Synced` indicator with title `Up to date`.
- The sync response must have revision 56, an empty outbox, and the four required
  Next records with non-null `nextRank` values.

## Architecture diagnosis

The server and tailnet configuration were already healthy:

- Tailnet MagicDNS was enabled with suffix `tail6504c1.ts.net`.
- Xenya advertised `xenya.tail6504c1.ts.net` at `100.113.109.60`.
- The CLT-L09 was online in the same tailnet and could ping `100.113.109.60`.
- The handset VPN exposed Tailscale DNS at `100.100.100.100` and
  `fd7a:115c:a1e0::53`; Android connectivity diagnostics successfully queried
  both resolvers.
- Tailscale's handset UI showed `Use Tailscale DNS` enabled with the correct
  `tail6504c1.ts.net` search domain.

The handset-specific conflict was Huawei Private DNS in `Auto` mode. The generic
ADB setting lookup initially returned no value, but the actual Private DNS UI and
the full settings list showed `private_dns_default_mode=opportunistic`. Tailscale's
DNS control routed directly to that system panel on this Android build. The
result was a stale/intercepted Android resolver binding: tailnet IP routing and
the Tailscale DNS proxy worked while normal hostname lookup returned
`unknown host`.

## Remediation

Only device-local, reversible DNS state was changed:

1. Set Huawei Private DNS from `Auto` to `Off`.
2. Cycled `Use Tailscale DNS` off and back on to rebuild the VPN resolver binding.

No Samantha endpoint was rewritten to a bare IP. No Tailscale admin policy,
Serve route, PRISM service, database, Voice repository, or other project was
changed. The handset security lock was not bypassed.

## Verification proof

Handset resolution after remediation:

```text
PING xenya.tail6504c1.ts.net (100.113.109.60)
1 packets transmitted, 1 received, 0% packet loss
```

Existing production health route:

```text
GET https://xenya.tail6504c1.ts.net/prism/api/v1/health -> HTTP 200
```

Samantha WebView live-sync result after explicitly invoking `Sync with PRISM`:

```text
label: Synced
title: Up to date
serverRevision: 56
outboxCount: 0
```

Required revision-56 Next records pulled by the installed app:

| ID | Title | Status | nextRank |
| --- | --- | --- | --- |
| `arc-go-live` | ArcSpline Go-Live | `next` | `000000002000` |
| `sa-voicebridge-update` | Update Samantha app to latest VoiceBridge | `next` | `000000004000` |
| `sa-prism-sync-verify` | Verify PRISM sync on Android | `next` | `000000005000` |
| `cj-v2` | Candy Jones v2 refresh | `next` | `000000006000` |

This proves live hostname resolution, successful app-to-PRISM transport, current
database revision ingestion, and a drained local mutation queue on the exact
physical handset.
