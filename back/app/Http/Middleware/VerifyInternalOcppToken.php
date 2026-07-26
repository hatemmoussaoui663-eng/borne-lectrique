<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyInternalOcppToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) env('OCPP_INGEST_TOKEN', '');

        if ($expected === '' || $request->header('X-Internal-Token') !== $expected) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return $next($request);
    }
}
