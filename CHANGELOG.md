# Changelog

All notable changes to Urban Stray are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## [1.2.1] — 2026-11-13

Security, stability and polish. No gameplay or balance changes.

### Security
- **Update check can no longer be poisoned.** The manifest is untrusted input: the
  version must be plain numeric semver and strictly newer than the build, and the
  download URL must be `https://github.com/hamouda0024/paws-in-the-city/...`.
  Malformed, downgrade, foreign-host and plain-HTTP manifests are ignored silently.
  The debug URL override now only works on localhost or with an explicit debug flag.
- **Android hardening:** `allowBackup="false"` (saves never leave the device) and
  `usesCleartextTraffic="false"`. Permissions remain `INTERNET` + `VIBRATE` only.
- **Release integrity:** every APK now ships a `.sha256` sidecar that the GitHub
  Release attaches, `scripts/build-apk.sh` refuses to package a version that disagrees
  with `www/version.json`, and the README documents how to verify a download.
- **Secret hygiene:** `.gitignore` covers keystores, `*.p12`, `*.pem`, `*.key`,
  `google-services.json` and `.env*`, and the full git history was audited (no key
  material; the only `storePassword=` lines are variable references).
- **Supply chain:** Dependabot watches npm, Gradle and GitHub Actions; `npm audit` is
  clean; `SECURITY.md` documents the trust model and private reporting.

### Added
- **Touch pause button** under the clock, and every on-screen pad now respects the
  device safe-area insets.
- **Lighting quality (High / Low).** Low skips the lamp glow, cat light pool and
  gradient grading and reuses cached vignettes. If frames stay above ~20 ms for five
  seconds the game drops to Low once per session, says so, and remembers the choice.
- **English / العربية interface.** Auto follows the device language; Arabic is shaped
  and mirrored on the canvas (menus, help, settings, pause, game over, HUD labels,
  toasts) with `dir=rtl` kept in sync around the canvas.
- **`tools/bump-version.mjs`** updates `version.json`, `APP_VERSION`, `package.json`,
  `versionCode`/`versionName` and the release URL in one step, and refuses to run when
  they already disagree.
- **Unit tests** for `survival.js` and `rng.js` (31 cases) run in CI before the APK is
  assembled.

### Changed
- Saves go through `core/storage.js`: reads never throw, corrupt JSON is dropped, and
  settings/records are validated, so tampered or half-written data cannot put `NaN` on
  the HUD. Storage failures fall back to memory instead of breaking the run.

## [1.2.0] — 2026-11-12

### Fixed
- **Invisible city / floating cat.** Buildings, awnings, balconies, crates and
  dumpsters were drawn in world coordinates without the camera offset, so past the
  first screen they vanished while their colliders stayed behind. The structural layer
  is now translated by the camera, which fixes the cat standing on air, invisible
  walls and “Rummage the dumpster” prompts pointing at nothing.
- Every climbable prop is now a single `Prop` object that owns its collision box *and*
  its artwork, and is clamped inside the building that owns it — draw and hitbox can
  no longer drift apart.

### Changed
- **True full-screen play.** The fixed 960×540 letterbox is gone: the virtual view
  height stays 540 while its width follows the screen aspect, so the city fills the
  whole display with no bars or gutters. A `ResizeObserver` re-fits the canvas on any
  layout change.
- **Rebuilt touch controls:** ◀ and ▶ sit side by side, every pad is ~35% larger, the
  sprint pad is stacked above the jump pad, and the paw button only appears when
  something is actually in reach — with a pulsing highlight and a labelled action.
- **Varied city:** apartment blocks, lit shops with neon signs, stepped lofts and roller-
  shuttered warehouses, each with its own storefront, palette and roofline.

### Added
- **Game feel:** dust on jumps and landings, camera shake from hard landings and from
  fast traffic passing close, stronger cat-eyeshine at night, and real rain splashes
  that land on the street and on rooftops.
- **Dynamic quests:** shelter from a storm, sneak past a stray dog, and collect golden
  fish on the rooftops. Quests pay food and rotate through the run.
- **Golden fish + double jump:** three golden fish permanently unlock a mid-air second
  jump (saved between runs).

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
