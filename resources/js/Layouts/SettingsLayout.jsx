import { Link, usePage } from '@inertiajs/react';
import { IconUser, IconUsers, IconDatabaseExport, IconMail, IconHistory } from '@tabler/icons-react';
import DocsLayout from '@/Layouts/DocsLayout';

// Thin wrapper over the single base layout — adds the settings tabs. Flash
// banners are rendered by DocsLayout, so don't repeat them here.

// Settings tabs. Personal ones show for everyone; admin ones only for admins.
const TABS = [
    { label: 'Profile', href: '/settings/profile', icon: IconUser,           adminOnly: false },
    { label: 'Users',   href: '/admin/users',         icon: IconUsers,          adminOnly: true },
    { label: 'Email',   href: '/admin/settings/mail', icon: IconMail,           adminOnly: true },
    { label: 'Backups', href: '/admin/backups',       icon: IconDatabaseExport, adminOnly: true },
    { label: 'Audit',   href: '/admin/audit',         icon: IconHistory,        adminOnly: true },
];

export default function SettingsLayout({ children }) {
    const { url, props } = usePage();
    const isAdmin = props.auth?.user?.roles?.includes('admin');

    const tabs = TABS.filter((tab) => !tab.adminOnly || isAdmin);

    // "v1.2.0" from a release tag (with or without the leading v), "dev" as-is.
    const version = props.appVersion === 'dev' || !props.appVersion
        ? 'dev'
        : `v${String(props.appVersion).replace(/^v/, '')}`;

    return (
        <DocsLayout>
            <div className="mx-auto max-w-3xl">
                <h1 className="text-[19px] font-semibold text-foreground">Settings</h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Manage your account{isAdmin ? ' and this instance' : ''}.
                </p>

                {/* Section tabs (hidden when there's only one) */}
                {tabs.length > 1 && (
                    <div className="mt-5 flex items-center gap-1 border-b border-border">
                        {tabs.map((tab) => {
                            const active = url.startsWith(tab.href);
                            const Icon = tab.icon;
                            return (
                                <Link
                                    key={tab.href}
                                    href={tab.href}
                                    className={`-mb-px flex items-center gap-1.5 border-b-[1.5px] px-3 py-2 text-sm font-medium transition-colors ${
                                        active
                                            ? 'border-sage-400 text-sage-600'
                                            : 'border-transparent text-text-secondary hover:text-foreground'
                                    }`}
                                >
                                    <Icon className="h-4 w-4" stroke={1.5} />
                                    {tab.label}
                                </Link>
                            );
                        })}
                    </div>
                )}

                <div className="mt-6 space-y-5">{children}</div>

                {/* Which release this instance runs — meta caption per the styleguide. */}
                <p className="mt-8 text-center text-[11px] text-text-tertiary">
                    www.doc {version}
                </p>
            </div>
        </DocsLayout>
    );
}
