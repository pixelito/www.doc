import { cn } from '@/lib/utils';

export function EmptyState({ icon: Icon, title, description, children, className }) {
    return (
        <div className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
            {Icon && (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-sage-200 bg-sage-50">
                    <Icon className="h-6 w-6 text-sage-500" stroke={1.5} />
                </div>
            )}
            <div>
                {title && <p className="text-sm font-medium text-foreground">{title}</p>}
                {description && <p className="mt-0.5 text-xs text-text-tertiary">{description}</p>}
            </div>
            {children && <div>{children}</div>}
        </div>
    );
}
