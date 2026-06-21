import { Link, usePage } from '@inertiajs/react';
import { IconUser, IconApps, IconUsers } from '@tabler/icons-react';
import AppLayout from '@/Layouts/AppLayout';

// Flash banners are rendered once, by the shell (AppLayout) — don't repeat them here.

// Settings tabs. Personal ones show for everyone; admin ones only for admins.
// Adding a section later (e.g. a General admin tab) is one entry here + its page.
const TABS = [
    { label: 'Profile', href: '/settings/profile', icon: IconUser,  adminOnly: false },
    { label: 'Apps',    href: '/admin/apps',       icon: IconApps,  adminOnly: true },
    { label: 'Users',   href: '/admin/users',      icon: IconUsers, adminOnly: true },
];

export default function SettingsLayout({ children }) {
    const { url, props } = usePage();
    const isAdmin = props.auth?.user?.roles?.includes('admin');

    const tabs = TABS.filter((tab) => !tab.adminOnly || isAdmin);

    return (
        <AppLayout>
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
            </div>
        </AppLayout>
    );
}
