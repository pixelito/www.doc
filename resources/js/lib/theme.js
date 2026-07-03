// Theme runtime. The CSS in app.css defines themes as [data-theme] token
// override blocks; this module owns which one is stamped on <html>. The
// stored PREFERENCE is either a theme id or 'system' (resolved here against
// prefers-color-scheme — the CSS deliberately has no media query, so JS is
// the single theming mechanism). A tiny inline copy of this resolution runs
// pre-paint in app.blade.php; keep the storage key and fallback in sync.

// Registry of installed themes. Adding a theme = one CSS override block in
// app.css (values designed in the sage-design skill first) + one row here.
// 'system' is NOT a theme: it resolves between light and dark only; any
// additional theme is always an explicit pick.
export const THEMES = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
];

export const SYSTEM = 'system';
const STORAGE_KEY = 'wwwdoc:theme';
const DEFAULT_THEME = 'light';

const listeners = new Set();

function systemTheme() {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getPreference() {
    let stored = null;
    try {
        stored = localStorage.getItem(STORAGE_KEY);
    } catch {
        // Storage unavailable (privacy mode) — fall through to system.
    }
    if (stored === SYSTEM || THEMES.some((t) => t.id === stored)) return stored;
    return SYSTEM;
}

export function resolveTheme(preference = getPreference()) {
    if (preference === SYSTEM) return systemTheme();
    return THEMES.some((t) => t.id === preference) ? preference : DEFAULT_THEME;
}

function apply(preference) {
    document.documentElement.setAttribute('data-theme', resolveTheme(preference));
}

export function setPreference(preference) {
    try {
        localStorage.setItem(STORAGE_KEY, preference);
    } catch {
        // Not persistable — still apply for this page's lifetime.
    }
    apply(preference);
    listeners.forEach((fn) => fn(preference));
}

/** Subscribe to preference changes (returns an unsubscribe fn). */
export function onPreferenceChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/**
 * Called once at app boot: re-asserts the pre-paint script's decision (no-op
 * visually) and follows OS scheme changes while the preference is 'system'.
 */
export function initTheme() {
    apply(getPreference());
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
        if (getPreference() === SYSTEM) apply(SYSTEM);
    });
}
