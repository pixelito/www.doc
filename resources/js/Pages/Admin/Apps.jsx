import { Head, router, usePage } from '@inertiajs/react';
import { IconBooks, IconTicket, IconApps } from '@tabler/icons-react';
import SettingsLayout from '@/Layouts/SettingsLayout';

const MODULE_ICONS = {
    books:  IconBooks,
    ticket: IconTicket,
};

function Switch({ checked, disabled, onChange }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                checked ? 'bg-sage-400' : 'bg-border'
            }`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-surface shadow-sm transition-transform ${
                    checked ? 'translate-x-4' : 'translate-x-0.5'
                }`}
            />
        </button>
    );
}

export default function Apps() {
    const { modules } = usePage().props;

    function toggle(module, enabled) {
        router.patch(`/admin/apps/${module.key}`, { enabled }, { preserveScroll: true });
    }

    return (
        <SettingsLayout>
            <Head title="Apps — Admin" />

            <div className="divide-y divide-border rounded-md border border-border bg-surface">
                {modules.map((module) => {
                    const Icon = MODULE_ICONS[module.icon] ?? IconApps;
                    const built = Boolean(module.home);

                    return (
                        <div key={module.key} className="flex items-center gap-3 px-4 py-3.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-canvas">
                                <Icon className="h-5 w-5 text-sage-600" stroke={1.5} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground">{module.name}</p>
                                <p className="mt-0.5 text-xs text-text-secondary">{module.description}</p>
                            </div>

                            {built ? (
                                <Switch
                                    checked={module.enabled}
                                    onChange={(value) => toggle(module, value)}
                                />
                            ) : (
                                <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
                                    Coming soon
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            <p className="mt-3 text-xs text-text-tertiary">
                Disabling an app hides it from the dashboard and nav and makes its pages
                unavailable. Its data is kept and returns when you re-enable it.
            </p>
        </SettingsLayout>
    );
}
