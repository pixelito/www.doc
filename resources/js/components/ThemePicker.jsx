import { useEffect, useState } from 'react';
import { IconSun, IconMoon, IconDeviceDesktop, IconPalette } from '@tabler/icons-react';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { THEMES, SYSTEM, getPreference, setPreference, onPreferenceChange } from '@/lib/theme';

// Options render from the theme registry so a future theme only needs its
// app.css block + a THEMES row (and an icon here if it wants a custom one).
const ICONS = { [SYSTEM]: IconDeviceDesktop, light: IconSun, dark: IconMoon };
const OPTIONS = [{ id: SYSTEM, label: 'System' }, ...THEMES];

function iconFor(id) {
    return ICONS[id] ?? IconPalette;
}

function useThemePreference() {
    const [pref, setPref] = useState(getPreference);
    useEffect(() => onPreferenceChange(setPref), []);
    return [pref, setPreference];
}

/** Compact icon button + menu for the app header. */
export function ThemeMenu() {
    const [pref, setPref] = useThemePreference();
    const Current = iconFor(pref);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    title="Theme"
                    aria-label="Theme"
                    className="flex h-8 w-8 items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                    <Current className="h-4 w-4" stroke={1.5} />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-32">
                <DropdownMenuRadioGroup value={pref} onValueChange={setPref}>
                    {OPTIONS.map((opt) => {
                        const Icon = iconFor(opt.id);
                        return (
                            <DropdownMenuRadioItem key={opt.id} value={opt.id}>
                                <span className="flex items-center gap-2">
                                    <Icon className="h-3.5 w-3.5 text-text-tertiary" stroke={1.5} aria-hidden="true" />
                                    {opt.label}
                                </span>
                            </DropdownMenuRadioItem>
                        );
                    })}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** Segmented control for the Settings/Profile page. */
export function ThemeSegments() {
    const [pref, setPref] = useThemePreference();

    return (
        <div className="flex flex-wrap gap-1.5">
            {OPTIONS.map((opt) => {
                const Icon = iconFor(opt.id);
                const selected = pref === opt.id;
                return (
                    <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPref(opt.id)}
                        aria-pressed={selected}
                        className={
                            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors ' +
                            (selected
                                ? 'border border-transparent bg-sage-100 font-medium text-sage-600'
                                : 'border border-border bg-surface text-text-secondary hover:bg-surface-hover')
                        }
                    >
                        <Icon className="h-3.5 w-3.5" stroke={1.5} aria-hidden="true" />
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}
