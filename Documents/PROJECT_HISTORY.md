# Samantha App Project History

This history records released outcomes. Dates use the Europe/London project timezone.

## 2.4.13 - Swipe Navigation With Drag Isolation

- Restores touch-only horizontal swipe navigation across Voice, Projects, Next, and Timer.
- Ignores swipe starts on controls and card grab grips, then locks navigation for the full duration of an activated card drag.
- Retains 250ms hold activation on touch grips and vertical-only sortable transforms.
- Adds edge resistance, axis locking, and click suppression after a committed swipe.

## 2.4.12 - Seamless Launch Handoff

- Adds a pre-React launch cover that exactly matches the Voice background and Samantha lockup.
- Crossfades the cover only after the live app has painted, eliminating the blank WebView frame between native splash and app.
- Removes the cover after transition and respects the system reduced-motion preference.

## 2.4.11 - Connected-Only Speed Readout

- Hides the voice-speed readout and its hold control whenever Voice is disconnected.
- Keeps the connection-status readout visible and clears an open speed editor on disconnect.

## 2.4.10 - Splash Lockup Parity

- Corrected Android splash density resolution so every generated asset uses its exact density bucket rather than higher-density assets falling back to the `hdpi` scale.
- Matched the splash flame and SAMANTHA wordmark to the in-app 176dp / 24dp lockup size and shared vertical-centre formula.

## 2.4.9 - Speaker Subtitle Colours

**Date:** 2026-09-03
**Purpose:** Make subtitle ownership immediately legible.

- Renders Samantha's turns in purple.
- Renders the user's turns in white while system captions remain muted.

## 2.4.8 - CTA-Centred Lockup

**Date:** 2026-09-03
**Purpose:** Centre the Samantha lockup within the visual field above the primary Voice action.

- Positions the in-app lockup at the midpoint between viewport top and CTA top in every Voice state.
- Applies the equivalent density-aware position and sizing to native splash assets.
- Clamps shallow landscape splash layouts only where required to avoid cropping.

## 2.4.7 - Circular Voice Connect

**Date:** 2026-09-03
**Purpose:** Restore the preferred circular connection control.

- Replaces the Connect text pill with a circular purple voice-chat action.
- Preserves accessible Connect, Cancel, and Retry labels as state changes.

## 2.4.6 - Shorter Subtitle Fade

**Date:** 2026-09-03
**Purpose:** Reduce the lower subtitle fade height by 50% while retaining its CTA endpoint.

- Moves the lower fade start from 48% to 69% of the transcript viewport.
- Keeps the fade fully transparent at the existing point above the CTA.

## 2.4.5 - Voice Composition Polish

**Date:** 2026-09-03
**Purpose:** Refine the Voice hierarchy against physical-handset screenshots without changing its conversation contract.

- Aligns the unlabelled speed value and status on one optical baseline with a full-size speed hit target.
- Uses a circular, icon-only disconnect CTA consistent with the PTT control.
- Keeps the Samantha lockup at 20% opacity after the first connection, including after disconnect.
- Gives translucent subtitle turns purple borders and fades their lower half out before the CTA.

## 2.4.4 - Reader-Controlled Subtitles

**Date:** 2026-09-03
**Purpose:** Keep live subtitles at the latest capture without fighting a reader who has scrolled back.

- Auto-follows new subtitle captures while the transcript remains under app control.
- Pauses auto-follow as soon as the user manually scrolls the transcript.
- Shows a subtle down-chevron while paused; tapping it jumps to the latest capture and resumes auto-follow.

## 2.4.3 - Vertical Drag Boundaries

**Date:** 2026-09-03
**Purpose:** Make the main menu the only screen-navigation control and keep sortable gestures inside their current view.

- Removes horizontal swipe navigation without unmounting background views or interrupting an active Voice session.
- Locks project and task drag transforms to the vertical axis.
- Retains vertical scrolling and the existing drag-reorder persistence contract.

## 2.4.2 - Voice Control Surface

**Date:** 2026-09-03
**Purpose:** Make Voice the collision-free default mobile surface and keep its live state visually truthful.

- Opens directly on Voice with a centred Samantha lockup shared by the native splash screen.
- Replaces the progress card and connected lozenge with one colour-coded status readout beneath the main CTA.
- Uses LiveKit active-speaker state—not the continuously advancing audio element clock—to report Speaking.
- Makes subtitles always on, groups adjacent captures by speaker turn, removes quotation marks, and deepens the CTA fade.
- Moves disconnect into the central CTA; enabling PTT replaces it with the microphone action.
- Reduces speed control to a bottom-left readout: hold for the vertical override, tap for Auto.

## Unreleased - Deterministic Android Production Routing

**Date:** 2026-08-20

**Purpose:** Prevent debug APKs from packaging stale development/Tailnet-IP routing and make the production mobile route a durable, mechanically verified release contract.

### Delivered

- Made the public `.env.production` and `.env.example` routing profiles versionable while keeping local `.env` files ignored.
- Made `npm run build` explicitly use Vite production mode and verify the compiled PRISM, Voice token, LiveKit, and `/api/v1/sync` routes.
- Made `npm run cap:sync` rebuild and verify Android web assets before native packaging.
- Added an Android `preBuild` gate that rejects a missing production PRISM route or any private Tailnet IPv4 route in copied assets.
- Added focused routing tests for the checked-in profile, canonical compiled endpoints, the reported `100.113.109.60` regression, and a missing PRISM base.

### Verification Evidence

- Routing contracts passed 4 tests.
- Lint and the explicit production build passed.
- Capacitor Android sync and copied-asset routing verification passed.
- Android `assembleDebug` passed with the native routing gate executed.
- Fresh APK SHA-256: `4f2b581855e14ddf668431e50852380d1a389112ad152a08f80853957beb1378`.
- APK inspection found all three production URLs and zero private Tailnet IPv4 routes.
- Local PRISM reported Schema 1 revision 56.
- Initial external acceptance was blocked because the Tailscale HTTPS route and ADB device were unavailable.
- Follow-up physical acceptance installed the exact APK successfully on the CLT-L09 after both became available. The production edge and revision-56 sync snapshot passed, but the handset app remained `Offline`: the device reached the Tailscale host by IP while MagicDNS returned `unknown host` for `xenya.tail6504c1.ts.net`.

## 2.4.1 - Daily-driver Voice Controls

**Date:** 2026-09-03

**Purpose:** Make PRISM the reliable mobile control surface for Samantha Voice by closing Android microphone permission handling and making voice speed an explicit, observable runtime contract.

### Delivered

- Requests Android's package-level microphone permission before granting WebView audio capture.
- Avoids Capacitor foreground-service Promise/proxy assimilation.
- Adds a persistent 0.5–2.0× Voice speed control with an Auto mode.
- Synchronizes the control over LiveKit's data channel and reflects speed changes made by spoken commands.
- Replays the persisted setting before readiness when the Voice Bridge worker rejoins an existing handset room.
- Publishes the microphone before applying an initial PTT mute so audio readiness can complete in PTT mode.
- Aligns the client with Samantha Voice 2.6.1 while preserving the 2.6.0 readiness, attribution, PTT, subtitle, and delivery-proof contracts.

### Verification

- Unit/browser contracts cover settings acknowledgement validation and persisted UI control.
- Physical Android acceptance requires a non-default Kokoro request and handset audio delivery after installation.

## Unreleased - Voice Bridge 2.6.0 Client Integration

**Date:** 2026-08-15

**Purpose:** Bring Samantha App onto the deployed Samantha-Voice 2.6.0 client protocol while preserving the released PRISM Schema 1 synchronization contract.

### Delivered

- Added complete generation-scoped readiness gating, explicit warming, handshake timeout, cancellable credential fetch, and stale-room callback isolation.
- Added worker-side PTT control messages, structured speaker attribution, session-scoped David correction, bounded turn errors, and playback-backed delivery acknowledgement.
- Added focused protocol coverage for readiness, malformed data, speaker/delivery identifiers, bounded subtitles, stale callbacks, and pre-room cancellation.
- Reconfirmed the mobile app and PRISM desktop render the same 16 canonical Next task IDs in the same order from the live SQLite-backed service.

### Verification Evidence

- Production app build passed.
- Full Samantha App browser suite passed 26 tests, including 11 focused Voice and sync contracts.
- The source Samantha-Voice 2.6.0 protocol suite passed 10 tests.
- PRISM desktop/database suite passed 44 tests.
- Live local Samantha and PRISM browser surfaces both reported Synced with no browser warnings or errors.
- Capacitor Android sync and the debug APK build passed; physical handset UAT remains open because no ADB device was attached.

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

### Publication

- Canonical repository: `https://github.com/Difaroo/SAMANTHA_APP`
- Canonical branch: `master`
- Release commit: `b780006ec4dfaf29cba56cd60f268d80a706e3f7`
- Published: 2026-07-13

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
