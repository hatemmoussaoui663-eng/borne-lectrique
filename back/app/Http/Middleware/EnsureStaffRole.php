<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gates the operator/admin back-office API (bornes, users, maintenance, tarif,
 * rapports, ...) from the "Client" role, which only ever gets the self-scoped
 * `/api/me/*` endpoints. Without this, the frontend's role-based route guards
 * were the only thing stopping a client's token from calling admin endpoints
 * directly (e.g. via curl/Postman).
 */
class EnsureStaffRole
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->role?->name === 'client') {
            abort(403, 'Réservé au personnel exploitant.');
        }

        return $next($request);
    }
}
