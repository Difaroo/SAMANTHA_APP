# Samantha App Backlog

**Current release:** 2.4.0

**Updated:** 2026-07-13

Completed 2.4.0 work is archived in `Sprints/archive/2.4.0-reliable-prism-sync.md`. This file contains only outstanding work.

## P0 - Release Completion

- [ ] Install the 2.4.0 APK on David's physical handset as an upgrade.
- [ ] Verify cached data and a pending offline mutation survive the upgrade.
- [ ] Verify exact Next task identity and order parity after reconnect.
- [ ] Verify microphone permission, LiveKit connection, push to talk, background notification, and notification Disconnect on the handset.
- [ ] Establish the correct GitHub `origin/master` for this standalone project and publish the release commit.

## P1 - Operational Reliability

- [ ] Automate PRISM SQLite backup, integrity checks, retention, and restore rehearsal.
- [ ] Add structured PRISM request logs and basic health monitoring.
- [ ] Add one repeatable command that compares canonical Next IDs and order.
- [ ] Define project deletion, child-task cascade, restoration, and tombstone retention.
- [ ] Add a supervised process contract for PRISM port 3333.

## P1 - Security

- [ ] Add authenticated device enrollment and revocation for PRISM sync.
- [ ] Restrict PRISM CORS to approved browser and Capacitor origins.
- [ ] Narrow Android WebView permission grants to microphone resources.
- [ ] Disable cleartext and mixed content in the production Android flavor.
- [ ] Decide whether Android backup may include Samantha local entity state.
- [ ] Add voice-token audience, participant, and expiry verification.

## P2 - Sync Evolution

- [ ] Implement cursor-based delta synchronization using the existing change log.
- [ ] Add pagination and full-snapshot fallback for expired cursors.
- [ ] Add a conflict inspector with explicit keep-local and keep-server actions.
- [ ] Add retention rules for mutation receipts, revisions, conflicts, and tombstones.
- [ ] Add destructive-reset protection when pending mutations exist.

## P2 - Mobile Resilience

- [ ] Add physical-device tests for airplane mode, captive portals, process death, OS upgrade, and low battery.
- [ ] Add Bluetooth route-switching and phone-call interruption coverage.
- [ ] Decide whether Timer checkpoints should persist across process death.
- [ ] Add a signed release build and repeatable upgrade/distribution channel.
- [ ] Split the large Vite JavaScript chunk as product growth warrants.

## P2 - Samantha Memory

- [ ] Complete Obsidian Headless login and vault sync enrollment.
- [ ] Prove a new memory note reaches Obsidian on phone within five seconds.
- [ ] Index the wiki in Samantha's retrieval pipeline.
- [ ] Retrieve the top three relevant notes at conversation start.
- [ ] Migrate core identity and teaching files with load-path and wiki-link verification.
- [ ] Add structured automatic conversation summaries.
