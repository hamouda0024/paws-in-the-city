# Security policy

Urban Stray is an offline single-player game: there are no accounts, no telemetry,
no analytics and no server-side component. The only network request the game makes
is the optional version check described below.

## Supported versions

Only the latest published release receives fixes.

| Version | Supported |
| --- | --- |
| 1.2.x | Yes |
| < 1.2 | No — please update |

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Use GitHub's private
reporting instead:

<https://github.com/hamouda0024/paws-in-the-city/security/advisories/new>

Include the version (Settings → About shows it), the device/Android version, what
you expected, what happened, and the steps to reproduce. If you have a proof of
concept, attach it to the advisory rather than posting it publicly.

You can expect an acknowledgement within 7 days and a status update within 30 days.
Once a fix ships, you will be credited in the release notes unless you ask not to be.

## Scope

In scope:

- the web game in `www/` (Canvas 2D engine, input, save data),
- the Android shell in `android/` (Capacitor host, manifest, permissions),
- the update-check trust model,
- the build and release pipeline (`.github/workflows`, `scripts/`).

Out of scope:

- modified/repackaged APKs that are not signed by this project (verify the
  SHA-256 checksum published with each release),
- vulnerabilities in the upstream Android/Chromium WebView runtime that require a
  platform patch rather than an app change,
- phishing or social-engineering attempts.

## What the project already does

- **Update checks are untrusted input.** `www/js/core/updates.js` accepts a manifest
  only when `version` is a strict numeric semver that is newer than the build and
  `downloadUrl` is `https://github.com/hamouda0024/paws-in-the-city/...`. Any other
  response — malformed, downgrade, foreign host, plain HTTP — is ignored silently.
  The `window.__urbanStrayUpdateUrl` override is honoured on local dev hosts only.
- **No cleartext traffic.** `android:usesCleartextTraffic="false"`, HTTPS-only server
  scheme, no mixed content.
- **No Android backups.** `android:allowBackup="false"`; the WebView store is not
  exported to cloud backup.
- **Minimal permissions.** `INTERNET` (update check) and `VIBRATE` (haptics) only.
- **No WebView debugging.** `webContentsDebuggingEnabled: false`.
- **Release integrity.** Every APK in `releases/` ships with a `.sha256` file, and the
  GitHub Release attaches that checksum. Published APKs are signed; verify with
  `apksigner verify --print-certs urban-stray-v<version>.apk`.
- **No secrets in the repository.** Keys are generated locally or supplied through
  GitHub Actions secrets; `*.keystore`, `*.jks`, `*.p12`, `keystore.properties`,
  `.env*` and `local.properties` are ignored.

## Local save data

Progress (best run, golden-fish unlock, settings) lives in the WebView's
`localStorage` on the device. It contains no personal data and is never uploaded.
Clearing the app's storage resets it.
