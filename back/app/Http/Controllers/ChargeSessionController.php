<?php

namespace App\Http\Controllers;

use App\Models\ChargeSession;
use Illuminate\Http\JsonResponse;

class ChargeSessionController extends Controller
{
    public function index(): JsonResponse
    {
        $sessions = ChargeSession::with(['borne', 'vehicule', 'user'])
            ->latest('started_at')
            ->get()
            ->map(fn (ChargeSession $s) => $s->toFrontendArray());

        return response()->json($sessions);
    }
}
