import { useForm, Head } from '@inertiajs/react';

export default function Login() {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    function submit(e) {
        e.preventDefault();
        post('/login');
    }

    return (
        <>
            <Head title="Sign in" />
            <div className="min-h-screen flex items-center justify-center bg-background px-4">
                <div className="w-full max-w-md">
                    <div className="bg-card rounded-lg border border-border shadow-sm px-8 py-10">
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">www.doc</h1>
                        <p className="mt-1 mb-8 text-sm text-text-secondary">Sign in to continue</p>

                        <form onSubmit={submit} className="space-y-5">
                            <div>
                                <label
                                    htmlFor="email"
                                    className="mb-1.5 block text-sm font-medium text-foreground"
                                >
                                    Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    autoComplete="email"
                                    placeholder="admin@example.com"
                                    className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-sage-400 focus-visible:ring-[3px] focus-visible:ring-sage-200"
                                    required
                                />
                                {errors.email && (
                                    <p className="mt-1.5 text-xs text-danger">{errors.email}</p>
                                )}
                            </div>

                            <div>
                                <label
                                    htmlFor="password"
                                    className="mb-1.5 block text-sm font-medium text-foreground"
                                >
                                    Password
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    autoComplete="current-password"
                                    className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-sage-400 focus-visible:ring-[3px] focus-visible:ring-sage-200"
                                    required
                                />
                                {errors.password && (
                                    <p className="mt-1.5 text-xs text-danger">{errors.password}</p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={processing}
                                className="h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-sage-500 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sage-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {processing ? 'Signing in…' : 'Sign in'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
}
