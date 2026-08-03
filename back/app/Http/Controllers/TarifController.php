<?php

namespace App\Http\Controllers;

use App\Models\Tarif;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TarifController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(Tarif::current()->toFrontendArray());
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'prixKwh' => 'required|numeric|min:0',
        ]);

        $tarif = Tarif::current();
        $tarif->update(['prix_kwh' => $data['prixKwh']]);

        return response()->json($tarif->toFrontendArray());
    }
}
