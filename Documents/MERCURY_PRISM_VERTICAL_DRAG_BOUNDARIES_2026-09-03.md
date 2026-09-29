# PRISM vertical drag boundaries — 2026-09-03

## Product invariant

Only the bottom menu may change PRISM's main screen. Dragging a project or task may reorder it vertically within its current list, but a lateral gesture must neither move the item sideways nor navigate to another screen.

## Contract

- The four main views remain mounted so navigation does not terminate a live Voice session.
- The view strip moves only when `navigationStore.currentView` changes through an application action such as the bottom menu; it is not horizontally scrollable by the user.
- Every project and task sortable context applies the shared vertical-axis modifier.
- Vertical touch scrolling and persisted vertical reordering remain unchanged.

## Verification

- `npm run lint` — passed.
- `npm run test:e2e` — **36 passed**, including horizontal-touch rejection, zero-horizontal-offset dragging, touch-hold reordering, persisted task order, persisted project order, and all existing Voice/PRISM contracts.
- Production build, mobile route verification, Capacitor Android sync, copied-asset route verification, and Android `assembleDebug` — passed.
- PRISM Android **2.4.3** (`versionCode 5`) installed successfully on the tethered handset; microphone permission remains granted.

## Artifact

- APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- SHA-256: `55d4e4001131a7f67929a65c4d940fd123885dfb9914e52e0903cbb30f6b757c`

## Constraints

- No swipe replacement or adjacent navigation redesign was introduced.
- Existing unrelated working-tree changes were preserved.
