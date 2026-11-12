#!/usr/bin/env bash
# Installs a user-local JDK 21 + Android SDK (no root required).
# Everything lands in ~/toolchain so the project checkout stays clean.
set -euo pipefail

TC="$HOME/toolchain"
mkdir -p "$TC"
cd "$TC"

if [ ! -x "$TC/jdk/bin/java" ]; then
  echo "[1/3] Downloading Temurin JDK 21..."
  curl -L --fail -o jdk.tar.gz \
    "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse"
  mkdir -p jdk
  tar -xzf jdk.tar.gz -C jdk --strip-components=1
fi

if [ ! -x "$TC/android/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "[2/3] Downloading Android command-line tools..."
  curl -L --fail -o cmdtools.zip \
    "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  mkdir -p android/cmdline-tools
  unzip -q -o cmdtools.zip -d android/cmdline-tools
  mv -f android/cmdline-tools/cmdline-tools android/cmdline-tools/latest
fi

export JAVA_HOME="$TC/jdk"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="$TC/android"
export ANDROID_SDK_ROOT="$TC/android"

echo "[3/3] Installing SDK packages..."
yes | "$TC/android/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$ANDROID_HOME" \
  --licenses >/dev/null 2>&1 || true
"$TC/android/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$ANDROID_HOME" \
  "platform-tools" "platforms;android-35" "build-tools;35.0.0" >/dev/null

echo "TOOLCHAIN_READY"
"$JAVA_HOME/bin/java" -version 2>&1 | head -1
ls "$ANDROID_HOME/platforms"
