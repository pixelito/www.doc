import { Link, usePage } from '@inertiajs/react';
import { IconApps, IconUsers } from '@tabler/icons-react';
import AppLayout from '@/Layouts/AppLayout';

// Admin sections. Adding a platform-wide options group later (e.g. General) is
// one entry here plus its page — the nav and routing follow automatically.
const SECTIONS = [
    { label: 'Apps',  href: '/admin/apps',  icon: IconApps },
    { label: 'Users', href: '/admin/users', icon: IconUsers },
];

export default function AdminLayout({ children }) {
    const { url, props } = usePage();
    const flash = props.flash ?? {};

    return (
        <AppLayout>
            <div className="mx-auto max-w-3xl">
                <h1 className="text-[19px] font-semibold text-foreground">Administration</h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Manage apps, users and platform-wide settings for this instance.
                </p>

                {/* Section tabs */}
                <div className="mt-5 flex items-center gap-1 border-b border-border">
                    {SECTIONS.map((section) => {
                        const active = url.startsWith(section.href);
                        const Icon = section.icon;
                        return (
                            <Link
                                key={section.href}
                                href={section.href}
                                className={`-mb-px flex items-center gap-1.5 border-b-[1.5px] px-3 py-2 text-sm font-medium transition-colors ${
                                    active
                                        ? 'border-sage-400 text-sage-600'
                                        : 'border-transparent text-text-secondary hover:text-foreground'
                                }`}
                            >
                                <Icon className="h-4 w-4" stroke={1.5} />
                                {section.label}
                            </Link>
                        );
                    })}
                </div>

                {/* Flash */}
                {flash.success && (
                    <div className="mt-5 rounded-sm border border-sage-200 bg-sage-50 px-4 py-2.5 text-sm text-sage-700">
                        {flash.success}
                    </div>
                )}
                {flash.error && (
                    <div className="mt-5 rounded-sm border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm text-danger">
                        {flash.error}
                    </div>
                )}

                <div className="mt-6">{children}</div>
            </div>
        </AppLayout>
    );
}
