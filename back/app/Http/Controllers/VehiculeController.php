<?php

namespace App\Http\Controllers;

use App\Models\Vehicule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Managing client vehicles (Module 10) is an Exploitant/Service Client
 * day-to-day task, not a Super Administrateur one: even though Admin has
 * 'full' access to every module by default, it's read-only here — see
 * ensureNotSuperAdmin(). Same carve-out pattern as maintenance ticket statut.
 */
class VehiculeController extends Controller
{
    public function index(): JsonResponse
    {
        $vehicules = Vehicule::with('user.badge')->orderBy('id')->get();

        return response()->json($vehicules->map->toFrontendArray());
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureNotSuperAdmin($request);

        $data = $this->validated($request);
        $vehicule = Vehicule::create($data);
        $vehicule->load('user.badge');

        return response()->json($vehicule->toFrontendArray(), 201);
    }

    public function update(Request $request, Vehicule $vehicule): JsonResponse
    {
        $this->ensureNotSuperAdmin($request);

        $data = $this->validated($request, $vehicule);
        $vehicule->update($data);
        $vehicule->load('user.badge');

        return response()->json($vehicule->toFrontendArray());
    }

    public function destroy(Request $request, Vehicule $vehicule): JsonResponse
    {
        $this->ensureNotSuperAdmin($request);

        $vehicule->delete();

        return response()->json(['message' => 'Véhicule supprimé.']);
    }

    private function ensureNotSuperAdmin(Request $request): void
    {
        if ($request->user()?->role?->name === 'super_admin') {
            abort(403, 'Le Super Administrateur consulte les véhicules en lecture seule ; la gestion revient à l\'Exploitant.');
        }
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
