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

    /**
     * Bornes les plus proches d'un point, la plus proche en tête.
     *
     * Le tri se fait en base et non en PHP : la plateforme est prévue pour des
     * milliers de bornes (cf. recommandation d'architecture du cahier des
     * charges), les charger toutes pour n'en garder que cinq serait un gâchis
     * qui grandirait avec le parc.
     *
     * Formule de Haversine écrite à la main plutôt que `ST_Distance_Sphere` :
     * cette fonction est absente de MariaDB, sur laquelle tourne le projet.
     * `LEAST/GREATEST` bornent l'argument d'ACOS à [-1, 1], que les arrondis
     * flottants peuvent sinon dépasser de justesse — ACOS renverrait NULL et la
     * borne disparaîtrait du classement.
     */
    public function proches(Request $request): JsonResponse
    {
        $data = $request->validate([
            'lat' => 'required|numeric|between:-90,90',
            'lng' => 'required|numeric|between:-180,180',
            'limite' => 'nullable|integer|min:1|max:50',
            // Filtre optionnel : ne proposer que des bornes où l'on peut
            // effectivement brancher maintenant.
            'disponibles' => 'nullable|boolean',
        ]);

        $lat = (float) $data['lat'];
        $lng = (float) $data['lng'];

        $distance = '(6371 * ACOS(LEAST(1, GREATEST(-1,
            COS(RADIANS(?)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(?))
            + SIN(RADIANS(?)) * SIN(RADIANS(latitude))
        ))))';

        $bornes = Borne::query()
            ->select('*')
            ->selectRaw("{$distance} AS distance_km", [$lat, $lng, $lat])
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->when(
                $data['disponibles'] ?? false,
                fn ($q) => $q->where('status', 'Disponible')
            )
            ->orderBy('distance_km')
            ->limit($data['limite'] ?? 5)
            ->get();

        return response()->json($bornes->map(fn (Borne $b) => [
            ...$b->toFrontendArray(),
            'distanceKm' => round((float) $b->distance_km, 3),
        ]));
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
