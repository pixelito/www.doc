// Theme runtime — two independent axes, both stamped on <html>:
//   data-theme  = scheme (light/dark). The stored PREFERENCE is a theme id or
//                 'system' (resolved here against prefers-color-scheme — the
//                 CSS deliberately has no media query, so JS is the single
//                 theming mechanism).
//   data-accent = accent hue. Always an explicit pick (default sage); 'system'
//                 applies to the scheme only, never the accent.
// The CSS in app.css defines both as [data-*] token override blocks. A tiny
// inline copy of this resolution runs pre-paint in app.blade.php; keep the
// storage keys, id lists, and fallbacks in sync with it.

// Scheme registry. Adding a scheme = one CSS override block in app.css
// (values designed in the sage-design skill first) + one row here.
export const THEMES = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
];

// Accent registry. Adding a hue = light+dark override blocks in app.css
// (designed & contrast-validated in the sage-design skill first) + one row
// here. `swatch` is the hue's light accent-400, for picker dots.
export const ACCENTS = [
    { id: 'sage', label: 'Sage', swatch: '#7E9D72' },
    { id: 'pink', label: 'Pink', swatch: '#B4809D' },
    { id: 'blue', label: 'Blue', swatch: '#7793C5' },
    { id: 'rose', label: 'Rose', swatch: '#CA7683' },
    { id: 'ochre', label: 'Ochre', swatch: '#A69150' },
];

export const SYSTEM = 'system';
const STORAGE_KEY = 'wwwdoc:theme';
const ACCENT_STORAGE_KEY = 'wwwdoc:accent';
const DEFAULT_THEME = 'light';
const DEFAULT_ACCENT = 'sage';

const listeners = new Set();
const accentListeners = new Set();

function systemTheme() {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function read(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null; // Storage unavailable (privacy mode) — fall through to defaults.
    }
}

function write(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Not persistable — still apply for this page's lifetime.
    }
}

export function getPreference() {
    const stored = read(STORAGE_KEY);
    if (stored === SYSTEM || THEMES.some((t) => t.id === stored)) return stored;
    return SYSTEM;
}

export function resolveTheme(preference = getPreference()) {
    if (preference === SYSTEM) return systemTheme();
    return THEMES.some((t) => t.id === preference) ? preference : DEFAULT_THEME;
}

function normalizeAccent(accent) {
    return ACCENTS.some((a) => a.id === accent) ? accent : DEFAULT_ACCENT;
}

export function getAccent() {
    return normalizeAccent(read(ACCENT_STORAGE_KEY));
}

function apply() {
    document.documentElement.setAttribute('data-theme', resolveTheme());
    document.documentElement.setAttribute('data-accent', getAccent());
}

// The setters stamp from their ARGUMENT, not a storage re-read: when
// localStorage is unavailable (privacy mode) the write is lost but the pick
// must still apply for this page's lifetime.
export function setPreference(preference) {
    write(STORAGE_KEY, preference);
    document.documentElement.setAttribute('data-theme', resolveTheme(preference));
    listeners.forEach((fn) => fn(preference));
}

export function setAccent(accent) {
    const id = normalizeAccent(accent);
    write(ACCENT_STORAGE_KEY, id);
    document.documentElement.setAttribute('data-accent', id);
    accentListeners.forEach((fn) => fn(id));
}

/** Subscribe to scheme-preference changes (returns an unsubscribe fn). */
export function onPreferenceChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Subscribe to accent changes (returns an unsubscribe fn). */
export function onAccentChange(fn) {
    accentListeners.add(fn);
    return () => accentListeners.delete(fn);
}

/**
 * Called once at app boot: re-asserts the pre-paint script's decision (no-op
 * visually) and follows OS scheme changes while the preference is 'system'.
 */
export function initTheme() {
    apply();
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
        if (getPreference() === SYSTEM) apply();
    });
}
