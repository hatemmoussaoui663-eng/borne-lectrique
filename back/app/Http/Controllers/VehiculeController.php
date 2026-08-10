<?php

namespace App\Http\Controllers;

use App\Models\Vehicule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class VehiculeController extends Controller
{
    public function index(): JsonResponse
    {
        $vehicules = Vehicule::with('user')->orderBy('id')->get();

        return response()->json($vehicules->map->toFrontendArray());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $vehicule = Vehicule::create($data);
        $vehicule->load('user');

        return response()->json($vehicule->toFrontendArray(), 201);
    }

    public function update(Request $request, Vehicule $vehicule): JsonResponse
    {
        $data = $this->validated($request, $vehicule);
        $vehicule->update($data);
        $vehicule->load('user');

        return response()->json($vehicule->toFrontendArray());
    }

    public function destroy(Vehicule $vehicule): JsonResponse
    {
        $vehicule->delete();

        return response()->json(['message' => 'Véhicule supprimé.']);
    }

    private function validated(Request $request, ?Vehicule $vehicule = null): array
    {
        return $request->validate([
            'user_id' => ['nullable', 'integer', Rule::exists('users', 'id')],
            'marque' => 'required|string|max:100',
            'modele' => 'required|string|max:100',
            'immatriculation' => [
                'required', 'string', 'max:50',
                Rule::unique('vehicules', 'immatriculation')->ignore($vehicule?->id),
            ],
            'connecteur_type' => ['required', Rule::in(['CCS', 'Type2', 'CHAdeMO', 'AC', 'DC'])],
            'capacite_kwh' => 'required|integer|min:1|max:500',
        ]);
    }
}
