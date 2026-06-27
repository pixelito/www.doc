// European date formatting (dd.mm.yyyy). One place so every page agrees and the
// separator/leading-zeros stay consistent regardless of the browser locale.

function toDate(value) {
    const d = value instanceof Date ? value : new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

/** "dd.mm.yyyy" — e.g. 27.06.2026. Returns '' for empty/invalid input. */
export function formatDate(value) {
    const d = toDate(value);
    if (!d) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${d.getFullYear()}`;
}

/** "dd.mm.yyyy, HH:mm" — 24-hour clock. */
export function formatDateTime(value) {
    const d = toDate(value);
    if (!d) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${formatDate(d)}, ${hh}:${min}`;
}
