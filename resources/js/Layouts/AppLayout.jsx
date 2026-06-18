import { Link, usePage, router } from '@inertiajs/react';
import { IconBook2, IconSettings, IconLogout } from '@tabler/icons-react';

function initials(name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function AppLayout({ children }) {
    const { auth, flash } = usePage().props;

    function logout(e) {
        e.preventDefault();
        router.post('/logout');
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border bg-card">
                <div className="mx-auto max-w-7xl flex h-12 items-center px-5">
                    {/* Brand */}
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <IconBook2 className="h-5 w-5 text-sage-600" stroke={1.5} />
                        <span className="text-[15px] font-semibold text-foreground">
                            <span className="font-normal">www.</span><span className="font-extrabold">doc</span>
                        </span>
                    </Link>

                    {/* Actions */}
                    {auth?.user && (
                        <div className="ml-auto flex shrink-0 items-center gap-1">
                            <div
                                title={auth.user.name}
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-sage-100 text-[11px] font-semibold text-sage-600"
                            >
                                {initials(auth.user.name)}
                            </div>
                            <button
                                type="button"
                                title="Settings"
                                className="flex h-8 w-8 items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
                            >
                                <IconSettings className="h-4 w-4" stroke={1.5} />
                            </button>
                            <button
                                type="button"
                                onClick={logout}
                                title="Sign out"
                                className="flex h-8 w-8 items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
                            >
                                <IconLogout className="h-4 w-4" stroke={1.5} />
                            </button>
                        </div>
                    )}
                </div>
            </header>
            {flash?.success && (
                <div className="border-b border-sage-200 bg-sage-50 px-5 py-2.5 text-sm text-sage-700">
                    {flash.success}
                </div>
            )}
            <main className="mx-auto max-w-7xl px-5 py-6">{children}</main>
        </div>
    );
}
