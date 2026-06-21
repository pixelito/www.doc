import { Link, usePage, router } from '@inertiajs/react';
import { IconSettings, IconLogout, IconShieldLock } from '@tabler/icons-react';
import { avatarStyle, initials } from '@/lib/avatar';

export default function AppLayout({ children }) {
    const { auth, flash } = usePage().props;
    const isAdmin = auth?.user?.roles?.includes('admin');

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
                        <img src="/favicon.svg" className="h-5 w-5" alt="" />
                        <span className="text-[15px] font-semibold text-foreground">
                            <span className="font-normal">www.</span><span className="font-extrabold">doc</span>
                        </span>
                    </Link>

                    {/* Actions */}
                    {auth?.user && (
                        <div className="ml-auto flex shrink-0 items-center gap-1">
                            <div
                                title={auth.user.name}
                                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold"
                                style={avatarStyle(auth.user.avatar_color)}
                            >
                                {initials(auth.user.name)}
                            </div>
                            {isAdmin && (
                                <Link
                                    href="/admin/apps"
                                    title="Administration"
                                    className="flex h-8 w-8 items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
                                >
                                    <IconShieldLock className="h-4 w-4" stroke={1.5} />
                                </Link>
                            )}
                            <Link
                                href="/settings/profile"
                                title="Settings"
                                className="flex h-8 w-8 items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
                            >
                                <IconSettings className="h-4 w-4" stroke={1.5} />
                            </Link>
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
