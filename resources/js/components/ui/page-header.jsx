import { cn } from '@/lib/utils';

export function PageHeader({ title, description, children, className }) {
    return (
        <div className={cn('flex items-end justify-between gap-4', className)}>
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
                {description && (
                    <p className="mt-1 text-sm text-text-secondary">{description}</p>
                )}
            </div>
            {children && <div className="flex items-center gap-2">{children}</div>}
        </div>
    );
}
