<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un mouvement de porte-monnaie (Module 9). Table en ajout seul : un mouvement
 * se corrige par un mouvement inverse, jamais par une modification.
 */
class WalletTransaction extends Model
{
    public const TYPE_CREDIT = 'credit';
    public const TYPE_DEBIT = 'debit';

    public const UPDATED_AT = null;

    protected $fillable = [
        'wallet_id',
        'type',
        'montant',
        'solde_apres',
        'motif',
        'facture_id',
        'effectue_par',
        'annule_par_id',
    ];

    protected $casts = [
        'montant' => 'float',
        'solde_apres' => 'float',
        'created_at' => 'datetime',
    ];

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class);
    }

    /** Le débit qui contre-passe ce rechargement, s'il a été annulé. */
    public function annulePar(): BelongsTo
    {
        return $this->belongsTo(self::class, 'annule_par_id');
    }

    /** Un rechargement déjà annulé ne peut pas l'être une seconde fois. */
    public function estAnnule(): bool
    {
        return $this->annule_par_id !== null;
    }

    /** Seul un rechargement encore actif se prête à une annulation. */
    public function estAnnulable(): bool
    {
        return $this->type === self::TYPE_CREDIT && ! $this->estAnnule();
    }

    public function toFrontendArray(): array
    {
        return [
            'id' => (string) $this->id,
            'type' => $this->type,
            'montant' => (float) $this->montant,
            'soldeApres' => (float) $this->solde_apres,
            'motif' => $this->motif,
            'factureId' => $this->facture_id === null ? null : (string) $this->facture_id,
            'annule' => $this->estAnnule(),
            'annulable' => $this->estAnnulable(),
            'date' => $this->created_at?->toDateTimeString(),
        ];
    }
}
