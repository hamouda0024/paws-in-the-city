# Changelog

All notable changes to Urban Stray are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## [1.1.0] — 2026-11-12

### Added
- **Ownership notice.** The title screen and the About screen now carry
  “© 2026 Zerguine Ahmed Islam. All rights reserved.” alongside the Arabic notice
  “حقوق الملكية محفوظة لـ زرقين أحمد إسلام”.
- **Silent update check.** On boot the game fetches `www/version.json` from the
  repository, compares it with the running build and — only when a newer version is
  published — shows a non-blocking “Update available” card on the title screen with a
  **Download update** button (opens the system browser on Android) and a **Later**
  button. Offline, blocked, CORS and malformed-manifest cases are swallowed: the game
  never stalls or crashes. Settings also gets a manual **Check for updates** row.

### Fixed
- **Menu buttons did not respond to touch.** Button presses were cleared at the end of
  each update, before the menu screens (which are drawn later in the frame) read them,
  so only the keyboard worked. Press/release state now survives the whole frame, and
  taps are hit-tested at pointer-down so a quick touch can’t be missed. This fixes the
  title menu, pause menu, settings and game-over buttons on touch devices.
- Same-origin manifests no longer fail when the app is self-hosted (removed a
  restrictive credentials mode from the update fetch).

## [1.0.0] — 2026-11-12

First playable release, shipped as a signed Android APK.

### Added
- **Survival loop:** hunger, health and energy bars; starvation damage; slow health
  regeneration while well fed; day counter with a 2m48s day/night cycle.
- **Cat controller:** acceleration/friction movement, variable-height jump, coyote time,
  jump buffering, sprint pounce, wall-claw slides, impact-scaled landing squash, and a
  spring-driven tail with blinks, ear flicks and idle sitting.
- **Procedural city:** endless 960 px chunks, two buildings per chunk with a climbable
  dumpster → awning → balcony → rooftop chain, alleys, water tanks, signage, fire escapes,
  parallax skyline, lit windows and storefront light spill.
- **Hazards:** cars with horn/headlight/edge-arrow telegraph, patrolling and chasing stray
  dogs that can be distracted with food, toxic runoff, damaging falls.
- **Scavenging:** dumpster rummaging (scraps, milk, duds, or a rat), ground and rooftop food,
  catchable mice, kind humans who drop sandwiches, cardboard boxes and warm vents to sleep in.
- **Weather:** rain cycles with spray, wet reflections, fog and a louder soundscape; night
  grading with light pools and glowing food.
- **UI/UX:** title, how-to-play, settings (sound, haptics, touch controls), about, pause and
  game-over screens; best-run record in `localStorage`; full touch pad plus keyboard support.
- **Audio:** fully procedural WebAudio — rain, city rumble, distant sirens, sparse night
  motif, car passes, horns, barks, meows, purrs, footsteps and UI blips.
- **Android shell:** Capacitor 8, landscape-locked, immersive fullscreen, keep-awake,
  generated launcher icon and splash art.
- **Tooling:** rootless JDK/Android SDK installer, one-command signed APK build script,
  dependency-free dev server, icon generator, CI workflow that builds and publishes the APK.

### Known limitations
- Tested in Chromium/WebView, not yet on physical Android hardware.
- Endless procedural difficulty ramp; no authored levels or cloud saves.
- Audio requires one tap to unlock (browser/WebView autoplay policy).
