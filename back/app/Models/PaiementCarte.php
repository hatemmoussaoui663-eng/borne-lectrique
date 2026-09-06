<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Trace d'un rechargement par carte (Module 9). L'empreinte de carte qu'elle
 * porte est volontairement incomplète : voir CarteBancaire::donneesStockables.
 */
class PaiementCarte extends Model
{
    use HasFactory;

    protected $table = 'paiements_carte';

    public const STATUT_ACCEPTE = 'accepte';

    public const STATUT_REFUSE = 'refuse';

    protected $fillable = [
        'user_id',
        'reference',
        'montant',
        'titulaire',
        'marque',
        'banque',
        'bin',
        'dernier4',
        'numero_masque',
        'mois_expiration',
        'annee_expiration',
        'statut',
        'motif_refus',
        'wallet_transaction_id',
    ];

    protected $casts = [
        'montant' => 'float',
        'mois_expiration' => 'integer',
        'annee_expiration' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function walletTransaction(): BelongsTo
    {
        return $this->belongsTo(WalletTransaction::class);
    }

    public function toFrontendArray(): array
    {
        return [
            'id' => (string) $this->id,
            'reference' => $this->reference,
            'montant' => (float) $this->montant,
            'titulaire' => $this->titulaire,
            'marque' => $this->marque,
            'banque' => $this->banque,
            'numeroMasque' => $this->numero_masque,
            'expiration' => sprintf('%02d/%d', $this->mois_expiration, $this->annee_expiration),
            'statut' => $this->statut,
            'motifRefus' => $this->motif_refus,
            'effectueLe' => $this->created_at?->toDateTimeString(),
        ];
    }
}
