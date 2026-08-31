<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un règlement (ou son remboursement) sur une facture (Module 9).
 */
class Paiement extends Model
{
    use HasFactory;

    public const MOYEN_CARTE = 'carte';
    public const MOYEN_WALLET = 'wallet';
    public const MOYEN_ABONNEMENT = 'abonnement';
    public const MOYEN_DIFFERE = 'differe';

    public const MOYENS = [
        self::MOYEN_CARTE,
        self::MOYEN_WALLET,
        self::MOYEN_ABONNEMENT,
        self::MOYEN_DIFFERE,
    ];

    public const STATUT_EN_ATTENTE = 'en_attente';
    public const STATUT_PAYE = 'paye';
    public const STATUT_ECHOUE = 'echoue';
    public const STATUT_REMBOURSE = 'rembourse';

    protected $fillable = [
        'facture_id',
        'user_id',
        'montant',
        'moyen',
        'statut',
        'reference',
        'paye_le',
        'rembourse_le',
        'motif_remboursement',
        'enregistre_par',
        'enregistre_par_nom',
    ];

    protected $casts = [
        'montant' => 'float',
        'paye_le' => 'datetime',
        'rembourse_le' => 'datetime',
    ];

    public function facture(): BelongsTo
    {
        return $this->belongsTo(Facture::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function toFrontendArray(): array
    {
        return [
            'id' => (string) $this->id,
            'factureId' => (string) $this->facture_id,
            'montant' => (float) $this->montant,
            'moyen' => $this->moyen,
            'statut' => $this->statut,
            'reference' => $this->reference,
            'payeLe' => $this->paye_le?->toDateTimeString(),
            'rembourseLe' => $this->rembourse_le?->toDateTimeString(),
            'motifRemboursement' => $this->motif_remboursement,
            'enregistrePar' => $this->enregistre_par_nom,
            'remboursable' => $this->statut === self::STATUT_PAYE,
        ];
    }
}
