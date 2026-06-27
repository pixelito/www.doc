<?php

namespace App\Http\Middleware;

use App\Models\Backup;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user() ? [
                    'id'           => $request->user()->id,
                    'name'         => $request->user()->name,
                    'email'        => $request->user()->email,
                    'avatar_color' => $request->user()->avatar_color,
                    'roles'        => $request->user()->getRoleNames(),
                ] : null,
            ],
            'flash' => [
                'success'          => $request->session()->get('success'),
                'error'            => $request->session()->get('error'),
                'profile_success'  => $request->session()->get('profile_success'),
                'password_success' => $request->session()->get('password_success'),
            ],
            // Persistent backup notices (admin-only): runs whose result wasn't
            // emailed — mail off, or the report email failed — so a dismissable
            // banner informs the admin instead. Cleared by acknowledging.
            'backupNotices' => $this->backupNotices($request),
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function backupNotices(Request $request): array
    {
        $user = $request->user();
        if (! $user || ! $user->hasRole('admin')) {
            return [];
        }

        return Backup::query()
            ->whereNull('acknowledged_at')
            ->where('report_emailed', false)
            ->whereIn('status', ['done', 'failed'])
            ->where('trigger', '!=', 'pre-restore')
            ->latest('id')
            ->limit(10)
            ->get(['id', 'status', 'error', 'report_error', 'created_at'])
            ->map(fn (Backup $b) => [
                'id'           => $b->id,
                'status'       => $b->status,
                'error'        => $b->error,
                'report_error' => $b->report_error,
                'created_at'   => $b->created_at,
            ])
            ->all();
    }
}
