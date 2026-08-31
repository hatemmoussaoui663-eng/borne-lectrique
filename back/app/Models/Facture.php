<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Facture émise pour une session de recharge (Module 9).
 */
class Facture extends Model
{
    use HasFactory;

    public const STATUT_IMPAYEE = 'impayee';
    public const STATUT_PAYEE = 'payee';
    public const STATUT_REMBOURSEE = 'remboursee';
    public const STATUT_ANNULEE = 'annulee';

    public const STATUTS = [
        self::STATUT_IMPAYEE,
        self::STATUT_PAYEE,
        self::STATUT_REMBOURSEE,
        self::STATUT_ANNULEE,
    ];

    protected $fillable = [
        'numero',
        'user_id',
        'user_nom',
        'charge_session_id',
        'montant_ht',
        'remise_pourcent',
        'montant_remise',
        'tva_taux',
        'montant_tva',
        'montant_ttc',
        'statut',
        'echeance',
        'emise_le',
    ];

    protected $casts = [
        'montant_ht' => 'float',
        'remise_pourcent' => 'float',
        'montant_remise' => 'float',
        'tva_taux' => 'float',
        'montant_tva' => 'float',
        'montant_ttc' => 'float',
        'echeance' => 'date',
        'emise_le' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function chargeSession(): BelongsTo
    {
        return $this->belongsTo(ChargeSession::class);
    }

    public function paiements(): HasMany
    {
        return $this->hasMany(Paiement::class);
    }

    /** Impayée dont l'échéance est passée — le « paiement différé » en retard. */
    public function estEnRetard(): bool
    {
        return $this->statut === self::STATUT_IMPAYEE
            && $this->echeance !== null
            && $this->echeance->isPast();
    }

    public function toFrontendArray(): array
    {
        return [
            'id' => (string) $this->id,
            'numero' => $this->numero,
            'userId' => $this->user_id === null ? null : (string) $this->user_id,
            'client' => $this->user_nom,
            'sessionId' => $this->charge_session_id === null ? null : (string) $this->charge_session_id,
            'borne' => $this->chargeSession?->borne?->name,
            'energieKwh' => $this->chargeSession?->energie_kwh === null
                ? null
                : (float) $this->chargeSession->energie_kwh,
            'montantHt' => (float) $this->montant_ht,
            'remisePourcent' => (float) $this->remise_pourcent,
            'montantRemise' => (float) $this->montant_remise,
            'tvaTaux' => (float) $this->tva_taux,
            'montantTva' => (float) $this->montant_tva,
            'montantTtc' => (float) $this->montant_ttc,
            'statut' => $this->statut,
            'echeance' => $this->echeance?->toDateString(),
            'enRetard' => $this->estEnRetard(),
            'emiseLe' => $this->emise_le?->toDateTimeString(),
            'paiements' => $this->relationLoaded('paiements')
                ? $this->paiements->map->toFrontendArray()->values()->all()
                : null,
        ];
    }
}
