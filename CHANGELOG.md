# Changelog

All notable changes to Urban Stray are documented here.
This project follows [Semantic Versioning](https://semver.org/).

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
