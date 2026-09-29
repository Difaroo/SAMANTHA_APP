# PRISM Sync Architecture

## User Contract

PRISM desktop and Samantha mobile render the same canonical task IDs in Next. A task is in Next only when `nextRank` is non-null; `nextRank` also defines shared order.

Mobile edits are committed locally before network work. Offline mutations remain in a durable outbox and are retried after reconnect, app resume, window focus, or manual sync. The server never accepts full-state replacement.

## Boundaries

- `src/sync/contract.ts`: schemas, entity mapping, Next membership, ranks, protocol version.
- `src/sync/indexedDbStorage.ts`: transactional mobile cache/outbox storage with a localStorage rollback mirror.
- `src/stores/entityStore.ts`: local repository and optimistic presentation state. It does not perform network I/O.
- `src/services/syncManager.ts`: transport, lifecycle triggers, batching, timeout, retry, acknowledgement, and reconciliation.
- `PRISM_ROOT/lib/prism-sync-store.js`: canonical SQLite state, revisions, idempotency receipts, tombstones, and conflict records. Resolve `PRISM_ROOT` from the companion clone at runtime.

## Protocol

`POST /api/v1/sync` accepts:

```json
{
  "schemaVersion": 1,
  "deviceId": "stable-device-id",
  "cursor": 0,
  "mutations": []
}
```

The response contains the canonical snapshot, acknowledgements, conflicts, and the next revision cursor. Mutation IDs are idempotency keys. Entity `baseVersion` prevents stale clients from overwriting newer data.

Legacy `POST /state` and `POST /seed` return HTTP 410. `GET /seed` remains a read-only compatibility projection.

## Next Migration

The immutable legacy seed did not have one consistent Next field. The one-time database import maps non-completed legacy `pending`, `next`, and `backlog` tasks into ranked Next entries. This produces the confirmed 16-item queue. New tasks start as `draft` with `nextRank: null` until explicitly added.

## Recovery Rules

- Empty cache or reinstall: pull before any write.
- Server unavailable: render cache, retain outbox, retry with capped exponential backoff and jitter.
- Lost acknowledgement: resend the same mutation ID; server returns the stored result without applying twice.
- Edit during an in-flight request: rebase the newer local value onto the acknowledged server version and send a new mutation ID.
- Stale base version: server keeps the newer canonical entity, records a conflict, and returns it visibly to the client.
- Delete: server retains a tombstone so stale clients cannot resurrect the entity.
- Service worker: sync endpoints bypass cache; application assets are network-first with offline fallback.
- Uninstall before an offline outbox reaches PRISM: unsynced device-only changes cannot be recovered. Synced data is restored from PRISM on reinstall.

## Verification

```bash
(cd "$PRISM_ROOT" && npm test)
npm run lint
npm run build
npm run test:e2e
curl http://localhost:3333/api/v1/health
```

Release parity compares the exact sorted Next task-ID sets from desktop, mobile, and `/api/v1/snapshot`, not counts alone.
