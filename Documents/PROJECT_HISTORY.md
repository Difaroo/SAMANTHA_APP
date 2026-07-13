# Samantha App Project History

This history records released outcomes. Dates use the Europe/London project timezone.

## 2.4.0 - Reliable PRISM Sync

**Date:** 2026-07-13

**Purpose:** Make Samantha mobile a reliable offline-capable companion to the live PRISM desktop system and eliminate Next queue divergence.

### Delivered

- Replaced seed/full-state writes with Schema 1 entity mutation synchronization.
- Added IndexedDB persistence with a localStorage mirror and durable outbox.
- Added stable device/mutation IDs, batching, timeout, reconnect triggers, retry backoff, and response validation.
- Added optimistic local edits with acknowledgement, rebase, and server-wins conflict reconciliation.
- Defined `nextRank` as the sole cross-client Next membership and ordering contract.
- Added visible sync phase, pending count, and manual retry control.
- Updated Projects, Next, task detail, Timer, and navigation around the canonical PRISM entities.
- Hardened the LiveKit voice adapter, pipeline state, push-to-talk controls, transcript accessibility, and Android foreground-service cleanup.
- Added contract fixtures and browser coverage for offline creation, Next promotion, reconnect, voice, navigation, projects, and timer behavior.
- Added the structured Obsidian memory writer and tests; full Obsidian Sync remains blocked on vault enrollment.
- Added focused sync, incident, memory, user, operational, and full architecture documentation.
- Aligned package, on-screen, and Android versions at 2.4.0 (`versionCode 2`).

### Verification Evidence

- App lint passed.
- Production build passed.
- Playwright passed 20 tests, including the app-visible 2.4.0 version contract.
- Obsidian memory bridge passed 6 tests.
- PRISM sync store passed 3 tests in the companion PRISM project.
- Local and production-proxy PRISM health reported Schema 1, 10 projects, and 20 tasks.
- The canonical Next snapshot contained 16 unique IDs; exact desktop/mobile parity was verified during implementation.
- Debug APK built successfully.

### Deferred

- Physical handset installation and upgrade verification.
- Application-layer PRISM authentication and transport hardening.
- Automated SQLite backups and supervision.
- User-facing conflict resolution.
- Obsidian Headless vault enrollment and cross-device proof.

## 2.3.0 - Capacitor Android Shell

**Date:** 2026-07-10

**Purpose:** Package the Samantha React interface as an Android application with microphone and foreground-service support.

### Delivered

- Added the Capacitor Android project and native application shell.
- Added microphone, foreground-service, wake-lock, Internet, and notification permissions.
- Added the voice foreground service and notification Disconnect action.
- Added Android build and deployment scripts.

## Post-2.3.0 Control-Flow Audit

**Date:** 2026-07-10

**Purpose:** Correct critical/high navigation, voice, timer, project, and detail-flow defects before synchronization work.

### Delivered

- Corrected 15 control-flow defects.
- Brought the then-current browser suite to 17 passing tests.
- Established the stable user-flow baseline used by the 2.4.0 release.
