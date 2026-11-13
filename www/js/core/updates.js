/**
 * Silent, offline-safe update check.
 *
 * Fetches a small JSON manifest (version.json on the repository) and compares it
 * with the running build. Any network/CORS/parse failure is swallowed: the game
 * keeps playing exactly as before, and the banner simply never appears.
 *
 * SECURITY: the manifest is untrusted input. A response is only accepted when
 *   - `version` is a strict numeric semver ("1.2.3", no prefixes/suffixes),
 *   - it is strictly newer than the running build,
 *   - `downloadUrl` is https on github.com and lives under this repository,
 *   - `pageUrl` (optional) is https on github.com under this repository.
 * Anything else is treated exactly like a network failure: no banner, no error
 * UI, no navigation to an untrusted URL.
 *
 * Manifest shape:
 *   {
 *     "version": "1.3.0",
 *     "notes": "what changed",
 *     "downloadUrl": "https://github.com/<owner>/<repo>/releases/download/v1.3.0/…apk",
 *     "pageUrl": "https://github.com/<owner>/<repo>/releases"
 *   }
 */
const DISMISS_KEY = 'urban-stray-update-dismissed';

/** Only this repository's GitHub URLs may ever be opened by the game. */
const TRUSTED_HOST = 'github.com';
const TRUSTED_PATH_PREFIX = '/hamouda0024/paws-in-the-city/';
const DEFAULT_PAGE_URL = 'https://github.com/hamouda0024/paws-in-the-city/releases';

/** Strict numeric semver: exactly three dot-separated non-negative integers. */
const SEMVER_RE = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;

export function parseVersion(value) {
  const match = SEMVER_RE.exec(String(value ?? '').trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isValidVersion(value) {
  return parseVersion(value) !== null;
}

/** Returns true when `candidate` is a strictly newer semantic version. */
export function isNewerVersion(candidate, current) {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

/** True only for https GitHub URLs inside this repository. */
export function isTrustedRepoUrl(raw) {
  let url;
  try {
    url = new URL(String(raw ?? ''));
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.hostname !== TRUSTED_HOST) return false;
  if (!url.pathname.startsWith(TRUSTED_PATH_PREFIX)) return false;
  return true;
}

/**
 * The manifest override is a development tool. It is honoured only on a local
 * dev host (or when a debug build opts in explicitly), never in the packaged app.
 */
export function isDebugOverrideAllowed() {
  try {
    if (typeof window !== 'undefined' && window.__urbanStrayDebug === true) return true;
    if (typeof location === 'undefined') return false;
    const host = location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  } catch {
    return false;
  }
}

/** Validate and normalise a manifest. Returns null when it must be ignored. */
export function parseManifest(data, currentVersion) {
  if (!data || typeof data !== 'object') return null;

  const version = typeof data.version === 'string' ? data.version.trim() : '';
  if (!isValidVersion(version)) return null;
  if (!isNewerVersion(version, currentVersion)) return null;

  const downloadUrl = typeof data.downloadUrl === 'string' ? data.downloadUrl.trim() : '';
  if (!isTrustedRepoUrl(downloadUrl)) return null;

  const rawPage = typeof data.pageUrl === 'string' ? data.pageUrl.trim() : '';
  const pageUrl = isTrustedRepoUrl(rawPage) ? rawPage : DEFAULT_PAGE_URL;

  const notes = typeof data.notes === 'string' ? data.notes.trim().slice(0, 240) : '';

  return { version, notes, downloadUrl, pageUrl };
}

export class UpdateChecker {
  constructor({ currentVersion, manifestUrl, timeout = 6000, pageUrl = DEFAULT_PAGE_URL } = {}) {
    this.currentVersion = currentVersion;
    this.manifestUrl = manifestUrl;
    this.timeout = timeout;
    this.defaultPageUrl = pageUrl;
    this.status = 'idle'; // idle | checking | uptodate | available | error
    this.latest = '';
    this.notes = '';
    this.downloadUrl = '';
    this.pageUrl = pageUrl;
    this.dismissed = this.readDismissed();
    this.lastChecked = 0;
  }

  readDismissed() {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      return typeof raw === 'string' ? raw.slice(0, 32) : '';
    } catch {
      return '';
    }
  }

  dismiss() {
    this.dismissed = this.latest || this.currentVersion;
    try {
      localStorage.setItem(DISMISS_KEY, this.dismissed);
    } catch {
      /* private mode: just hide it for this session */
    }
  }

  get available() {
    return this.status === 'available';
  }

  /** Should the title screen show the banner right now? */
  get shouldNotify() {
    return this.available && this.dismissed !== this.latest;
  }

  /** Never throws. Resolves with a small result object. */
  async check() {
    if (this.status === 'checking') return this.result();
    this.status = 'checking';
    const url = this.resolveUrl();
    let timer = 0;

    const fail = () => {
      this.status = 'error';
      this.latest = '';
      this.notes = '';
      this.downloadUrl = '';
      this.pageUrl = this.defaultPageUrl;
    };

    try {
      if (!url) throw new Error('no manifest url');
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      if (controller) timer = setTimeout(() => controller.abort(), this.timeout);

      // Default credentials mode keeps same-origin (self-hosted) manifests working;
      // cross-origin GitHub raw requests simply carry no cookies.
      const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`, {
        cache: 'no-store',
        signal: controller ? controller.signal : undefined
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.lastChecked = Date.now();

      const manifest = parseManifest(data, this.currentVersion);
      if (!manifest) {
        // Unsigned, malformed, downgrade or untrusted URL: stay silent.
        fail();
        return this.result();
      }

      this.latest = manifest.version;
      this.notes = manifest.notes;
      this.downloadUrl = manifest.downloadUrl;
      this.pageUrl = manifest.pageUrl;
      this.status = 'available';

      // A previously dismissed version stays dismissed; a newer one notifies again.
      if (this.dismissed && this.dismissed !== this.latest && isNewerVersion(this.latest, this.dismissed)) {
        this.dismissed = '';
      }
    } catch {
      // Offline, blocked, CORS, timeout, bad JSON — all non-fatal.
      fail();
    } finally {
      if (timer) clearTimeout(timer);
    }
    return this.result();
  }

  resolveUrl() {
    if (isDebugOverrideAllowed() && typeof window !== 'undefined' && window.__urbanStrayUpdateUrl) {
      return window.__urbanStrayUpdateUrl;
    }
    return this.manifestUrl;
  }

  result() {
    return {
      status: this.status,
      available: this.available,
      latest: this.latest,
      notes: this.notes,
      downloadUrl: this.downloadUrl,
      error: this.status === 'error'
    };
  }

  /** Open the download page outside the game (system browser on Android). */
  openDownload() {
    const url = this.downloadUrl || this.pageUrl;
    if (!url || !isTrustedRepoUrl(url)) return;
    try {
      const cap = typeof window !== 'undefined' ? window.Capacitor : null;
      const browser = cap?.Plugins?.Browser;
      if (browser?.open) {
        browser.open({ url });
        return;
      }
    } catch {
      /* fall through to the web behaviour */
    }
    try {
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win && window.location) window.location.href = url;
    } catch {
      /* give up silently — the URL is also shown in About */
    }
  }
}
