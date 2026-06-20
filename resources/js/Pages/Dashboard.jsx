import { Head, Link, usePage } from '@inertiajs/react';
import {
    IconBooks,
    IconTicket,
    IconLayoutGrid,
    IconSearch,
    IconSparkles,
    IconTag,
} from '@tabler/icons-react';
import AppLayout from '@/Layouts/AppLayout';

// String keys from config/modules.php mapped to icon components, so the backend
// registry stays framework-agnostic.
const MODULE_ICONS = {
    books:  IconBooks,
    ticket: IconTicket,
};
const NAV_ICONS = {
    'layout-grid': IconLayoutGrid,
    tag:           IconTag,
    search:        IconSearch,
};

function greeting(name) {
    const h = new Date().getHours();
    const salutation = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return `${salutation}, ${name}`;
}

function LiveAppTile({ module, stats }) {
    const Icon = MODULE_ICONS[module.icon] ?? IconSparkles;
    const quickLinks = module.quickLinks?.length ? module.quickLinks : (module.nav ?? []);

    return (
        <div className="relative overflow-hidden rounded-md border border-sage-200 bg-sage-50">
            {/* Status badge — top-right corner */}
            <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-sage-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sage-600">
                Active
            </span>

            <Link href={module.home ?? '#'} className="flex items-start gap-3 px-5 pb-4 pt-5 transition-colors hover:bg-sage-100">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-sage-200 bg-surface">
                    <Icon className="h-5 w-5 text-sage-600" stroke={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground">{module.name}</h3>
                    <p className="mt-0.5 pr-12 text-xs text-text-secondary">{module.description}</p>
                </div>
            </Link>

            {/* Stats bar — docs is the only module with stats today */}
            {module.key === 'docs' && stats && (
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
            )}

            {/* Quick links — sourced from the module's quickLinks entries */}
            {quickLinks.length > 0 && (
                <div className="flex items-center gap-1 border-t border-sage-200 px-3 py-1.5">
                    {quickLinks.map((link) => {
                        const LinkIcon = NAV_ICONS[link.icon];
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium text-sage-600 transition-colors hover:bg-sage-100"
                            >
                                {LinkIcon && <LinkIcon className="h-3.5 w-3.5" stroke={1.5} />}
                                {link.label}
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function ComingSoonTile({ module }) {
    const Icon = MODULE_ICONS[module.icon] ?? IconSparkles;
    // A module that's been built (has a home route) but switched off reads as
    // "Disabled"; one with no home yet is genuinely "Coming soon".
    const badge = module.home ? 'Disabled' : 'Coming soon';

    return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-canvas px-5 py-10 text-center">
            <Icon className="h-5 w-5 text-text-tertiary" stroke={1.5} />
            <p className="text-xs font-medium text-text-secondary">{module.name}</p>
            <p className="text-xs text-text-tertiary">{module.description || 'In development.'}</p>
            <span className="mt-1 rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
                {badge}
            </span>
        </div>
    );
}

export default function Dashboard({ stats }) {
    const { auth, modules } = usePage().props;

    const enabled  = (modules ?? []).filter((m) => m.enabled);
    const disabled = (modules ?? []).filter((m) => !m.enabled);

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
                    {enabled.map((module) => (
                        <LiveAppTile key={module.key} module={module} stats={stats?.[module.key]} />
                    ))}
                    {disabled.map((module) => (
                        <ComingSoonTile key={module.key} module={module} />
                    ))}
                </div>
            </section>
        </AppLayout>
    );
}
