import { usePage, router, Head } from '@inertiajs/react';

export default function Dashboard() {
    const { auth } = usePage().props;

    function logout(e) {
        e.preventDefault();
        router.post('/logout');
    }

    return (
        <>
            <Head title="Dashboard" />
            <div className="min-h-screen bg-gray-50">
                <header className="bg-white border-b border-gray-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
                        <span className="font-semibold text-gray-900">DocsApp</span>
                        <form onSubmit={logout}>
                            <button
                                type="submit"
                                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                Sign out
                            </button>
                        </form>
                    </div>
                </header>

                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <h2 className="text-2xl font-semibold text-gray-900">
                        Welcome, {auth.user.name}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        User #{auth.user.id} &middot; {auth.user.email}
                    </p>

                    <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
                        <p className="text-gray-400 text-sm">
                            Phase 0 complete — walking skeleton is up.
                        </p>
                    </div>
                </main>
            </div>
        </>
    );
}
