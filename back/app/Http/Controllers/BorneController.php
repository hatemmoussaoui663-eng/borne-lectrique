<?php

namespace App\Http\Controllers;

use App\Models\Borne;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class BorneController extends Controller
{
    public function index(): JsonResponse
    {
        $bornes = Borne::orderBy('id')->get()->map(fn (Borne $b) => $b->toFrontendArray());

        return response()->json($bornes);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'reference' => 'nullable|string|max:255',
            'numero_serie' => 'nullable|string|max:255',
            'modele' => 'nullable|string|max:255',
            'fabricant' => 'nullable|string|max:255',
            'adresse' => 'nullable|string|max:255',
            'ville' => 'nullable|string|max:255',
            'status' => 'nullable|string|max:50',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'puissance' => 'nullable|integer',
            'ocpp' => 'nullable|string|max:10',
            'firmware' => 'nullable|string|max:255',
            'connecteurs' => 'nullable|array',
        ]);

        $borne = Borne::create($data);

        // build frontend-shaped payload merging request extras if present
        $payload = $borne->toFrontendArray();
        $payload = array_merge($payload, [
            'reference' => $request->input('reference', $payload['reference']),
            'numeroSerie' => $request->input('numeroSerie', $payload['numeroSerie']),
            'modele' => $request->input('modele', $payload['modele']),
            'fabricant' => $request->input('fabricant', $payload['fabricant']),
            'adresse' => $request->input('adresse', $payload['adresse']),
            'ville' => $request->input('ville', $payload['ville']),
            'puissance' => $request->input('puissance', $payload['puissance']),
            'connecteurs' => $request->input('connecteurs', $payload['connecteurs']),
        ]);

        return response()->json($payload, 201);
    }

    public function show(Borne $borne): JsonResponse
    {
        return response()->json($borne->toFrontendArray());
    }

    public function update(Request $request, Borne $borne): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'reference' => 'nullable|string|max:255',
            'numero_serie' => 'nullable|string|max:255',
            'modele' => 'nullable|string|max:255',
            'fabricant' => 'nullable|string|max:255',
            'adresse' => 'nullable|string|max:255',
            'ville' => 'nullable|string|max:255',
            'status' => 'nullable|string|max:50',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'puissance' => 'nullable|integer',
            'ocpp' => 'nullable|string|max:10',
            'firmware' => 'nullable|string|max:255',
            'connecteurs' => 'nullable|array',
        ]);

        $borne->update($data);

        // return frontend-shaped object
        return response()->json($borne->toFrontendArray());
    }

    public function destroy(Borne $borne): JsonResponse
    {
        $borne->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
