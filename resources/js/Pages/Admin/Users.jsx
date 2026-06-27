import { useState } from 'react';
import { Head, useForm, router, usePage } from '@inertiajs/react';
import { IconTrash, IconLoader2 } from '@tabler/icons-react';
import SettingsLayout from '@/Layouts/SettingsLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { avatarStyle, initials } from '@/lib/avatar';

function RoleSelect({ value, onChange, roles, disabled }) {
    return (
        <select
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className="ui-select h-8 rounded-sm border border-border bg-surface px-2 text-sm capitalize text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
            {roles.map((role) => (
                <option key={role} value={role} className="capitalize">{role}</option>
            ))}
        </select>
    );
}

function FieldError({ error }) {
    return error ? <p className="mt-1 text-xs text-danger">{error}</p> : null;
}

export default function Users() {
    const { users, roles, auth } = usePage().props;
    const [confirm, setConfirm] = useState(null); // user pending deletion

    const form = useForm({ name: '', email: '', password: '', password_confirmation: '', role: 'editor' });

    function createUser(e) {
        e.preventDefault();
        form.post('/admin/users', { preserveScroll: true, onSuccess: () => form.reset() });
    }

    function changeRole(user, role) {
        router.patch(`/admin/users/${user.id}`, { role }, { preserveScroll: true });
    }

    function deleteUser() {
        router.delete(`/admin/users/${confirm.id}`, {
            preserveScroll: true,
            onFinish: () => setConfirm(null),
        });
    }

    return (
        <SettingsLayout>
            <Head title="Users — Admin" />

            {/* User list */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="text-sm font-semibold text-foreground">Team members</CardTitle>
                    <CardDescription>Manage who has access to this knowledge base.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-border">
                        {users.map((user) => {
                    const isSelf = user.id === auth.user.id;
                    return (
                        <div key={user.id} className="flex items-center gap-3 px-4 py-3">
                            <div
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                                style={avatarStyle(user.avatar_color)}
                            >
                                {initials(user.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-foreground">
                                    {user.name}
                                    {isSelf && <span className="ml-1.5 text-xs font-normal text-text-tertiary">(you)</span>}
                                </p>
                                <p className="truncate text-xs text-text-secondary">{user.email}</p>
                            </div>

                            <RoleSelect
                                value={user.role ?? 'viewer'}
                                roles={roles}
                                onChange={(role) => changeRole(user, role)}
                            />

                            <button
                                type="button"
                                onClick={() => setConfirm(user)}
                                disabled={isSelf}
                                title={isSelf ? 'You cannot delete your own account' : 'Delete user'}
                                className="flex h-8 w-8 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:bg-surface-hover hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-text-tertiary"
                            >
                                <IconTrash className="h-4 w-4" stroke={1.5} />
                            </button>
                        </div>
                    );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Add a user */}
            <form onSubmit={createUser}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold text-foreground">Add a user</CardTitle>
                        <CardDescription>Create a new account with a specific role.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">Name</label>
                        <Input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                        <FieldError error={form.errors.name} />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">Email</label>
                        <Input type="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} />
                        <FieldError error={form.errors.email} />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">Password</label>
                        <Input type="password" value={form.data.password} onChange={(e) => form.setData('password', e.target.value)} />
                        <FieldError error={form.errors.password} />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">Confirm password</label>
                        <Input type="password" value={form.data.password_confirmation} onChange={(e) => form.setData('password_confirmation', e.target.value)} />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">Role</label>
                        <RoleSelect value={form.data.role} roles={roles} onChange={(role) => form.setData('role', role)} />
                    </div>
                </div>
            </CardContent>
                </Card>
                <div className="mt-4 flex items-center justify-end">
                    <Button type="submit" disabled={form.processing}>
                        {form.processing && <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.5} />}
                        {form.processing ? 'Adding…' : 'Add user'}
                    </Button>
                </div>
            </form>

            <ConfirmDialog
                open={Boolean(confirm)}
                title="Delete user"
                message={confirm ? `Delete ${confirm.name}? This permanently removes their account.` : ''}
                confirmLabel="Delete user"
                onConfirm={deleteUser}
                onCancel={() => setConfirm(null)}
            />
        </SettingsLayout>
    );
}
