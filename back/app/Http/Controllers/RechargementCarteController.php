<?php

namespace App\Http\Controllers;

use App\Models\PaiementCarte;
use App\Support\CarteBancaire;
use App\Support\PasserelleCarteSimulee;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Rechargement du porte-monnaie par carte, côté client (Module 9).
 *
 * Le numéro et le cryptogramme ne servent qu'à l'autorisation : ils ne sont ni
 * journalisés, ni renvoyés, ni stockés. Seule l'empreinte tronquée survit à la
 * requête.
 */
class RechargementCarteController extends Controller
{
    public function __construct(private readonly PasserelleCarteSimulee $passerelle)
    {
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'montant' => ['required', 'numeric', 'min:1'],
            // 13 a 19 chiffres, separateurs de saisie tolérés.
            'numero' => ['required', 'string', 'regex:/^[0-9 -]{13,25}$/'],
            'titulaire' => ['required', 'string', 'max:80'],
            'mois_expiration' => ['required', 'integer', 'between:1,12'],
            'annee_expiration' => ['required', 'integer', 'between:2024,2099'],
            // Vérifié pour la forme puis abandonné : le conserver, même le
            // temps d'un log, est interdit par PCI-DSS.
            'cvv' => ['required', 'string', 'regex:/^[0-9]{3,4}$/'],
        ], [
            'numero.regex' => 'Le numéro de carte doit contenir entre 13 et 19 chiffres.',
            'cvv.regex' => 'Le cryptogramme comporte 3 ou 4 chiffres.',
        ]);

        $carte = new CarteBancaire(
            $data['numero'],
            $data['titulaire'],
            (int) $data['mois_expiration'],
            (int) $data['annee_expiration'],
        );

        try {
            $resultat = $this->passerelle->recharger(
                $request->user(),
                $carte,
                (float) $data['montant'],
            );
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'paiement' => $resultat['paiement']->toFrontendArray(),
            'solde' => $resultat['solde'],
            'facturesReglees' => $resultat['facturesReglees'],
        ], $resultat['paiement']->statut === PaiementCarte::STATUT_ACCEPTE ? 201 : 402);
    }

    /** Historique des rechargements du client, refus compris. */
    public function index(Request $request): JsonResponse
    {
        $paiements = PaiementCarte::where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->get();

        return response()->json($paiements->map->toFrontendArray());
    }

    /**
     * Table BIN -> banque acceptée.
     *
     * Le préfixe accompagne le nom pour que la saisie affiche la banque
     * reconnue en direct : sans lui, le client ne saurait qu'au moment de
     * valider que sa carte n'est pas prise en charge. Rien de confidentiel
     * ici — un BIN identifie une banque, pas un porteur.
     */
    public function banquesAcceptees(): JsonResponse
    {
        $bins = collect(config('cartes.bins'))
            ->map(fn (string $banque, string $bin) => ['bin' => $bin, 'banque' => $banque])
            ->values();

        return response()->json($bins);
    }
}
