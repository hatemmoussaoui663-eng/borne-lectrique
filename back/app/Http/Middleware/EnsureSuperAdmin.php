<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Account creation and role creation (cahier des charges Module 1
 * "Gestion des rôles") are reserved to the Super Administrateur. Roles like
 * Exploitant or Service Client have 'full' access to the "utilisateurs"
 * module — they can list, update, or delete existing accounts — but must not
 * be able to create new accounts or new roles themselves.
 */
class EnsureSuperAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->role?->name !== 'super_admin') {
            abort(403, 'Réservé au Super Administrateur.');
        }

        return $next($request);
    }
}
