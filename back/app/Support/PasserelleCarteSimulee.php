<?php

namespace App\Support;

use App\Models\PaiementCarte;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Passerelle de paiement simulée (Module 9).
 *
 * Elle joue le rôle d'un prestataire — autorisation, référence, acceptation ou
 * refus — sans qu'aucun argent ne circule ni qu'aucun appel sorte du serveur.
 * Le point de bascule vers un vrai PSP est `autoriser()` : c'est la seule
 * méthode à remplacer, les écritures comptables en aval restent identiques.
 */
class PasserelleCarteSimulee
{
    public function __construct(private readonly PaiementService $paiements)
    {
    }

    /**
     * Recharge le porte-monnaie du client par carte, puis solde ce qui peut
     * l'être.
     *
     * @return array{paiement: PaiementCarte, solde: float, facturesReglees: int}
     *
     * @throws RuntimeException si la carte est inexploitable (motif porté par le message)
     */
    public function recharger(User $client, CarteBancaire $carte, float $montant): array
    {
        $this->verifierMontant($montant);
        $refus = $this->autoriser($carte);

        if ($refus !== null) {
            // Un refus se trace comme une acceptation : sans cette ligne, un
            // client qui se plaint d'un débit absent ne laisserait aucune piste.
            $paiement = $this->tracer($client, $carte, $montant, PaiementCarte::STATUT_REFUSE, $refus);

            return [
                'paiement' => $paiement,
                'solde' => (float) Wallet::pour($client)->solde,
                'facturesReglees' => 0,
            ];
        }

        $paiement = DB::transaction(function () use ($client, $carte, $montant) {
            $ecriture = $this->paiements->crediter(
                $client,
                $montant,
                'Rechargement par carte '.$carte->masque(),
            );

            $paiement = $this->tracer($client, $carte, $montant, PaiementCarte::STATUT_ACCEPTE);
            $paiement->wallet_transaction_id = $ecriture->id;
            $paiement->save();

            return $paiement;
        });

        // Hors transaction : chaque facture a déjà la sienne, et un solde
        // insuffisant en cours de route doit arrêter le règlement sans annuler
        // le rechargement qui vient d'aboutir.
        $reglees = $this->reglerFacturesEnAttente($client);

        return [
            'paiement' => $paiement->fresh(),
            'solde' => (float) Wallet::pour($client)->fresh()->solde,
            'facturesReglees' => $reglees,
        ];
    }

    /**
     * Solde les factures impayées après un rechargement.
     *
     * La règle vit dans PaiementService : la clôture d'une session de charge
     * s'en sert aussi, et deux copies auraient fini par diverger.
     */
    public function reglerFacturesEnAttente(User $client): int
    {
        return $this->paiements->reglerFacturesEnAttente($client);
    }

    /**
     * Décision d'autorisation. Retourne le motif de refus, ou null si la carte
     * passe.
     */
    private function autoriser(CarteBancaire $carte): ?string
    {
        if (! $carte->sommeDeControleValide()) {
            return 'Numéro de carte invalide.';
        }

        if ($carte->estExpiree()) {
            return 'Carte expirée.';
        }

        if (! $carte->estTunisienne()) {
            return 'Seules les cartes émises par une banque tunisienne sont acceptées.';
        }

        if ($carte->estCarteRefusee()) {
            return 'Autorisation refusée par la banque émettrice.';
        }

        return null;
    }

    private function verifierMontant(float $montant): void
    {
        if ($montant <= 0) {
            throw new RuntimeException('Le montant doit être positif.');
        }

        if ($montant > (float) config('cartes.plafond_rechargement')) {
            throw new RuntimeException(
                'Le montant dépasse le plafond de '.config('cartes.plafond_rechargement').' DT par rechargement.'
            );
        }
    }

    private function tracer(
        User $client,
        CarteBancaire $carte,
        float $montant,
        string $statut,
        ?string $motifRefus = null,
    ): PaiementCarte {
        return PaiementCarte::create([
            'user_id' => $client->id,
            'reference' => 'CARTE-'.strtoupper(Str::random(12)),
            'montant' => round($montant, 3),
            'statut' => $statut,
            'motif_refus' => $motifRefus,
            ...$carte->donneesStockables(),
        ]);
    }
}
