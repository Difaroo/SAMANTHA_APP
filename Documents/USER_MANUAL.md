# Samantha App User Manual

**Applies to:** Samantha App 2.4.15

## Overview

Samantha is an Android-first companion to PRISM. It provides Voice, Projects, Next, and Timer in one mobile interface. Project changes are available offline and synchronize with PRISM when connectivity returns.

The installed web-app release is shown in the top-right corner. This manual describes version 2.4.15; use that label when reporting a defect so behavior can be matched to the correct source revision.

## Navigation

Swipe horizontally or use the four icons along the bottom edge to move between main screens. On sortable cards, press and hold the grab grip to enter drag mode; card movement is vertical-only and cannot trigger screen navigation:

- **Voice:** connect to Samantha, review the live transcript, and use push to talk.
- **Projects:** browse projects and their tasks.
- **Next:** review and prioritize the cross-project execution queue.
- **Timer:** run a focus sequence for the selected task.

The app opens on Voice by default.

## Sync Status

The top-left status control reports the app's relationship with PRISM:

| Status | Meaning | Action |
|---|---|---|
| Connecting | Local data has loaded and PRISM is being contacted | Wait or tap to retry |
| Pending | One or more local changes are saved and waiting to send | Keep working; sync is automatic |
| Syncing | Changes are being sent or PRISM is being checked | No action required |
| Synced | Local and PRISM state have reconciled | No action required |
| Offline | Local work is available but PRISM cannot be reached | Reconnect, then tap the status if needed |
| Conflict | A newer PRISM edit won for one entity | Review the task or project before editing again |

Tapping the status control requests an immediate sync. It does not discard local changes.

## Projects and Tasks

1. Open Projects.
2. Select a project to see its ordered task list.
3. Use **Add Task** to create a task.
4. Select a task to read or edit its title, abstract, and outcomes.
5. Use **Add to Next** to place it in the global queue.
6. Use the Play control to open it in Timer.

New tasks begin outside Next. Changes appear immediately, even when offline.

## Next

Next is the shared priority queue across all projects.

- Drag tasks to change their global order.
- Select a task to open its details.
- Use Play to begin a timer sequence.
- A task is in Next only while it has a Next rank; desktop and mobile use the same rule.

After synchronization, mobile and PRISM should show the same task identities in the same order. Matching counts alone are not enough to prove parity.

## Timer

Starting a task from Projects or Next gives Timer that task's context. Timer supports start, pause, resume, skip, and cycle settings. Timer progress is not restored after the app process is stopped and is not synchronized to PRISM.

## Voice

1. The app opens on Voice. Tap the circular voice-chat control to connect.
2. Grant microphone and notification permissions when Android requests them.
3. Wait for the bridge to finish warming and report Listening; Cancel stops an in-progress connection.
4. The central control becomes **Disconnect** during a continuous-microphone call. Tap the side microphone-off control to enable push to talk.
5. In push-to-talk mode, hold the central purple microphone control while speaking. Tap the white microphone-off control to return to continuous mode.
6. Subtitles are always on. Samantha's turns are purple and your turns are white. Consecutive captures from the same speaker are grouped into one turn. New captures follow automatically until you scroll back; the down-chevron then pauses that movement. Tap the chevron to jump to the latest capture and resume following.
7. The bottom-left speed readout is purple while Samantha controls expressive speed automatically. Press and hold it to reveal the vertical 0.5×–2.0× override; it turns white while a fixed speed is active.
8. Tap the speed readout once to restore Auto. You can also say “speak slower,” “speak faster,” “set your voice speed to 0.75,” or “return to normal voice speed.”
9. If an unknown speaker label is wrong, use **This is David** to correct that speaker for the current voice session.
10. Tap **Disconnect** in the app or the Android foreground notification to end the session.

Voice failures do not prevent Projects, Next, Timer, or synchronization from working. A connection error changes the Connect control to Retry; a turn-level error remains recoverable without claiming that the entire bridge is ready or healthy.

## Offline Use

Projects, tasks, and pending changes are stored on the device. While offline:

- cached work remains visible;
- new and edited tasks remain visible;
- Next changes remain visible;
- the outbox survives a normal app restart;
- synchronization retries automatically after reconnection or app resume.

Do not uninstall the app or clear its storage while unsynced changes are pending. Device-only changes cannot be recovered after storage removal.

## Recovery

If desktop and mobile appear different:

1. Confirm PRISM is running and reachable.
2. Check the mobile status and pending count.
3. Reconnect the device and tap the sync status.
4. Compare the exact Next tasks and order, not only the count.
5. Preserve mobile app storage while pending changes exist.
6. Escalate persistent conflicts with the task name, device status, and approximate edit time.

## Current Release Notes

Version 2.4.5 refines the Voice composition with aligned readouts, a circular disconnect action, persistent post-call lockup dimming, purple subtitle edges, and a deeper subtitle fade. It retains the reader-controlled subtitle following, vertical-only drag boundaries, Voice Bridge 2.6.1 transport, and durable PRISM synchronization contracts.

The Android package must pass physical first-turn, microphone, speed-change, and response-loop acceptance before distribution.
