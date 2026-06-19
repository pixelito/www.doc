import DocsLayout from '@/Layouts/DocsLayout';

export default function SettingsLayout({ children }) {
    return (
        <DocsLayout>
            <div className="mx-auto max-w-2xl">
                <h1 className="text-[19px] font-semibold text-foreground">Settings</h1>
                <div className="mt-6 space-y-5">
                    {children}
                </div>
            </div>
        </DocsLayout>
    );
}
