<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Souscription d'un client à une formule (Module 9).
 */
class Abonnement extends Model
{
    use HasFactory;

    public const STATUT_ACTIF = 'actif';
    public const STATUT_RESILIE = 'resilie';
    public const STATUT_EXPIRE = 'expire';

    protected $fillable = [
        'user_id',
        'abonnement_plan_id',
        'plan_nom',
        'prix_mensuel',
        'remise_pourcent',
        'statut',
        'debut',
        'fin',
    ];

    protected $casts = [
        'prix_mensuel' => 'float',
        'remise_pourcent' => 'float',
        'debut' => 'date',
        'fin' => 'date',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(AbonnementPlan::class, 'abonnement_plan_id');
    }

    /** Actif et non arrivé à échéance : seul cas où la remise s'applique. */
    public function estEnCours(): bool
    {
        return $this->statut === self::STATUT_ACTIF
            && ($this->fin === null || ! $this->fin->isPast());
    }

    public function toFrontendArray(): array
    {
        return [
            'id' => (string) $this->id,
            'userId' => (string) $this->user_id,
            'client' => $this->user?->name,
            'planId' => $this->abonnement_plan_id === null ? null : (string) $this->abonnement_plan_id,
            'plan' => $this->plan_nom,
            'prixMensuel' => (float) $this->prix_mensuel,
            'remisePourcent' => (float) $this->remise_pourcent,
            'statut' => $this->statut,
            'enCours' => $this->estEnCours(),
            'debut' => $this->debut?->toDateString(),
            'fin' => $this->fin?->toDateString(),
        ];
    }
}
