<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * Carte bancaire saisie par un client, le temps d'une autorisation simulée
 * (Module 9).
 *
 * L'objet ne vit que pendant la requête. Rien de ce qu'il porte n'est
 * persistable tel quel : le numéro complet et le cryptogramme ne doivent
 * jamais atteindre la base — voir donneesStockables(), qui est la seule
 * façon prévue d'en tirer quelque chose de durable.
 */
class CarteBancaire
{
    /** Chiffres seuls, séparateurs de saisie retirés. */
    private readonly string $chiffres;

    public function __construct(
        string $numero,
        private readonly string $titulaire,
        private readonly int $moisExpiration,
        private readonly int $anneeExpiration,
    ) {
        $this->chiffres = preg_replace('/\D/', '', $numero) ?? '';
    }

    /**
     * Somme de contrôle de Luhn : détecte les fautes de frappe et les chiffres
     * intervertis, que toutes les cartes réelles satisfont.
     */
    public function sommeDeControleValide(): bool
    {
        $longueur = strlen($this->chiffres);

        if ($longueur < 13 || $longueur > 19) {
            return false;
        }

        $total = 0;
        $double = false;

        for ($i = $longueur - 1; $i >= 0; $i--) {
            $chiffre = (int) $this->chiffres[$i];

            if ($double) {
                $chiffre *= 2;
                if ($chiffre > 9) {
                    $chiffre -= 9;
                }
            }

            $total += $chiffre;
            $double = ! $double;
        }

        return $total % 10 === 0;
    }

    /** Banque émettrice, ou null si le BIN n'est pas dans la table tunisienne. */
    public function banque(): ?string
    {
        return config('cartes.bins')[$this->bin()] ?? null;
    }

    public function estTunisienne(): bool
    {
        return $this->banque() !== null;
    }

    /**
     * Réseau, déduit du préfixe selon les plages publiques des schémas.
     */
    public function marque(): string
    {
        if (str_starts_with($this->chiffres, '4')) {
            return 'Visa';
        }

        $deux = (int) substr($this->chiffres, 0, 2);
        $quatre = (int) substr($this->chiffres, 0, 4);

        if (($deux >= 51 && $deux <= 55) || ($quatre >= 2221 && $quatre <= 2720)) {
            return 'Mastercard';
        }

        return 'Inconnue';
    }

    public function estExpiree(): bool
    {
        if ($this->moisExpiration < 1 || $this->moisExpiration > 12) {
            return true;
        }

        // Une carte reste valable jusqu'au dernier jour de son mois d'échéance.
        return CarbonImmutable::create($this->anneeExpiration, $this->moisExpiration, 1)
            ->endOfMonth()
            ->isPast();
    }

    public function bin(): string
    {
        return substr($this->chiffres, 0, 6);
    }

    public function dernier4(): string
    {
        return substr($this->chiffres, -4);
    }

    /** Numéro tel qu'il peut être affiché ou journalisé, sans jamais exposer le PAN. */
    public function masque(): string
    {
        return '**** **** **** '.$this->dernier4();
    }

    /**
     * Le sous-ensemble conservable en base : de quoi reconnaître la carte dans
     * un historique, jamais de quoi la rejouer. Le PAN complet et le
     * cryptogramme restent volontairement absents.
     *
     * @return array<string, mixed>
     */
    public function donneesStockables(): array
    {
        return [
            'titulaire' => $this->titulaire,
            'marque' => $this->marque(),
            'banque' => $this->banque(),
            'bin' => $this->bin(),
            'dernier4' => $this->dernier4(),
            'numero_masque' => $this->masque(),
            'mois_expiration' => $this->moisExpiration,
            'annee_expiration' => $this->anneeExpiration,
        ];
    }

    /** Carte de test dédiée à la démonstration du refus d'autorisation. */
    public function estCarteRefusee(): bool
    {
        return $this->chiffres === preg_replace('/\D/', '', (string) config('cartes.carte_refusee'));
    }
}
