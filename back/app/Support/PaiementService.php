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
    /**
     * Règle une facture sur le porte-monnaie, mais seulement si le solde y
     * suffit.
     *
     * Sert la recharge prépayée : une session close débite aussitôt le
     * porte-monnaie du client. Le silence en cas de solde insuffisant est
     * volontaire — la facture reste alors impayée et sera soldée au prochain
     * rechargement, plutôt que de faire échouer la clôture de session.
     */
    public function reglerDepuisWalletSiPossible(Facture $facture): ?Paiement
    {
        if ($facture->statut !== Facture::STATUT_IMPAYEE || $facture->user === null) {
            return null;
        }

        if (Wallet::pour($facture->user)->fresh()->solde < (float) $facture->montant_ttc) {
            return null;
        }

        return $this->regler($facture, Paiement::MOYEN_WALLET);
    }

    /**
     * Solde les factures impayées d'un client, de la plus ancienne à la plus
     * récente, tant que le porte-monnaie le permet.
     */
    public function reglerFacturesEnAttente(User $client): int
    {
        $reglees = 0;

        $impayees = Facture::where('user_id', $client->id)
            ->where('statut', Facture::STATUT_IMPAYEE)
            ->orderBy('id')
            ->get();

        foreach ($impayees as $facture) {
            // Le solde est relu à chaque tour par reglerDepuisWalletSiPossible :
            // il vient de baisser du montant de la facture précédente.
            if ($this->reglerDepuisWalletSiPossible($facture) === null) {
                break;
            }

            $reglees++;
        }

        return $reglees;
    }

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

    /**
     * Retrait du porte-monnaie : correction d'un rechargement erroné, ou tout
     * ajustement décidé au back-office.
     *
     * @throws RuntimeException si le solde est insuffisant
     */
    public function debiter(User $client, float $montant, string $motif): WalletTransaction
    {
        if ($montant <= 0) {
            throw new RuntimeException('Le montant doit être positif.');
        }

        return DB::transaction(fn () => $this->retirer($client, $montant, $motif));
    }

    /**
     * Contre-passe un rechargement saisi par erreur.
     *
     * Le mouvement d'origine n'est ni effacé ni modifié : on lui oppose un
     * débit du même montant, et il est marqué comme annulé. Supprimer la ligne
     * ferait diverger le solde de son historique — sur de l'argent client,
     * c'est précisément ce qu'un journal doit rendre impossible.
     *
     * @throws RuntimeException si le mouvement n'est pas annulable ou le solde insuffisant
     */
    public function annulerRechargement(WalletTransaction $transaction, ?string $motif = null): WalletTransaction
    {
        if ($transaction->type !== WalletTransaction::TYPE_CREDIT) {
            throw new RuntimeException(
                "Seul un rechargement s'annule ; un débit se corrige par un nouveau rechargement."
            );
        }

        if ($transaction->estAnnule()) {
            throw new RuntimeException('Ce rechargement a déjà été annulé.');
        }

        $client = $transaction->wallet?->user;

        if ($client === null) {
            throw new RuntimeException("Ce mouvement n'est rattaché à aucun client.");
        }

        return DB::transaction(function () use ($transaction, $client, $motif) {
            $correction = $this->retirer(
                $client,
                (float) $transaction->montant,
                $motif ?: "Annulation du rechargement « {$transaction->motif} »",
                messageErreur: 'Annulation impossible : le solde a déjà été dépensé '
                    .'(%.3f DT disponibles pour un rechargement de %.3f DT). '
                    .'Corrigez le solde à la main du montant réellement récupérable.',
            );

            // `saveQuietly` : ce champ ne fait que pointer vers la correction,
            // il ne modifie ni le montant ni le motif d'origine.
            $transaction->annule_par_id = $correction->id;
            $transaction->saveQuietly();

            return $correction;
        });
    }

    /** @throws RuntimeException si le client n'a pas de compte ou pas assez de solde */
    private function debiterWallet(Facture $facture): void
    {
        $client = $facture->user;

        if ($client === null) {
            throw new RuntimeException("Cette facture n'est rattachée à aucun client : paiement par wallet impossible.");
        }

        $this->retirer(
            $client,
            (float) $facture->montant_ttc,
            "Paiement de la facture {$facture->numero}",
            $facture->id,
            'Solde insuffisant : %.3f DT disponibles pour une facture de %.3f DT.',
        );
    }

    /**
     * Cœur commun de tous les retraits : verrou de ligne, contrôle du solde,
     * écriture du mouvement. Le verrou est ce qui empêche deux retraits
     * simultanés de lire le même solde de départ et d'en dépenser un de trop.
     *
     * @throws RuntimeException si le solde est insuffisant
     */
    private function retirer(
        User $client,
        float $montant,
        string $motif,
        ?int $factureId = null,
        string $messageErreur = 'Solde insuffisant : %.3f DT disponibles pour un retrait de %.3f DT.',
    ): WalletTransaction {
        $wallet = Wallet::pour($client);
        $wallet = Wallet::whereKey($wallet->id)->lockForUpdate()->first();

        // Marge de 0,0005 : les montants sont au millime, une comparaison
        // flottante stricte refuserait un retrait du solde exact.
        if ($wallet->solde + 0.0005 < $montant) {
            throw new RuntimeException(sprintf($messageErreur, $wallet->solde, $montant));
        }

        $wallet->solde = round($wallet->solde - $montant, 3);
        $wallet->save();

        return WalletTransaction::create([
            'wallet_id' => $wallet->id,
            'type' => WalletTransaction::TYPE_DEBIT,
            'montant' => round($montant, 3),
            'solde_apres' => $wallet->solde,
            'motif' => $motif,
            'facture_id' => $factureId,
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
