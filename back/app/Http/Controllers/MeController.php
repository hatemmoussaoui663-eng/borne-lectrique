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
        $sessions = ChargeSession::with('borne')
            ->where('user_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json($sessions->map->toFrontendArray());
    }

    public function vehicules(Request $request): JsonResponse
    {
        $vehicules = Vehicule::where('user_id', $request->user()->id)->orderBy('id')->get();

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
