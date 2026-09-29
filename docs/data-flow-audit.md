# Samantha Android App — Data Flow Audit

> Superseded on 2026-07-13 by `docs/sync-architecture.md`. The empty-seed/full-state architecture described below has been replaced by the revisioned `/api/v1/sync` contract. This file remains as incident history.
>
> Absolute filesystem paths in this report record the original incident machine. They are historical evidence, not portable operating instructions.

**Date:** 2026-07-11 20:33 BST
**Auditor:** Samantha (Sovereign Executive)

---

## 1. Verification: APK Has Correct Env Vars Baked In

**Result: ✅ PASS**

The bundled JS in `dist/assets/index-DPuC2TjK.js` contains the correct hardcoded fallback:

```
http://100.113.109.60:3333
```

This matches the expected PRISM endpoint. The `.env` file's `VITE_API_BASE` value (if any) is overridden by the fallback in `syncManager.ts`:

```ts
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3333';
```

- Vite treeshakes both the env var AND the fallback into the bundle.
- The string `http://100.113.109.60:3333` appears in the built JS (confirmed), meaning env var IS passed correctly via `VITE_API_BASE`.
- The voice bridge also has `http://100.113.109.60:3010` and `ws://100.113.109.60:7880` baked in — consistent.

**No env-misconfiguration issue.**

---

## 2. Verification: PRISM Endpoints Return Valid JSON Data

**Result: ❌ FAIL (Transient)**

| Endpoint | Method | Status | Body |
|----------|--------|--------|------|
| `/seed`  | GET    | 200    | `[]` (empty array) |
| `/state` | POST   | 200    | `{"ok":true}` |

**Key finding:** The `.prism_seed.json` file is currently **empty** (`[]`, 2 bytes). It was last modified at **20:32:33** (1 minute before this audit), likely overwritten by a PRISM `/seed` POST during an app sync push or an automated process.

When the app calls `fetchSeed()` on fresh install:
```ts
if (Array.isArray(data) && data.length > 0) {
  const { projects, epics } = prismToLocal(data);
  useEntityStore.getState().setSyncedState(projects, epics);
}
```

The guard `data.length > 0` **blocks the update** when the seed is empty. This means:
- **Fresh install with empty seed** → store stays `[]` → blank screen.
- **Existing install with cached localStorage** → keeps old (possibly stale or empty) state.

**Root cause speculation:** The seed file may have been cleared by:
1. A `/state` POST from the Android app's `pushState()` that serialized an empty store back to PRISM.
2. A manual edit of `.prism_seed.json`.
3. An automated process (backlog auto-dispatch, PRISM reset) that emptied it.

**Fix needed:** Rebuild the seed. See Section 8.

---

## 3. syncManager Error Handling

**Result: ✅ PASS (Defensive)**

`fetchSeed()` error handling is correct:
```ts
try {
  const res = await fetch(`${API_BASE}/seed`);
  if (res.ok) {
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      // ... update store
    }
  }
} catch (err) {
  console.warn('[SyncManager] Failed to fetch PRISM seed', err);
}
```

- Timeout/network failures → caught → logged → app continues with cached state.
- Non-200 responses → `res.ok` is false → no crash.
- Empty array → `data.length > 0` guard → no overwrite with empty state.

**But there's a subtle first-load gap:**
- On fresh install, `localStorage` has no persisted state → `projects: [], epics: []`.
- SyncManager `init()` runs `setTimeout(() => { ... fetchSeed() }, 100)`.
- If seed is empty → no update → store stays empty forever (until seed has data).
- No retry, no polling, no fallback UI.

---

## 4. Tailscale Connectivity

**Result: ✅ PASS**

```
100.113.109.60   xenya              difaroo      linux   active, direct
100.79.135.20    android-clt-l09-1  difaroo      android active, direct
100.86.230.132   difaroo-m4         difaroo      macOS   active, direct
100.125.49.33    difaroo-mini       difaroo      macOS   active, direct
```

All nodes are connected **direct** (no relay/DERP). PRISM is bound to `*:3333` (all interfaces) with CORS `Access-Control-Allow-Origin: *`. The Android phone `clt-l09-1` (100.79.135.20) should be able to reach Xenya (100.113.109.60:3333).

**CORS is not an issue.** The Android Capacitor config has:
```json
{
  "server": { "androidScheme": "https" },
  "android": { "allowMixedContent": true }
}
```
And `AndroidManifest.xml` has `android:usesCleartextTraffic="true"`. HTTP fetch from HTTPS WebView origin to `http://100.113.109.60:3333` is permitted.

---

## 5. App Logs

**Result: ⚠️ NOT VERIFIED (Remote Device)**

Cannot access Android device logs remotely. To check on David's phone:

```bash
adb logcat | grep SyncManager
adb logcat | grep samantha
```

Expected output if sync is failing silently:
```
[SyncManager] Failed to fetch PRISM seed  (if network issue)
```
Expected output if seed is empty:
```
(no log — the guard `data.length > 0` just silently skips)
```

---

## 6. Store Initialization Gap (Root Cause Analysis)

### The cold-start problem:

| Scenario | Fresh Install (no localStorage) | Re-install (has localStorage) |
|----------|--------------------------------|-------------------------------|
| Seed has data | ✅ Loads correctly | ✅ Loads seeded data |
| Seed is empty | ❌ **Blank screen** (store stays `[]`) | ⚠️ Shows whatever was cached in localStorage (possibly empty) |

### The warm-start problem (existing user):

| Scenario | Store has data | Seed is empty | Behavior |
|----------|---------------|---------------|----------|
| App opens, `init()` runs | Yes (`projects: [P1, P2...]`) | Yes (`[]`) | ❌ `pushState()` fires (because `hasOfflineChanges` is false) → `fetchSeed()` runs → guard blocks empty → **store is unchanged but stale** |

### The clean-install / reinstall problem:

If David wiped app data or reinstalled, and the seed is empty at that moment, the app will show a blank screen permanently — regardless of Tailscale or env vars.

**This is the most likely explanation for "no records show on David's phone."**

---

## 7. Additional Observations

### 7.1. `projects.tsx` Rendering
The `ProjectsView` component maps `projects` from the entity store. If `projects` is `[]`, the list renders nothing (no "no projects" placeholder). This confirms the blank-screen UX.

### 7.2. PRISM `/state` POST Side Effect
When the app calls `pushState()` (triggered by offline changes), PRISM **writes** its state back to `.prism_seed.json`. If the store was empty at that point (fresh install, or a `setSyncedState` already ran), PRISM overwrites the seed file with empty data, compounding the problem.

### 7.3. Seed File Last Modified
Stat confirms `.prism_seed.json` was last modified at 20:32:33 — likely a `/state` POST that wrote empty state back to disk.

---

## 8. Fix Recommendations

### Immediate Fix (Unblock David)
Rebuild the PRISM seed from the portfolio source:

```bash
# Option A: Direct restore from known good state
# PRISM's control/ directory has the portfolio.codex.json source
# But the seed format is a flat array of streams, not raw portfolio.

# Option B: PRISM may have a runtime cache or backup
ls -la /Users/apple/Prism/state/
```

**Most practical immediate fix:** Write a minimal seed file with the known projects/epics from `portfolio.codex.json`:

<details>
<summary>Suggested seed rebuild script</summary>

```bash
# Write a seed with the known active projects from portfolio.codex.json
node -e '
const seed = [
  {
    "id": "samantha-core",
    "name": "Samantha Core (Sovereign OS)",
    "type": "Project",
    "status": "Active",
    "abstract": "Samantha being files, AGENTS.md, memory systems, wiki, PRISM integration",
    "children": []
  },
  {
    "id": "arcrunner-saas",
    "name": "ArcRunner - Production Platform",
    "type": "Project",
    "status": "Active",
    "abstract": "Production storytelling platform with HyperFrames, voice, and Canvas rendering",
    "children": []
  },
  {
    "id": "samantha-app",
    "name": "SAMANTHA App (Native/Mobile)",
    "type": "Project",
    "status": "Active",
    "abstract": "Capacitor Android app with PRISM sync, voice bridge, and entity views",
    "children": []
  },
  {
    "id": "voice-bridge",
    "name": "Samantha Voice Bridge",
    "type": "Project",
    "status": "Active",
    "abstract": "LiveKit voice bridge connecting Android app to OpenClaw agent",
    "children": []
  }
];
require("fs").writeFileSync("/Users/apple/Prism/.prism_seed.json", JSON.stringify(seed, null, 2));
console.log("Seed written with " + seed.length + " streams");
'
```
</details>

### Code Fix (Permanent)
1. **Add a retry/poll loop** to `fetchSeed()` — retry 3 times with 2s backoff if the response is empty.
2. **Add a "no projects" placeholder** in `ProjectsView` so the user knows sync is pending, not broken.
3. **Don't trigger `pushState()` on init** when `hasOfflineChanges` is false — re-check the logic.
4. **Log a warning** when `/seed` returns empty — `console.warn('[SyncManager] PRISM seed is empty — no data loaded')`.

---

## 9. Summary

| Check | Status | Detail |
|-------|--------|--------|
| Env vars in APK | ✅ PASS | Correct (`http://100.113.109.60:3333`) |
| PRISM endpoint | ❌ FAIL | `/seed` returns `[]` (empty) |
| syncManager guards | ✅ PASS | Handles empty gracefully (but silently) |
| Tailscale connectivity | ✅ PASS | Direct connections, all nodes reachable |
| CORS / mixed content | ✅ PASS | `Access-Control-Allow-Origin: *`, cleartext allowed |
| App logs | ⚠️ UNVERIFIED | Need adb on David's phone |
| **Root cause** | 🎯 | **PRISM `.prism_seed.json` is empty (`[]`). App never loads data on fresh start.** |

**Bottom line:** The APK is correct. The plumbing is correct. The problem is the data source — PRISM has an empty seed file. Restore the seed and the phone will populate on next sync.
