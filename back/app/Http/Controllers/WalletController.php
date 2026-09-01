<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Support\PaiementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * Porte-monnaie clients (Module 9, « Wallet »).
 */
class WalletController extends Controller
{
    public function __construct(private readonly PaiementService $paiements) {}

    public function index(): JsonResponse
    {
        $wallets = Wallet::with('user')->orderByDesc('solde')->get();

        return response()->json($wallets->map->toFrontendArray());
    }

    public function show(Wallet $wallet): JsonResponse
    {
        $wallet->load(['user', 'transactions']);

        return response()->json($wallet->toFrontendArray());
    }

    /**
     * Contre-passe un rechargement saisi par erreur.
     *
     * Il n'existe volontairement aucune route de suppression : effacer le
     * mouvement ferait diverger le solde de son historique. La correction est
     * un second mouvement, et les deux restent lisibles.
     */
    public function annulerTransaction(Request $request, WalletTransaction $transaction): JsonResponse
    {
        $data = $request->validate([
            'motif' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            $correction = $this->paiements->annulerRechargement($transaction, $data['motif'] ?? null);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $wallet = $transaction->wallet->fresh()->load(['user', 'transactions']);

        return response()->json([
            'message' => sprintf(
                'Rechargement de %.3f DT annulé (nouveau solde : %.3f DT).',
                $correction->montant,
                $wallet->solde,
            ),
            'wallet' => $wallet->toFrontendArray(),
        ]);
    }

    /**
     * Retrait libre : sert quand le rechargement fautif a déjà été partiellement
     * dépensé et que l'annulation intégrale n'est plus possible.
     */
    public function debiter(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', Rule::exists('users', 'id')],
            'montant' => ['required', 'numeric', 'min:0.001', 'max:100000'],
            'motif' => ['required', 'string', 'max:255'],
        ]);

        $client = User::findOrFail($data['user_id']);

        try {
            $transaction = $this->paiements->debiter(
                $client,
                (float) $data['montant'],
                $data['motif'],
            );
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $wallet = Wallet::pour($client)->load(['user', 'transactions']);

        return response()->json([
            'message' => sprintf(
                'Porte-monnaie de %s débité de %.3f DT (nouveau solde : %.3f DT).',
                $client->name,
                $transaction->montant,
                $wallet->solde,
            ),
            'wallet' => $wallet->toFrontendArray(),
        ]);
    }

    public function crediter(Request $request): JsonResponse
    {
        $data = $request->validate([
            // Le porte-monnaie n'existe qu'à partir du premier mouvement : on
            // désigne donc le client, pas un wallet qui n'existe pas encore.
            'user_id' => ['required', 'integer', Rule::exists('users', 'id')],
            'montant' => ['required', 'numeric', 'min:0.001', 'max:100000'],
            'motif' => ['nullable', 'string', 'max:255'],
        ]);

        $client = User::findOrFail($data['user_id']);

        try {
            $transaction = $this->paiements->crediter(
                $client,
                (float) $data['montant'],
                $data['motif'] ?? 'Rechargement du porte-monnaie',
            );
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $wallet = Wallet::pour($client)->load(['user', 'transactions']);

        return response()->json([
            'message' => sprintf(
                'Porte-monnaie de %s crédité de %.3f DT (nouveau solde : %.3f DT).',
                $client->name,
                $transaction->montant,
                $wallet->solde,
            ),
            'wallet' => $wallet->toFrontendArray(),
        ]);
    }
}
