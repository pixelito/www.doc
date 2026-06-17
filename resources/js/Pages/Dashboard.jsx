import { usePage, router, Head } from '@inertiajs/react';
import { LogOut } from 'lucide-react';

export default function Dashboard() {
    const { auth } = usePage().props;

    function logout(e) {
        e.preventDefault();
        router.post('/logout');
    }

    return (
        <>
            <Head title="Dashboard" />
            <div className="min-h-screen bg-background">
                <header className="border-b border-border bg-card">
                    <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                        <span className="font-semibold text-foreground">www.doc</span>
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
                </header>

                <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                        Welcome, {auth.user.name}
                    </h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        User #{auth.user.id} &middot; {auth.user.email}
                    </p>

                    <div className="mt-8 rounded-md border border-dashed border-border bg-surface p-10 text-center">
                        <p className="text-sm text-text-tertiary">
                            Phase 0 complete — walking skeleton is up.
                        </p>
                    </div>
                </main>
            </div>
        </>
    );
}
