import { useState } from 'react';
import { Link, usePage, router } from '@inertiajs/react';
import { IconBook2, IconSearch, IconSettings, IconLogout } from '@tabler/icons-react';

function initials(name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function NavLink({ href, children }) {
    const { url } = usePage();
    const active = url.startsWith(href);

    return (
        <Link
            href={href}
            className={
                'rounded-sm px-2.5 py-1.5 text-sm transition-colors duration-150 ' +
                (active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-foreground')
            }
        >
            {children}
        </Link>
    );
}

export default function AppLayout({ children }) {
    const { auth, flash } = usePage().props;
    const [searchQ, setSearchQ] = useState('');

    function logout(e) {
        e.preventDefault();
        router.post('/logout');
    }

    function handleSearch(e) {
        e.preventDefault();
        if (searchQ.trim()) {
            router.get('/search', { q: searchQ.trim() });
        }
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border bg-card">
                <div className="mx-auto max-w-7xl flex h-12 items-center gap-4 px-5">
                    {/* Brand + nav */}
                    <div className="flex shrink-0 items-center gap-5">
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <IconBook2 className="h-5 w-5 text-sage-600" stroke={1.5} />
                            <span className="text-[15px] font-semibold text-foreground"><span className="font-normal">www.</span><span className="font-extrabold">doc</span></span>
                        </Link>
                        <nav className="hidden items-center gap-0.5 sm:flex">
                            <NavLink href="/workspaces">Workspaces</NavLink>
                            <NavLink href="/tags">Tags</NavLink>
                        </nav>
                    </div>

                    {/* Search */}
                    <form onSubmit={handleSearch} className="relative flex-1 max-w-xs">
                        <IconSearch
                            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary"
                            stroke={1.5}
                        />
                        <input
                            type="text"
                            value={searchQ}
                            onChange={(e) => setSearchQ(e.target.value)}
                            placeholder="Search docs…"
                            className="h-8 w-full rounded-sm border border-border bg-canvas pl-8 pr-3 text-sm text-foreground placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus:border-sage-400 focus:ring-[3px] focus:ring-sage-200"
                        />
                    </form>

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
