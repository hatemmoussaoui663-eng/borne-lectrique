<?php

namespace App\Http\Controllers;

use App\Models\Abonnement;
use App\Models\AbonnementPlan;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Formules d'abonnement et souscriptions (Module 9).
 *
 * La remise d'un abonnement en cours est appliquée au moment où la facture est
 * émise (FacturationService) puis figée dessus : changer la formule plus tard
 * ne doit pas retoucher les factures déjà émises.
 */
class AbonnementController extends Controller
{
    // ------------------------------------------------------------- Catalogue

    public function plans(): JsonResponse
    {
        $plans = AbonnementPlan::withCount('abonnements')->orderBy('prix_mensuel')->get();

        return response()->json($plans->map->toFrontendArray());
    }

    public function storePlan(Request $request): JsonResponse
    {
        $plan = AbonnementPlan::create($this->validerPlan($request));
        $plan->loadCount('abonnements');

        return response()->json($plan->toFrontendArray(), 201);
    }

    public function updatePlan(Request $request, AbonnementPlan $plan): JsonResponse
    {
        $plan->update($this->validerPlan($request));
        $plan->loadCount('abonnements');

        return response()->json($plan->toFrontendArray());
    }

    public function destroyPlan(AbonnementPlan $plan): JsonResponse
    {
        // Des clients y sont peut-être rattachés : on retire la formule du
        // catalogue plutôt que de la supprimer, sinon leurs souscriptions
        // perdraient leur référence.
        if ($plan->abonnements()->exists()) {
            $plan->update(['actif' => false]);

            return response()->json([
                'message' => 'Des clients sont abonnés à cette formule : elle a été désactivée plutôt que supprimée.',
            ]);
        }

        $plan->delete();

        return response()->json(['message' => 'Formule supprimée.']);
    }

    // --------------------------------------------------------- Souscriptions

    public function index(Request $request): JsonResponse
    {
        $filtres = $request->validate([
            'user_id' => ['nullable', 'integer'],
            'statut' => ['nullable', 'string', 'max:20'],
        ]);

        $abonnements = Abonnement::with('user')
            ->when($filtres['user_id'] ?? null, fn ($q, $v) => $q->where('user_id', $v))
            ->when($filtres['statut'] ?? null, fn ($q, $v) => $q->where('statut', $v))
            ->orderByDesc('id')
            ->get();

        return response()->json($abonnements->map->toFrontendArray());
    }

    public function souscrire(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', Rule::exists('users', 'id')],
            'abonnement_plan_id' => ['required', 'integer', Rule::exists('abonnement_plans', 'id')],
            'fin' => ['nullable', 'date', 'after:today'],
        ]);

        $client = User::findOrFail($data['user_id']);
        $plan = AbonnementPlan::findOrFail($data['abonnement_plan_id']);

        if (! $plan->actif) {
            return response()->json(['message' => "Cette formule n'est plus proposée."], 422);
        }

        // Deux abonnements en cours rendraient la remise applicable ambiguë.
        if ($client->abonnementEnCours() !== null) {
            return response()->json([
                'message' => "{$client->name} a déjà un abonnement en cours ; résiliez-le d'abord.",
            ], 422);
        }

        $abonnement = Abonnement::create([
            'user_id' => $client->id,
            'abonnement_plan_id' => $plan->id,
            'plan_nom' => $plan->nom,
            'prix_mensuel' => $plan->prix_mensuel,
            'remise_pourcent' => $plan->remise_pourcent,
            'statut' => Abonnement::STATUT_ACTIF,
            'debut' => now()->toDateString(),
            'fin' => $data['fin'] ?? null,
        ]);

        $abonnement->load('user');

        return response()->json([
            'message' => "{$client->name} est abonné à la formule {$plan->nom}.",
            'abonnement' => $abonnement->toFrontendArray(),
        ], 201);
    }

    public function resilier(Abonnement $abonnement): JsonResponse
    {
        if ($abonnement->statut !== Abonnement::STATUT_ACTIF) {
            return response()->json(['message' => "Cet abonnement n'est pas actif."], 422);
        }

        $abonnement->update([
            'statut' => Abonnement::STATUT_RESILIE,
            'fin' => now()->toDateString(),
        ]);

        $abonnement->load('user');

        return response()->json([
            'message' => 'Abonnement résilié.',
            'abonnement' => $abonnement->toFrontendArray(),
        ]);
    }

    private function validerPlan(Request $request): array
    {
        return $request->validate([
            'nom' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:500'],
            'prix_mensuel' => ['required', 'numeric', 'min:0', 'max:100000'],
            'remise_pourcent' => ['required', 'numeric', 'min:0', 'max:100'],
            'actif' => ['required', 'boolean'],
        ]);
    }
}
