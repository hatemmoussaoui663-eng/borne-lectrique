<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Fine-grained, per-module gate for the staff side of the API (cahier des
 * charges §7) — sits *inside* the `staff` group, which already keeps the
 * "Client" role out entirely. Read (GET/HEAD) requires at least 'read';
 * anything else (POST/PUT/PATCH/DELETE) requires 'full'.
 */
class EnsurePermission
{
    public function handle(Request $request, Closure $next, string $module): Response
    {
        $level = $request->user()?->permissionFor($module) ?? 'none';

        if ($level === 'none') {
            abort(403, "Votre rôle n'a pas accès au module {$module}.");
        }

        $isWrite = ! in_array($request->method(), ['GET', 'HEAD'], true);
        if ($isWrite && $level !== 'full') {
            abort(403, "Votre rôle a un accès en lecture seule au module {$module}.");
        }

        return $next($request);
    }
}
