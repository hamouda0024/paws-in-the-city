#!/usr/bin/env bash
#
# Builds Urban Stray into an installable Android APK.
#
#   ./scripts/build-apk.sh            # signed release APK  -> dist/urban-stray-release.apk
#   ./scripts/build-apk.sh debug      # debug APK           -> dist/urban-stray-debug.apk
#
# Requirements (checked below): JDK 17+ and the Android SDK (platform 36 + build-tools 36).
# `tools/setup-android-toolchain.sh` installs both without root, into ~/toolchain.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-release}"

export JAVA_HOME="${JAVA_HOME:-$HOME/toolchain/jdk}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/toolchain/android}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

echo "==> Checking toolchain"
if ! command -v java >/dev/null 2>&1; then
  echo "!! No JDK found. Run tools/setup-android-toolchain.sh, or set JAVA_HOME." >&2
  exit 1
fi
if [ ! -d "$ANDROID_HOME/platforms/android-36" ]; then
  echo "!! Android SDK platform 36 missing under $ANDROID_HOME" >&2
  echo "   Run: sdkmanager \"platforms;android-36\" \"build-tools;36.0.0\"" >&2
  exit 1
fi
java -version 2>&1 | head -1

echo "==> Installing JS tooling (lockfile-preserving)"
cd "$ROOT"
if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund
fi

echo "==> Copying web assets into the Android shell"
npx cap sync android

if [ "$MODE" = "release" ]; then
  echo "==> Preparing release signing key"
  KS_PROPS="$ROOT/android/keystore.properties"
  if [ ! -f "$KS_PROPS" ]; then
    # A local upload key. Generated once, never committed (.gitignore).
    # PKCS#12 keystores require the key password to match the store password.
    STORE_PASS="$(python3 -c 'import secrets;print(secrets.token_urlsafe(24))')"
    "$JAVA_HOME/bin/keytool" -genkeypair -v \
      -keystore "$ROOT/android/urban-stray.keystore" \
      -alias urbanstray -keyalg RSA -keysize 2048 -validity 10950 \
      -storetype PKCS12 -storepass "$STORE_PASS" -keypass "$STORE_PASS" \
      -dname "CN=Urban Stray, OU=Games, O=Urban Stray, L=City, C=US" >/dev/null 2>&1
    cat > "$KS_PROPS" <<EOF
storeFile=urban-stray.keystore
storePassword=$STORE_PASS
keyAlias=urbanstray
keyPassword=$STORE_PASS
EOF
    chmod 600 "$KS_PROPS" "$ROOT/android/urban-stray.keystore"
    echo "    generated android/urban-stray.keystore (local only)"
  else
    echo "    reusing android/keystore.properties"
  fi
  echo "==> Gradle: assembleRelease"
  (cd "$ROOT/android" && ./gradlew assembleRelease --console=plain)
  SRC="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
  OUT="$ROOT/dist/urban-stray-release.apk"
else
  echo "==> Gradle: assembleDebug"
  (cd "$ROOT/android" && ./gradlew assembleDebug --console=plain)
  SRC="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
  OUT="$ROOT/dist/urban-stray-debug.apk"
fi

mkdir -p "$ROOT/dist"
cp "$SRC" "$OUT"

echo "==> Verifying APK"
"$ANDROID_HOME/build-tools/36.0.0/aapt2" dump badging "$OUT" 2>/dev/null \
  | grep -E "^(package|application-label|sdkVersion|targetSdkVersion|launchable-activity)" || true
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --print-certs "$OUT" >/dev/null 2>&1 \
  && echo "    signature: valid" || echo "    signature: unverified (debug builds use the debug key)"

echo
echo "APK ready: $OUT ($(du -h "$OUT" | cut -f1))"
echo "Install with: adb install -r \"$OUT\""
