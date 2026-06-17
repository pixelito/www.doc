import { Link, usePage, router } from '@inertiajs/react';
import { LogOut } from 'lucide-react';

function NavLink({ href, children }) {
    const { url } = usePage();
    const active = url.startsWith(href);

    return (
        <Link
            href={href}
            className={
                'rounded-md px-2.5 py-1.5 transition-colors duration-150 ' +
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
    const { auth } = usePage().props;

    function logout(e) {
        e.preventDefault();
        router.post('/logout');
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border bg-card">
                <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-6">
                        <Link href="/dashboard" className="font-semibold text-foreground">
                            www.doc
                        </Link>
                        <nav className="flex items-center gap-1 text-sm">
                            <NavLink href="/workspaces">Workspaces</NavLink>
                            <NavLink href="/tags">Tags</NavLink>
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        {auth?.user && (
                            <span className="text-sm text-text-secondary">{auth.user.name}</span>
                        )}
                        <form onSubmit={logout}>
                            <button
                                type="submit"
                                className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors duration-150 hover:text-foreground"
                            >
                                <LogOut className="h-4 w-4" strokeWidth={1.5} />
                                Sign out
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">{children}</main>
        </div>
    );
}
