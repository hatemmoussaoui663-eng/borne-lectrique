<?php

namespace App\Http\Controllers;

use App\Models\Abonnement;
use App\Models\ChargeSession;
use App\Models\Facture;
use App\Models\Vehicule;
use App\Models\Wallet;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * "Espace Client" endpoints: every method here is implicitly scoped to the
 * authenticated user's own records. Unlike the admin controllers (BorneController,
 * VehiculeController, ...), the caller can never read or touch another user's data
 * regardless of what's in the request body.
 */
class MeController extends Controller
{
    public function sessions(Request $request): JsonResponse
    {
        $filtres = $request->validate([
            // §8 « Historique recharges » : consulter l'historique d'une voiture
            // précise plutôt que celui du compte entier.
            'vehicule_id' => ['nullable', 'integer'],
        ]);

        $sessions = ChargeSession::with(['borne', 'vehicule'])
            ->where('user_id', $request->user()->id)
            ->when(
                $filtres['vehicule_id'] ?? null,
                fn ($q, $id) => $q->where('vehicule_id', $id)
            )
            ->latest()
            ->get();

        return response()->json($sessions->map->toFrontendArray());
    }

    /**
     * Rattache (ou détache) le véhicule d'une de mes sessions.
     *
     * OCPP ne dit pas quelle voiture était branchée : quand un client en
     * possède plusieurs, la session arrive sans véhicule et c'est lui, seul à
     * le savoir, qui complète l'information.
     */
    public function affecterVehicule(Request $request, ChargeSession $session): JsonResponse
    {
        abort_unless($session->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'vehicule_id' => ['nullable', 'integer', Rule::exists('vehicules', 'id')],
        ]);

        $vehiculeId = $data['vehicule_id'] ?? null;

        if ($vehiculeId !== null) {
            // Sans ce contrôle, un client pourrait rattacher sa recharge à la
            // voiture d'un autre — et polluer l'historique de celle-ci.
            $vehicule = Vehicule::find($vehiculeId);
            abort_unless($vehicule?->user_id === $request->user()->id, 403);
        }

        $session->update(['vehicule_id' => $vehiculeId]);
        $session->load(['borne', 'vehicule']);

        return response()->json($session->toFrontendArray());
    }

    public function vehicules(Request $request): JsonResponse
    {
        $vehicules = Vehicule::where('user_id', $request->user()->id)
            // §8 : nombre de recharges, énergie et coût cumulés par véhicule.
            ->withCount('chargeSessions')
            ->withSum('chargeSessions', 'energie_kwh')
            ->withSum('chargeSessions', 'prix')
            ->orderBy('id')
            ->get();

        return response()->json($vehicules->map->toFrontendArray());
    }

    /**
     * Mes factures (Module 9). Le §7 du cahier des charges donne au Client un
     * accès « Lecture » sur Paiement : il consulte et télécharge, il ne règle
     * ni ne rembourse — ces actions restent au back-office.
     */
    public function factures(Request $request): JsonResponse
    {
        $factures = Facture::with(['chargeSession.borne', 'paiements'])
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->get();

        return response()->json($factures->map->toFrontendArray());
    }

    public function facturePdf(Request $request, Facture $facture): Response
    {
        // Le contrôle décisif du module : sans lui, un client authentifié
        // pourrait télécharger la facture d'un autre en changeant l'id.
        abort_unless($facture->user_id === $request->user()->id, 403);

        $facture->load(['chargeSession.borne', 'paiements', 'user']);

        return Pdf::loadView('factures.pdf', ['facture' => $facture])
            ->download("{$facture->numero}.pdf");
    }

    /** Mon porte-monnaie et ses mouvements (Module 9). */
    public function wallet(Request $request): JsonResponse
    {
        $wallet = Wallet::pour($request->user())->load(['user', 'transactions']);

        return response()->json($wallet->toFrontendArray());
    }

    /** Mon abonnement en cours, et l'historique de mes souscriptions. */
    public function abonnements(Request $request): JsonResponse
    {
        $abonnements = Abonnement::with('user')
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->get();

        return response()->json($abonnements->map->toFrontendArray());
    }

    public function storeVehicule(Request $request): JsonResponse
    {
        $data = $this->validatedVehicule($request);
        $data['user_id'] = $request->user()->id;

        $vehicule = Vehicule::create($data);
        $vehicule->load('user');

        return response()->json($vehicule->toFrontendArray(), 201);
    }

    public function updateVehicule(Request $request, Vehicule $vehicule): JsonResponse
    {
        abort_unless($vehicule->user_id === $request->user()->id, 403);

        $data = $this->validatedVehicule($request, $vehicule);
        $vehicule->update($data);
        $vehicule->load('user');

        return response()->json($vehicule->toFrontendArray());
    }

    public function destroyVehicule(Request $request, Vehicule $vehicule): JsonResponse
    {
        abort_unless($vehicule->user_id === $request->user()->id, 403);
        $vehicule->delete();

        return response()->json(['message' => 'Véhicule supprimé.']);
    }

    /**
     * Position GPS transmise par le véhicule (suivi temps réel).
     *
     * Émise par le navigateur embarqué (API Geolocation) ou, à terme, par un
     * boîtier télématique : même contrat des deux côtés, un simple POST du
     * couple lat/lng. Rien d'autre n'est nécessaire pour brancher un traceur
     * réel à la place du téléphone.
     *
     * `saveQuietly` : une position arrive toutes les quelques secondes, la
     * tracer au journal d'audit (Module 18) le noierait sous des lignes
     * « Modification : Véhicule » sans intérêt pour un auditeur.
     */
    public function majPosition(Request $request, Vehicule $vehicule): JsonResponse
    {
        abort_unless($vehicule->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'lat' => 'required|numeric|between:-90,90',
            'lng' => 'required|numeric|between:-180,180',
            // Rayon d'incertitude en mètres, tel que rapporté par la source.
            'precision_m' => 'nullable|numeric|min:0|max:100000',
        ]);

        $vehicule->forceFill([
            'latitude' => $data['lat'],
            'longitude' => $data['lng'],
            'position_precision_m' => isset($data['precision_m'])
                ? (int) round($data['precision_m'])
                : null,
            'position_maj_le' => now(),
        ])->saveQuietly();

        return response()->json($vehicule->toFrontendArray());
    }

    private function validatedVehicule(Request $request, ?Vehicule $vehicule = null): array
    {
        return $request->validate([
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
