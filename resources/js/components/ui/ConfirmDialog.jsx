import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

/**
 * Custom confirmation dialog matching the project design system.
 * Renders into document.body via a portal.
 *
 * Props:
 *   open          – whether the dialog is visible
 *   title         – heading text
 *   message       – body text
 *   confirmLabel  – confirm button label  (default "Confirm")
 *   cancelLabel   – cancel button label   (default "Cancel")
 *   variant       – 'danger' | 'primary'  (default "danger")
 *   onConfirm     – called when the confirm button is clicked
 *   onCancel      – called when Cancel or × is clicked
 */
export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel  = 'Cancel',
    variant      = 'danger',
    onConfirm,
    onCancel,
}) {
    // Close on Escape
    useEffect(() => {
        if (!open) return;
        function onKey(e) {
            if (e.key === 'Escape') onCancel?.();
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onCancel]);

    if (!open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: 'rgba(31, 37, 32, 0.42)' }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}
        >
            <div className="w-full max-w-md overflow-hidden rounded-[14px] bg-surface"
                 style={{ boxShadow: '0 16px 40px rgba(31, 37, 32, 0.18)' }}>

                {/* Header */}
                <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
                    <h2 className="text-[15px] font-medium text-foreground">{title}</h2>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex h-7 w-7 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:bg-surface-hover hover:text-foreground"
                    >
                        <IconX className="h-4 w-4" stroke={1.5} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4">
                    <p className="text-sm leading-relaxed text-text-secondary">{message}</p>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 border-t border-border-subtle bg-canvas px-5 py-3.5">
                    <Button type="button" variant="outline" onClick={onCancel}>
                        {cancelLabel}
                    </Button>
                    <Button
                        type="button"
                        variant={variant === 'danger' ? 'destructive' : 'default'}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
}
