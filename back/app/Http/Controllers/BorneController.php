<?php

namespace App\Http\Controllers;

use App\Models\Borne;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class BorneController extends Controller
{
    public function index(): JsonResponse
    {
        $bornes = Borne::orderBy('id')->get()->map(function (Borne $b) {
            return $this->mapToFrontend($b);
        });

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
        $payload = $this->mapToFrontend($borne);
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
        return response()->json($this->mapToFrontend($borne));
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
        return response()->json($this->mapToFrontend($borne));
    }

    public function destroy(Borne $borne): JsonResponse
    {
        $borne->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * Map a Borne model to the frontend expected shape.
     *
     * This returns keys used by the React app: `id`, `nom`, `reference`, `numeroSerie`,
     * `modele`, `fabricant`, `adresse`, `ville`, `lat`, `lng`, `firmware`, `ocpp`,
     * `puissance`, `etat`, `dernierHeartbeat`, `connecteurs`.
     */
    private function mapToFrontend(Borne $b): array
    {
        return [
            'id' => $b->id,
            'name' => $b->name,
            'nom' => $b->name,
            'reference' => $b->reference ?? '',
            'numeroSerie' => $b->numero_serie ?? '',
            'modele' => $b->modele ?? '',
            'fabricant' => $b->fabricant ?? '',
            'adresse' => $b->adresse ?? '',
            'ville' => $b->ville ?? '',
            'lat' => $b->latitude !== null ? (float) $b->latitude : 0,
            'lng' => $b->longitude !== null ? (float) $b->longitude : 0,
            'latitude' => $b->latitude !== null ? (float) $b->latitude : null,
            'longitude' => $b->longitude !== null ? (float) $b->longitude : null,
            'firmware' => $b->firmware ?? '',
            'ocpp' => $b->ocpp ?? '1.6',
            'puissance' => $b->puissance ?? 22,
            'status' => $b->status ?? 'inactive',
            'etat' => $b->status ?? 'Déconnectée',
            'dernierHeartbeat' => $b->updated_at ? $b->updated_at->toDateTimeString() : null,
            'connecteurs' => $b->connecteurs ?? [],
            'created_at' => $b->created_at ? $b->created_at->toDateTimeString() : null,
            'updated_at' => $b->updated_at ? $b->updated_at->toDateTimeString() : null,
        ];
    }
}
