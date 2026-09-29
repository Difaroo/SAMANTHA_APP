# Mercury PRISM app purple-flame launcher icon — 2026-09-02

## Outcome

The Android launcher resources and rebuilt debug APK now contain the canonical purple VoiceBridge flame. Physical installation verification is blocked because the attached handset has not authorized this Mac for ADB.

Product invariant: every Android launcher path—adaptive, legacy, and round—must resolve to the same recognizable purple-flame brand at every supported density.

## Contract

- The application manifest continues to reference `@mipmap/ic_launcher` and `@mipmap/ic_launcher_round`.
- Android 8+ adaptive icons use the transparent purple-flame foreground over the existing `#080b1b` navy background.
- Legacy and round slots use the dark-backed purple-flame artwork.
- `mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, and `xxxhdpi` resources are all present at Android's expected dimensions.
- The prior Voice join, subtitles, drag-and-drop, and routing changes remain unchanged.

## Asset and implementation

- Canonical dark-backed master: `public/samantha_flame_eternal.png` (1024 × 1024; SHA-256 `568abb09a83362078cf7118381a4499677882a43b8e9600af14db28aa7c304db`).
- Canonical transparent master: `public/samantha_flame_eternal_trans.png` (1024 × 1024; SHA-256 `74309b57a1f179f550d0fb915a4f6409c38e7e37eb9cbe89fcdadf222fac798d`).
- These masters visually match the VoiceBridge icon at `/Users/apple/samantha-voice/samantha-android/assets/images/icon.png`.
- The existing default Capacitor/Android robot PNGs were replaced in all 15 density slots: `ic_launcher.png`, `ic_launcher_foreground.png`, and `ic_launcher_round.png` across five densities.
- No generative redraw was used; retaining the canonical artwork avoids brand drift. Density derivatives were produced by lossless-format mechanical scaling.
- Capacitor has no separate launcher-icon reference to update; the Android manifest and adaptive XML files already point to these mipmap slots.

## Verification

- Visual inspection passed for:
  - 192 px legacy icon;
  - 432 px adaptive foreground;
  - 48 px minimum-density legacy icon;
  - adaptive foreground composited over the navy background.
- All 15 generated source PNGs have the expected dimensions and the adaptive foregrounds retain alpha.
- Production Vite build and mobile routing verification passed during `npm run cap:sync`.
- Capacitor Android sync and copied-asset routing verification passed.
- Gradle `assembleDebug` passed: 154 tasks, 33 executed and 121 up to date.
- Every one of the 15 PNG entries inside the APK is a byte-for-byte SHA-256 match with its corresponding source resource.
- APK signature verification passed with Android Signature Scheme v2 and one debug signer.
- ZIP alignment verification passed.
- APK package metadata is valid: `com.samantha.voice`, version `2.4.0`, versionCode `2`, minSdk `24`, targetSdk `36`.

## APK

- Path: `android/app/build/outputs/apk/debug/app-debug.apk`
- Size: 6.2 MB
- SHA-256: `8ec7c80f9a5a1c93cf0f42ad313d15b24c74dffb4e90963d4c1a6092eea765a3`

## Installation blocker

The connected handset is detected as `LCL0218329002211`, but `adb devices -l` reports it as `unauthorized`. The install command therefore stops before package transfer with `adb: device unauthorized`.

To finish physical verification, unlock the handset, accept its USB debugging authorization prompt for this Mac, then run:

```sh
adb -s LCL0218329002211 install -r android/app/build/outputs/apk/debug/app-debug.apk
```

After installation, confirm the purple flame appears on the launcher/home screen. APK structure, packaged icon bytes, signature, and alignment are already verified.

## Constraints observed

- All implementation and report writes stayed inside `/Users/apple/samantha-app`.
- VoiceBridge assets were read only for brand comparison.
- PRISM dispatch, gateway, Voice production services, and server/database configuration were not changed.
- Existing app rework changes and unrelated dirty-worktree changes were preserved.
