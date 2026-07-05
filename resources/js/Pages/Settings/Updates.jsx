import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import SettingsLayout from '@/Layouts/SettingsLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { IconExternalLink, IconRefresh, IconLoader2 } from '@tabler/icons-react';

// "dev" stays as-is; a real tag renders as "v1.4.0" (with or without a leading v).
const showVer = (v) => (!v || v === 'dev' ? 'dev' : `v${String(v).replace(/^v/i, '')}`);

const fmtDate = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
};

function Row({ label, children }) {
    return (
        <div className="flex items-center justify-between gap-4 border-t border-border py-2 text-sm first:border-t-0">
            <span className="text-text-secondary">{label}</span>
            <span className="text-right font-medium text-foreground">{children}</span>
        </div>
    );
}

export default function Updates({ status, notesHtml, releasesUrl, system }) {
    const [enabled, setEnabled] = useState(status.enabled);
    const [checking, setChecking] = useState(false);

    const toggle = (next) => {
        setEnabled(next); // optimistic; the page reloads its props on the redirect
        router.patch('/admin/settings/updates', { enabled: next }, { preserveScroll: true });
    };

    const checkNow = () => {
        setChecking(true);
        router.post('/admin/settings/updates/check', {}, {
            preserveScroll: true,
            onFinish: () => setChecking(false),
        });
    };

    return (
        <SettingsLayout>
            <Head title="Updates" />
            <div className="space-y-5">
                {/* Opt-in release check + its status */}
                <Card>
                    <CardHeader>
                        <CardTitle>Update checks</CardTitle>
                        <CardDescription>
                            Notify admins when this instance is behind the latest release.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-foreground">Check for new releases</p>
                                <p className="mt-0.5 text-xs text-text-secondary">
                                    Reads public release information from GitHub on a daily schedule.
                                    Sends nothing about this instance; off by default.
                                </p>
                            </div>
                            <Switch checked={enabled} onCheckedChange={toggle} className="mt-0.5" />
                        </div>

                        {status.is_dev ? (
                            <p className="rounded-md bg-surface-hover px-3 py-2 text-xs text-text-secondary">
                                This is a development build — checks run only on tagged releases.
                            </p>
                        ) : enabled && (
                            <div className="rounded-md border border-border px-3 py-1">
                                <Row label="Installed">{showVer(status.current)}</Row>
                                <Row label="Latest">
                                    <span className="inline-flex items-center gap-2">
                                        {status.latest ? showVer(status.latest) : '—'}
                                        {status.update_available && (
                                            <span className="rounded-full bg-sage-100 px-2 py-0.5 text-xs font-medium text-sage-700">
                                                Update available
                                            </span>
                                        )}
                                    </span>
                                </Row>
                                <Row label="Last checked">{fmtDate(status.checked_at) ?? 'Never'}</Row>
                                <div className="flex justify-end py-2">
                                    <Button variant="outline" size="sm" onClick={checkNow} disabled={checking}>
                                        {checking
                                            ? <IconLoader2 className="h-4 w-4 animate-spin" stroke={1.5} />
                                            : <IconRefresh className="h-4 w-4" stroke={1.5} />}
                                        Check now
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Latest release notes (cached from GitHub) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Latest release</CardTitle>
                        <CardDescription>Release notes for the newest published version.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {notesHtml ? (
                            <>
                                <div className="flex items-baseline justify-between gap-4">
                                    <h3 className="text-sm font-semibold text-foreground">
                                        {status.latest_name || showVer(status.latest)}
                                    </h3>
                                    {fmtDate(status.published_at) && (
                                        <span className="shrink-0 text-xs text-text-tertiary">
                                            {fmtDate(status.published_at)}
                                        </span>
                                    )}
                                </div>
                                <div
                                    className="release-notes mt-3"
                                    dangerouslySetInnerHTML={{ __html: notesHtml }}
                                />
                                {status.latest_url && (
                                    <a
                                        href={status.latest_url}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="mt-4 inline-flex items-center gap-1.5 text-sm text-sage-600 hover:underline"
                                    >
                                        View on GitHub <IconExternalLink className="h-4 w-4" stroke={1.5} />
                                    </a>
                                )}
                            </>
                        ) : (
                            <p className="text-sm text-text-secondary">
                                {status.is_dev
                                    ? 'Release notes appear on tagged builds once a check has run.'
                                    : enabled
                                        ? 'No release notes cached yet — run a check, or the instance may be offline.'
                                        : 'Enable update checks to fetch the latest release notes.'}{' '}
                                <a
                                    href={releasesUrl}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="inline-flex items-center gap-1 text-sage-600 hover:underline"
                                >
                                    View all releases <IconExternalLink className="h-3.5 w-3.5" stroke={1.5} />
                                </a>
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* System info */}
                <Card>
                    <CardHeader>
                        <CardTitle>System</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 py-1">
                        <Row label="Instance">{system.instance}</Row>
                        <Row label="App version">{showVer(system.app_version)}</Row>
                        <Row label="PHP">{system.php}</Row>
                        <Row label="Laravel">{system.laravel}</Row>
                    </CardContent>
                </Card>
            </div>
        </SettingsLayout>
    );
}
