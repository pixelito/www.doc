import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { IconCheck, IconLoader2, IconEye, IconEyeOff } from '@tabler/icons-react';
import SettingsLayout from '@/Layouts/SettingsLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AVATAR_COLORS, avatarStyle, initials } from '@/lib/avatar';

function PasswordInput({ value, onChange, placeholder, id }) {
    const [show, setShow] = useState(false);
    return (
        <div className="relative">
            <Input
                id={id}
                type={show ? 'text' : 'password'}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="pr-9"
            />
            <button
                type="button"
                tabIndex={-1}
                onClick={() => setShow(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
            >
                {show
                    ? <IconEyeOff className="h-4 w-4" stroke={1.5} />
                    : <IconEye className="h-4 w-4" stroke={1.5} />
                }
            </button>
        </div>
    );
}

function SaveButton({ saving, success, label = 'Save changes' }) {
    return (
        <Button type="submit" disabled={saving}>
            {saving
                ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.5} />
                : success
                ? <IconCheck className="h-3.5 w-3.5" stroke={2} />
                : null
            }
            {saving ? 'Saving…' : success ? 'Saved' : label}
        </Button>
    );
}

function FieldError({ error }) {
    if (!error) return null;
    return <p className="mt-1 text-xs text-danger">{error}</p>;
}

export default function ProfilePage({ user }) {
    const { flash } = usePage().props;

    // ── Profile form ──────────────────────────────────────────────────────────
    const [name,        setName]        = useState(user.name);
    const [email,       setEmail]       = useState(user.email);
    const [avatarColor, setAvatarColor] = useState(user.avatar_color ?? 'sage');
    const [profSaving,  setProfSaving]  = useState(false);
    const [profSuccess, setProfSuccess] = useState(!!flash?.profile_success);
    const [profErrors,  setProfErrors]  = useState({});

    function saveProfile(e) {
        e.preventDefault();
        setProfSaving(true);
        setProfErrors({});
        router.patch('/settings/profile', { name, email }, {
            preserveScroll: true,
            onSuccess: () => { setProfSuccess(true); setTimeout(() => setProfSuccess(false), 3000); },
            onError:   (errs) => setProfErrors(errs),
            onFinish:  () => setProfSaving(false),
        });
    }

    // ── Avatar colour (autosaves on pick) ──────────────────────────────────────
    const [colorSaving, setColorSaving] = useState(false);
    const [colorSaved,  setColorSaved]  = useState(false);

    function pickColor(key) {
        if (key === avatarColor || colorSaving) return;
        const previous = avatarColor;
        setAvatarColor(key); // optimistic
        setColorSaving(true);
        // Send the persisted name/email so the request validates without pulling
        // in any unsaved edits to those fields — only the colour is committed.
        router.patch('/settings/profile', { name: user.name, email: user.email, avatar_color: key }, {
            preserveScroll: true,
            onSuccess: () => { setColorSaved(true); setTimeout(() => setColorSaved(false), 2000); },
            onError:   () => setAvatarColor(previous),
            onFinish:  () => setColorSaving(false),
        });
    }

    // ── Password form ─────────────────────────────────────────────────────────
    const [currentPw,  setCurrentPw]  = useState('');
    const [newPw,      setNewPw]      = useState('');
    const [confirmPw,  setConfirmPw]  = useState('');
    const [pwSaving,   setPwSaving]   = useState(false);
    const [pwSuccess,  setPwSuccess]  = useState(!!flash?.password_success);
    const [pwErrors,   setPwErrors]   = useState({});

    function savePassword(e) {
        e.preventDefault();
        setPwSaving(true);
        setPwErrors({});
        router.patch('/settings/password', {
            current_password:      currentPw,
            password:              newPw,
            password_confirmation: confirmPw,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setPwSuccess(true);
                setCurrentPw(''); setNewPw(''); setConfirmPw('');
                setTimeout(() => setPwSuccess(false), 3000);
            },
            onError:  (errs) => setPwErrors(errs),
            onFinish: () => setPwSaving(false),
        });
    }

    return (
        <SettingsLayout>
            <Head title="Profile — Settings" />

            {/* ── Avatar ───────────────────────────────────────────────────── */}
            <section className="rounded-md border border-border bg-card">
                <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
                    <div>
                        <h2 className="text-[15px] font-semibold text-foreground">Avatar</h2>
                        <p className="mt-0.5 text-xs text-text-tertiary">Pick an accent colour — it saves automatically.</p>
                    </div>
                    {colorSaved && (
                        <span className="flex items-center gap-1 text-xs text-sage-600">
                            <IconCheck className="h-3.5 w-3.5" stroke={2} /> Saved
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-6 px-5 py-5">
                    <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
                        style={avatarStyle(avatarColor)}
                    >
                        {initials(name || user.name)}
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                        {Object.entries(AVATAR_COLORS).map(([key, val]) => (
                            <button
                                key={key}
                                type="button"
                                title={val.label}
                                disabled={colorSaving}
                                onClick={() => pickColor(key)}
                                className="h-7 w-7 rounded-full transition-transform hover:scale-110 focus:outline-none disabled:cursor-not-allowed"
                                style={{
                                    backgroundColor: val.bg,
                                    boxShadow: avatarColor === key
                                        ? `0 0 0 2px white, 0 0 0 4px ${val.text}`
                                        : 'none',
                                }}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Profile information ───────────────────────────────────────── */}
            <section className="rounded-md border border-border bg-card">
                <div className="border-b border-border-subtle px-5 py-4">
                    <h2 className="text-[15px] font-semibold text-foreground">Profile information</h2>
                    <p className="mt-0.5 text-xs text-text-tertiary">Update your name and email address.</p>
                </div>
                <form onSubmit={saveProfile}>
                    <div className="space-y-4 px-5 py-5">
                        <div>
                            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
                                Name
                            </label>
                            <Input
                                id="name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Your name"
                            />
                            <FieldError error={profErrors.name} />
                        </div>
                        <div>
                            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
                                Email
                            </label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="you@example.com"
                            />
                            <FieldError error={profErrors.email} />
                        </div>
                    </div>
                    <div className="flex items-center justify-end rounded-b-md border-t border-border-subtle bg-canvas px-5 py-3.5">
                        <SaveButton saving={profSaving} success={profSuccess} />
                    </div>
                </form>
            </section>

            {/* ── Change password ───────────────────────────────────────────── */}
            <section className="rounded-md border border-border bg-card">
                <div className="border-b border-border-subtle px-5 py-4">
                    <h2 className="text-[15px] font-semibold text-foreground">Change password</h2>
                    <p className="mt-0.5 text-xs text-text-tertiary">Use a strong password of at least 8 characters.</p>
                </div>
                <form onSubmit={savePassword}>
                    <div className="space-y-4 px-5 py-5">
                        <div>
                            <label htmlFor="current_password" className="mb-1.5 block text-sm font-medium text-foreground">
                                Current password
                            </label>
                            <PasswordInput
                                id="current_password"
                                value={currentPw}
                                onChange={e => setCurrentPw(e.target.value)}
                                placeholder="Enter current password"
                            />
                            <FieldError error={pwErrors.current_password} />
                        </div>
                        <div>
                            <label htmlFor="new_password" className="mb-1.5 block text-sm font-medium text-foreground">
                                New password
                            </label>
                            <PasswordInput
                                id="new_password"
                                value={newPw}
                                onChange={e => setNewPw(e.target.value)}
                                placeholder="At least 8 characters"
                            />
                            <FieldError error={pwErrors.password} />
                        </div>
                        <div>
                            <label htmlFor="confirm_password" className="mb-1.5 block text-sm font-medium text-foreground">
                                Confirm new password
                            </label>
                            <PasswordInput
                                id="confirm_password"
                                value={confirmPw}
                                onChange={e => setConfirmPw(e.target.value)}
                                placeholder="Repeat new password"
                            />
                            <FieldError error={pwErrors.password_confirmation} />
                        </div>
                    </div>
                    <div className="flex items-center justify-end rounded-b-md border-t border-border-subtle bg-canvas px-5 py-3.5">
                        <SaveButton saving={pwSaving} success={pwSuccess} label="Update password" />
                    </div>
                </form>
            </section>
        </SettingsLayout>
    );
}
