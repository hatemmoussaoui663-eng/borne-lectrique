<?php

namespace App\Support;

use App\Models\Facture;
use App\Models\Paiement;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Règlements, porte-monnaie et remboursements (Module 9).
 *
 * Aucun prestataire de paiement n'est branché : le projet n'a ni compte ni
 * clés d'API. Un règlement par carte est donc *enregistré* avec sa référence,
 * pas capturé. Brancher un vrai PSP consiste à remplacer `referenceCarte()` par
 * l'appel au prestataire et à ne créer le paiement qu'en cas de capture réussie
 * — le reste du module n'a pas à changer.
 */
class PaiementService
{
    /**
     * Règle une facture. Tout passe par une transaction : le débit du
     * porte-monnaie, la ligne de paiement et le changement de statut de la
     * facture doivent réussir ou échouer ensemble.
     *
     * @throws RuntimeException si la facture n'est pas réglable ou le solde insuffisant
     */
    public function regler(Facture $facture, string $moyen, ?string $reference = null): Paiement
    {
        if ($facture->statut !== Facture::STATUT_IMPAYEE) {
            throw new RuntimeException('Seule une facture impayée peut être réglée.');
        }

        if (! in_array($moyen, Paiement::MOYENS, true)) {
            throw new RuntimeException('Moyen de paiement inconnu.');
        }

        return DB::transaction(function () use ($facture, $moyen, $reference) {
            // Le paiement différé n'encaisse rien : il acte que la facture sera
            // réglée plus tard, et laisse la facture impayée avec son échéance.
            if ($moyen === Paiement::MOYEN_DIFFERE) {
                return $this->creerPaiement($facture, $moyen, Paiement::STATUT_EN_ATTENTE, $reference);
            }

            if ($moyen === Paiement::MOYEN_WALLET) {
                $this->debiterWallet($facture);
            }

            $paiement = $this->creerPaiement(
                $facture,
                $moyen,
                Paiement::STATUT_PAYE,
                $reference ?? $this->referenceCarte($moyen),
                payeLe: now(),
            );

            $facture->update(['statut' => Facture::STATUT_PAYEE]);

            return $paiement;
        });
    }

    /**
     * Rembourse un paiement encaissé. Le montant retourne au porte-monnaie
     * quand c'est par là qu'il est arrivé ; pour une carte, le remboursement
     * est enregistré ici et exécuté chez le prestataire.
     *
     * @throws RuntimeException si le paiement n'est pas remboursable
     */
    public function rembourser(Paiement $paiement, string $motif): Paiement
    {
        if ($paiement->statut !== Paiement::STATUT_PAYE) {
            throw new RuntimeException('Seul un paiement encaissé peut être remboursé.');
        }

        return DB::transaction(function () use ($paiement, $motif) {
            $facture = $paiement->facture;

            if ($paiement->moyen === Paiement::MOYEN_WALLET && $facture?->user !== null) {
                $this->crediter(
                    $facture->user,
                    (float) $paiement->montant,
                    "Remboursement de la facture {$facture->numero}",
                    $facture->id,
                );
            }

            $paiement->update([
                'statut' => Paiement::STATUT_REMBOURSE,
                'rembourse_le' => now(),
                'motif_remboursement' => $motif,
            ]);

            $facture?->update(['statut' => Facture::STATUT_REMBOURSEE]);

            return $paiement;
        });
    }

    /** Rechargement du porte-monnaie. */
    public function crediter(User $client, float $montant, string $motif, ?int $factureId = null): WalletTransaction
    {
        if ($montant <= 0) {
            throw new RuntimeException('Le montant doit être positif.');
        }

        return DB::transaction(function () use ($client, $montant, $motif, $factureId) {
            $wallet = Wallet::pour($client);
            // Verrou de ligne : deux rechargements simultanés liraient sinon le
            // même solde de départ et l'un des deux serait perdu.
            $wallet = Wallet::whereKey($wallet->id)->lockForUpdate()->first();

            $wallet->solde = round($wallet->solde + $montant, 3);
            $wallet->save();

            return WalletTransaction::create([
                'wallet_id' => $wallet->id,
                'type' => WalletTransaction::TYPE_CREDIT,
                'montant' => round($montant, 3),
                'solde_apres' => $wallet->solde,
                'motif' => $motif,
                'facture_id' => $factureId,
                'effectue_par' => Auth::id(),
            ]);
        });
    }

    /** @throws RuntimeException si le client n'a pas de compte ou pas assez de solde */
    private function debiterWallet(Facture $facture): void
    {
        $client = $facture->user;

        if ($client === null) {
            throw new RuntimeException("Cette facture n'est rattachée à aucun client : paiement par wallet impossible.");
        }

        $wallet = Wallet::pour($client);
        $wallet = Wallet::whereKey($wallet->id)->lockForUpdate()->first();

        if ($wallet->solde + 0.0005 < $facture->montant_ttc) {
            throw new RuntimeException(sprintf(
                'Solde insuffisant : %.3f DT disponibles pour une facture de %.3f DT.',
                $wallet->solde,
                $facture->montant_ttc,
            ));
        }

        $wallet->solde = round($wallet->solde - $facture->montant_ttc, 3);
        $wallet->save();

        WalletTransaction::create([
            'wallet_id' => $wallet->id,
            'type' => WalletTransaction::TYPE_DEBIT,
            'montant' => round((float) $facture->montant_ttc, 3),
            'solde_apres' => $wallet->solde,
            'motif' => "Paiement de la facture {$facture->numero}",
            'facture_id' => $facture->id,
            'effectue_par' => Auth::id(),
        ]);
    }

    private function creerPaiement(
        Facture $facture,
        string $moyen,
        string $statut,
        ?string $reference,
        $payeLe = null,
    ): Paiement {
        return Paiement::create([
            'facture_id' => $facture->id,
            'user_id' => $facture->user_id,
            'montant' => $facture->montant_ttc,
            'moyen' => $moyen,
            'statut' => $statut,
            'reference' => $reference,
            'paye_le' => $payeLe,
            'enregistre_par' => Auth::id(),
            'enregistre_par_nom' => Auth::user()?->name,
        ]);
    }

    /**
     * Référence interne tenant lieu d'identifiant de transaction tant qu'aucun
     * prestataire n'est branché.
     */
    private function referenceCarte(string $moyen): string
    {
        return strtoupper($moyen).'-'.strtoupper(Str::random(10));
    }
}
