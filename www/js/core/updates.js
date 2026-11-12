/**
 * Silent, offline-safe update check.
 *
 * Fetches a small JSON manifest (version.json on the repository) and compares it
 * with the running build. Any network/CORS/parse failure is swallowed: the game
 * keeps playing exactly as before, and the banner simply never appears.
 *
 * Manifest shape:
 *   {
 *     "version": "1.1.0",
 *     "versionCode": 2,
 *     "notes": "what changed",
 *     "downloadUrl": "https://…/urban-stray-v1.1.0.apk",
 *     "pageUrl": "https://github.com/<owner>/<repo>/releases"
 *   }
 */
const DISMISS_KEY = 'urban-stray-update-dismissed';

export function parseVersion(value) {
  const parts = String(value || '').replace(/^v/i, '').split('.');
  const nums = [];
  for (let i = 0; i < 3; i++) {
    const n = parseInt(parts[i], 10);
    nums.push(Number.isFinite(n) ? n : 0);
  }
  return nums;
}

/** Returns true when `candidate` is a newer semantic version than `current`. */
export function isNewerVersion(candidate, current) {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

export class UpdateChecker {
  constructor({ currentVersion, manifestUrl, timeout = 6000 } = {}) {
    this.currentVersion = currentVersion;
    this.manifestUrl = manifestUrl;
    this.timeout = timeout;
    this.status = 'idle'; // idle | checking | uptodate | available | error
    this.latest = '';
    this.notes = '';
    this.downloadUrl = '';
    this.pageUrl = '';
    this.dismissed = this.readDismissed();
    this.lastChecked = 0;
  }

  readDismissed() {
    try {
      return localStorage.getItem(DISMISS_KEY) || '';
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
    try {
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

      this.latest = String(data.version || '');
      this.notes = String(data.notes || '');
      this.downloadUrl = String(data.downloadUrl || data.pageUrl || '');
      this.pageUrl = String(data.pageUrl || data.downloadUrl || '');

      if (this.latest && isNewerVersion(this.latest, this.currentVersion)) {
        this.status = 'available';
        // A previously dismissed version stays dismissed; a newer one notifies again.
        if (this.dismissed && this.dismissed !== this.latest && isNewerVersion(this.latest, this.dismissed)) {
          this.dismissed = '';
        }
      } else {
        this.status = 'uptodate';
      }
    } catch {
      // Offline, blocked, CORS, timeout, bad JSON — all non-fatal.
      this.status = 'error';
    } finally {
      if (timer) clearTimeout(timer);
    }
    return this.result();
  }

  resolveUrl() {
    // Allows a local/hosted override for testing and self-hosting.
    if (typeof window !== 'undefined' && window.__urbanStrayUpdateUrl) {
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
    if (!url) return;
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
