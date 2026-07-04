import { useCallback, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { IconChevronRight, IconDeviceFloppy } from '@tabler/icons-react';
import DocsLayout from '@/Layouts/DocsLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import TipTapEditor from '@/components/editor/TipTapEditor';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';

/**
 * Edit a page template: name, description and TipTap content. Always in edit
 * mode — a template has no read view, versions or optimistic locking; it's
 * just reusable starting content.
 */
export default function TemplatesEdit({ template }) {
    const [name, setName] = useState(template.name);
    const [description, setDescription] = useState(template.description ?? '');
    const [saving, setSaving] = useState(false);

    // The editor owns content between saves; a ref avoids re-rendering the
    // whole page on every keystroke (same pattern as the document editor).
    const contentRef = useRef(template.content);
    const dirtyRef = useRef(false);

    const handleEditorUpdate = useCallback((json) => {
        contentRef.current = json;
        dirtyRef.current = true;
    }, []);

    const { promptOpen, confirmDiscard, dismissPrompt } = useUnsavedChangesGuard({
        active: true,
        dirtyRef,
        revert: () => {},
    });

    function save() {
        setSaving(true);
        router.patch(`/templates/${template.id}`, {
            name: name.trim(),
            description: description.trim() || null,
            content: contentRef.current,
        }, {
            preserveScroll: true,
            onSuccess: () => { dirtyRef.current = false; },
            onFinish: () => setSaving(false),
        });
    }

    return (
        <>
        <DocsLayout>
            <Head title={`${template.name} — Templates`} />

            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-sm text-text-tertiary">
                <Link href="/templates" className="transition-colors hover:text-foreground">Templates</Link>
                <IconChevronRight className="h-3.5 w-3.5" stroke={1.5} />
                <span className="text-text-secondary">{template.name}</span>
            </div>

            {/* Name + description + save */}
            <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => { setName(e.target.value); dirtyRef.current = true; }}
                        placeholder="Template name"
                        className="w-full max-w-xl rounded-sm border border-transparent bg-transparent px-2 py-1 text-[19px] font-semibold text-foreground outline-none transition-[border-color,box-shadow] duration-150 hover:border-border focus:border-sage-400 focus:ring-[3px] focus:ring-sage-200"
                    />
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => { setDescription(e.target.value); dirtyRef.current = true; }}
                        placeholder="Short description shown in the New page picker (optional)"
                        className="w-full max-w-xl rounded-sm border border-transparent bg-transparent px-2 py-1 text-sm text-text-secondary placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 hover:border-border focus:border-sage-400 focus:ring-[3px] focus:ring-sage-200"
                    />
                </div>
                <Button
                    onClick={save}
                    disabled={saving || !name.trim()}
                    className="self-start bg-sage-400 hover:bg-sage-500 text-text-inverse"
                >
                    <IconDeviceFloppy stroke={1.5} />
                    {saving ? 'Saving…' : 'Save'}
                </Button>
            </div>

            {/* Content */}
            <div className="mt-4">
                <Card className="overflow-clip">
                    <TipTapEditor
                        content={template.content}
                        editable={true}
                        suggestions={[]}
                        onUpdate={handleEditorUpdate}
                    />
                </Card>
            </div>
        </DocsLayout>

        <ConfirmDialog
            open={promptOpen}
            title="Discard changes?"
            message="You have unsaved template changes. Leaving this page will discard them permanently."
            confirmLabel="Discard changes"
            cancelLabel="Keep editing"
            variant="danger"
            onConfirm={confirmDiscard}
            onCancel={dismissPrompt}
        />
        </>
    );
}
