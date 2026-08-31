<?php

namespace App\Http\Controllers;

use App\Models\Paiement;
use App\Support\PaiementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * Historique des règlements et remboursements (Module 9).
 */
class PaiementController extends Controller
{
    public function __construct(private readonly PaiementService $paiements) {}

    public function index(Request $request): JsonResponse
    {
        $filtres = $request->validate([
            'moyen' => ['nullable', Rule::in(Paiement::MOYENS)],
            'statut' => ['nullable', 'string', 'max:20'],
            'user_id' => ['nullable', 'integer'],
        ]);

        $paiements = Paiement::with('facture')
            ->when($filtres['moyen'] ?? null, fn ($q, $v) => $q->where('moyen', $v))
            ->when($filtres['statut'] ?? null, fn ($q, $v) => $q->where('statut', $v))
            ->when($filtres['user_id'] ?? null, fn ($q, $v) => $q->where('user_id', $v))
            ->orderByDesc('id')
            ->limit(300)
            ->get();

        return response()->json($paiements->map(fn (Paiement $p) => [
            ...$p->toFrontendArray(),
            'numeroFacture' => $p->facture?->numero,
            'client' => $p->facture?->user_nom,
        ]));
    }

    public function rembourser(Request $request, Paiement $paiement): JsonResponse
    {
        $data = $request->validate([
            'motif' => ['required', 'string', 'max:255'],
        ]);

        try {
            $this->paiements->rembourser($paiement, $data['motif']);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $paiement->refresh()->load('facture');

        return response()->json([
            'message' => $paiement->moyen === Paiement::MOYEN_WALLET
                ? 'Remboursement effectué : le montant a été recrédité sur le porte-monnaie du client.'
                : 'Remboursement enregistré.',
            'paiement' => $paiement->toFrontendArray(),
        ]);
    }
}
