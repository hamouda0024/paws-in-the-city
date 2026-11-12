# Contributing to Urban Stray

Thanks for helping the stray. This project is a plain ES-module Canvas game with a
Capacitor Android shell — no framework, no build step for the web layer.

## Local setup

```bash
npm ci                 # Capacitor CLI + Android platform (web layer has no dependencies)
npm run dev            # http://localhost:3000 — hot reload by refreshing
```

Desktop testing uses the keyboard; enable **Settings → Touch controls → Always** to see
the on-screen pads on a desktop browser.

## Where things live

| Want to change | File |
| --- | --- |
| Movement, gravity, jump, hunger/health/energy rates, hazard damage, day length, palette | `www/js/config.js` |
| Cat behaviour, physics, drawing | `www/js/game/cat.js` |
| City generation, weather, traffic | `www/js/game/world.js` |
| Cars, dogs, humans, mice, food, sleep spots | `www/js/game/entities.js` |
| Skies, facades, street, lighting | `www/js/game/background.js` |
| HUD, prompts, touch pad, toasts | `www/js/game/hud.js` |
| Menus and screens | `www/js/game/screens.js` |
| Run state, camera, damage rules, records | `www/js/game/game.js` |
| Synth audio | `www/js/core/audio.js` |

## Guidelines

- Keep gameplay tuning in `config.js`; avoid magic numbers inside systems.
- Do not add image or audio assets: the art is drawn with Canvas paths and the sound is
  synthesized, which keeps the APK around 4 MB. If you need a new sound, add a method to
  `AudioEngine`.
- Target 60 FPS on mid-range phones: reuse gradients, avoid per-frame allocations in the
  render loop, and cap particles.
- Match the visual language: moody urban palette, warm sodium lights, readable silhouettes.
- Update `CHANGELOG.md` under an `Unreleased` heading for player-visible changes.

## Building the APK locally

```bash
./tools/setup-android-toolchain.sh   # once: JDK 21 + Android SDK 36, no root
./scripts/build-apk.sh               # signed release -> dist/urban-stray-release.apk
./scripts/build-apk.sh debug         # debug build
```

Signing keys are generated locally on first build and are git-ignored. Never commit
`android/keystore.properties` or any `.keystore`/`.jks` file.

## Releases

Push a tag to publish an APK through GitHub Actions:

```bash
git tag v1.0.1 && git push origin v1.0.1
```

The workflow builds, attaches the APK to a GitHub Release, and uploads it as a build
artifact. Add `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`
and `ANDROID_KEY_PASSWORD` as repository secrets for a signed release build; without them
CI produces a debug-signed APK.
