#!/usr/bin/env node
/**
 * Bumps the version everywhere it is written down, in one step.
 *
 *   node tools/bump-version.mjs 1.2.1
 *   node tools/bump-version.mjs 1.3.0 --notes "Dynamic quests, golden fish"
 *   node tools/bump-version.mjs 1.2.1 --dry-run
 *
 * Touches: www/version.json, www/js/config.js (APP_VERSION), package.json and
 * android/app/build.gradle (versionName + versionCode). The script refuses to
 * run if those files disagree before the bump, and re-reads everything after
 * writing so a silent miss fails loudly.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SEMVER_RE = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const write = (rel, text) => writeFileSync(join(ROOT, rel), text);

function fail(message) {
  console.error(`bump-version: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positional = args.filter((a) => !a.startsWith('--'));
const version = positional[0];

if (!version) fail('usage: node tools/bump-version.mjs <x.y.z> [--notes "…"] [--dry-run]');
if (!SEMVER_RE.test(version)) fail(`"${version}" is not a plain x.y.z version (no v prefix, no pre-release)`);

const notesIndex = args.indexOf('--notes');
const notes = notesIndex >= 0 ? args[notesIndex + 1] : '';
const dryRun = flags.has('--dry-run');

// ---- read the current state -------------------------------------------------
const versionJsonPath = 'www/version.json';
const gradlePath = 'android/app/build.gradle';
const configPath = 'www/js/config.js';
const packagePath = 'package.json';

const versionJson = JSON.parse(read(versionJsonPath));
const gradle = read(gradlePath);
const config = read(configPath);
const pkg = JSON.parse(read(packagePath));

const gradleCode = gradle.match(/versionCode\s+(\d+)/);
const gradleName = gradle.match(/versionName\s+"([^"]+)"/);
const configVersion = config.match(/APP_VERSION\s*=\s*'([^']+)'/);

if (!gradleCode || !gradleName) fail(`could not read versionCode/versionName from ${gradlePath}`);
if (!configVersion) fail(`could not read APP_VERSION from ${configPath}`);

const current = {
  'www/version.json': versionJson.version,
  'android/app/build.gradle': gradleName[1],
  'www/js/config.js': configVersion[1],
  'package.json': pkg.version
};

const disagreements = Object.entries(current).filter(([, v]) => v !== versionJson.version);
if (disagreements.length) {
  for (const [file, value] of disagreements) console.error(`  ${file}: ${value}`);
  fail(`files disagree with www/version.json (${versionJson.version}); fix them before bumping`);
}

if (version === versionJson.version) fail(`already at ${version}`);
const cmp = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};
if (cmp(version, versionJson.version) < 0) fail(`${version} is lower than the current ${versionJson.version}`);

const nextCode = Number(gradleCode[1]) + 1;
const tag = `v${version}`;
const apkUrl = `https://github.com/hamouda0024/paws-in-the-city/releases/download/${tag}/urban-stray-${tag}.apk`;
const today = new Date().toISOString().slice(0, 10);

// ---- new contents ----------------------------------------------------------
const nextVersionJson = {
  ...versionJson,
  version,
  versionCode: nextCode,
  released: today,
  notes: notes || versionJson.notes,
  downloadUrl: apkUrl
};

const nextGradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${nextCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);

const nextConfig = config.replace(
  /APP_VERSION\s*=\s*'[^']+'/,
  `APP_VERSION = '${version}'`
);

const nextPackage = { ...pkg, version };

// ---- write + verify --------------------------------------------------------
if (dryRun) {
  console.log(`would bump ${versionJson.version} (code ${gradleCode[1]}) -> ${version} (code ${nextCode})`);
  console.log(JSON.stringify(nextVersionJson, null, 2));
  process.exit(0);
}

write(versionJsonPath, JSON.stringify(nextVersionJson, null, 2) + '\n');
write(gradlePath, nextGradle);
write(configPath, nextConfig);
write(packagePath, JSON.stringify(nextPackage, null, 2) + '\n');

const checkJson = JSON.parse(read(versionJsonPath));
const checkGradle = read(gradlePath);
const checkConfig = read(configPath);
const checkPackage = JSON.parse(read(packagePath));

const ok =
  checkJson.version === version &&
  checkJson.versionCode === nextCode &&
  checkJson.downloadUrl === apkUrl &&
  checkGradle.includes(`versionCode ${nextCode}`) &&
  checkGradle.includes(`versionName "${version}"`) &&
  checkConfig.includes(`APP_VERSION = '${version}'`) &&
  checkPackage.version === version;

if (!ok) fail('wrote the files but the read-back does not match; inspect the diff');

console.log(`bumped ${versionJson.version} -> ${version} (versionCode ${nextCode})`);
console.log(`  ${versionJsonPath}: version, versionCode, released, downloadUrl`);
console.log(`  ${configPath}: APP_VERSION`);
console.log(`  ${gradlePath}: versionCode, versionName`);
console.log(`  ${packagePath}: version`);
console.log(`\nnext: update CHANGELOG.md, then bash scripts/build-apk.sh release`);
