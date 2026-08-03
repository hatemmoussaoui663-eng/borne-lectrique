<?php

namespace App\Http\Controllers;

use App\Events\AlerteUpdated;
use App\Models\Alerte;
use Illuminate\Http\JsonResponse;

class AlerteController extends Controller
{
    public function index(): JsonResponse
    {
        $alertes = Alerte::with('borne')
            ->latest()
            ->limit(200)
            ->get()
            ->map(fn (Alerte $a) => $a->toFrontendArray());

        return response()->json($alertes);
    }

    public function markRead(Alerte $alerte): JsonResponse
    {
        $alerte->update(['read_at' => now()]);

        AlerteUpdated::dispatch($alerte);

        return response()->json($alerte->toFrontendArray());
    }
}
