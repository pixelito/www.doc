import { Head, Link, usePage } from '@inertiajs/react';
import {
    IconBooks,
    IconLayoutGrid,
    IconSearch,
    IconSparkles,
    IconTag,
} from '@tabler/icons-react';
import AppLayout from '@/Layouts/AppLayout';

function greeting(name) {
    const h = new Date().getHours();
    const salutation = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return `${salutation}, ${name}`;
}

export default function Dashboard({ stats }) {
    const { auth } = usePage().props;

    return (
        <AppLayout>
            <Head title="Dashboard" />

            {/* ── Greeting ──────────────────────────────────────────────── */}
            <div className="mb-8 border-b border-border pb-6">
                <h1 className="text-2xl font-semibold text-foreground">
                    {greeting(auth.user.name)}
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Your internal platform — one place for all your tools.
                </p>
            </div>

            {/* ── Apps ──────────────────────────────────────────────────── */}
            <section>
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                    Apps
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

                    {/* Docs — live app tile */}
                    <div className="overflow-hidden rounded-md border border-sage-200 bg-sage-50">
                        <Link href="/workspaces" className="flex items-start gap-3 px-5 pb-4 pt-5 transition-colors hover:bg-sage-100">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-sage-200 bg-surface">
                                <IconBooks className="h-5 w-5 text-sage-600" stroke={1.5} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-foreground">Docs</h3>
                                    <span className="rounded-full bg-sage-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sage-600">
                                        Live
                                    </span>
                                </div>
                                <p className="mt-0.5 text-xs text-text-secondary">
                                    Internal knowledge base and documentation hub.
                                </p>
                            </div>
                        </Link>

                        {/* Stats bar */}
                        <div className="flex items-center gap-4 border-t border-sage-200 px-5 py-2.5 text-xs text-text-secondary">
                            <span>
                                <span className="font-semibold text-foreground">{stats.workspaces}</span>{' '}
                                workspace{stats.workspaces !== 1 ? 's' : ''}
                            </span>
                            <span>
                                <span className="font-semibold text-foreground">{stats.documents}</span>{' '}
                                page{stats.documents !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {/* Quick links */}
                        <div className="flex items-center gap-1 border-t border-sage-200 px-3 py-1.5">
                            <Link
                                href="/workspaces"
                                className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium text-sage-600 transition-colors hover:bg-sage-100"
                            >
                                <IconLayoutGrid className="h-3.5 w-3.5" stroke={1.5} />
                                Workspaces
                            </Link>
                            <Link
                                href="/tags"
                                className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium text-sage-600 transition-colors hover:bg-sage-100"
                            >
                                <IconTag className="h-3.5 w-3.5" stroke={1.5} />
                                Tags
                            </Link>
                            <Link
                                href="/search"
                                className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium text-sage-600 transition-colors hover:bg-sage-100"
                            >
                                <IconSearch className="h-3.5 w-3.5" stroke={1.5} />
                                Search
                            </Link>
                        </div>
                    </div>

                    {/* Coming-soon placeholder tiles */}
                    {[0, 1].map((i) => (
                        <div
                            key={i}
                            className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-canvas px-5 py-10 text-center"
                        >
                            <IconSparkles className="h-5 w-5 text-text-tertiary" stroke={1.5} />
                            <p className="text-xs font-medium text-text-secondary">Coming soon</p>
                            <p className="text-xs text-text-tertiary">More tools in development.</p>
                        </div>
                    ))}
                </div>
            </section>
        </AppLayout>
    );
}
