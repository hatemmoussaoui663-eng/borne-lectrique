<?php

namespace App\Support;

use App\Models\ChargeSession;
use App\Models\Facture;
use App\Models\Tarif;
use Illuminate\Support\Facades\DB;

/**
 * Émission des factures à partir des sessions de recharge (Module 9).
 */
class FacturationService
{
    /**
     * Émet la facture d'une session terminée, ou rend celle qui existe déjà.
     *
     * Rend `null` quand il n'y a rien à facturer : session encore en cours, ou
     * badge non rattaché à un client. C'est le cas de toutes les sessions du
     * simulateur, dont les idTags ne correspondent à aucun compte — les
     * facturer produirait des pièces comptables sans destinataire.
     */
    public function emettrePourSession(ChargeSession $session, ?int $joursEcheance = null): ?Facture
    {
        if ($session->status !== 'Terminée' || $session->user_id === null) {
            return null;
        }

        $existante = Facture::where('charge_session_id', $session->id)->first();
        if ($existante !== null) {
            return $existante;
        }

        $client = $session->user;
        $tarif = Tarif::current();
        $abonnement = $client?->abonnementEnCours();
        $remise = $abonnement?->remise_pourcent ?? 0.0;

        $montantHt = round((float) ($session->prix ?? 0), 3);
        $montantRemise = round($montantHt * $remise / 100, 3);
        $baseTva = round($montantHt - $montantRemise, 3);
        $montantTva = round($baseTva * $tarif->tva_taux / 100, 3);

        // `create` dans une transaction : le numéro est calculé à partir du
        // dernier émis, deux sessions clôturées en même temps pourraient sinon
        // réclamer le même.
        return DB::transaction(function () use (
            $session, $client, $tarif, $montantHt, $remise, $montantRemise, $baseTva, $montantTva, $joursEcheance
        ) {
            return Facture::create([
                'numero' => $this->prochainNumero(),
                'user_id' => $client?->id,
                'user_nom' => $client?->name ?? 'Client inconnu',
                'charge_session_id' => $session->id,
                'montant_ht' => $montantHt,
                'remise_pourcent' => $remise,
                'montant_remise' => $montantRemise,
                'tva_taux' => $tarif->tva_taux,
                'montant_tva' => $montantTva,
                'montant_ttc' => round($baseTva + $montantTva, 3),
                'statut' => Facture::STATUT_IMPAYEE,
                'echeance' => $joursEcheance === null ? null : now()->addDays($joursEcheance)->toDateString(),
                'emise_le' => now(),
            ]);
        });
    }

    /**
     * Rattrape les sessions terminées et facturables qui n'ont pas encore de
     * facture — celles d'avant la mise en service du module, notamment.
     *
     * @return array{emises: int, ignorees: int}
     */
    public function emettreLesManquantes(?int $joursEcheance = null): array
    {
        $sessions = ChargeSession::where('status', 'Terminée')
            ->whereNotNull('user_id')
            ->whereDoesntHave('facture')
            ->get();

        $emises = 0;

        foreach ($sessions as $session) {
            if ($this->emettrePourSession($session, $joursEcheance) !== null) {
                $emises++;
            }
        }

        return ['emises' => $emises, 'ignorees' => $sessions->count() - $emises];
    }

    /** Numérotation continue par année : FAC-2026-000001. */
    private function prochainNumero(): string
    {
        $annee = now()->format('Y');
        $prefixe = "FAC-{$annee}-";

        $dernier = Facture::where('numero', 'like', $prefixe.'%')
            ->orderByDesc('numero')
            ->value('numero');

        $suivant = $dernier === null ? 1 : ((int) substr($dernier, strlen($prefixe))) + 1;

        return $prefixe.str_pad((string) $suivant, 6, '0', STR_PAD_LEFT);
    }
}
