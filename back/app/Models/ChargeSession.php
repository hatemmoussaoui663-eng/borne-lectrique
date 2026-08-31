<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ChargeSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'borne_id',
        'connector_id',
        'id_tag',
        'user_id',
        'meter_start',
        'meter_stop',
        'energie_kwh',
        'prix',
        'status',
        'started_at',
        'stopped_at',
    ];

    protected $casts = [
        'energie_kwh' => 'float',
        'prix' => 'float',
        'started_at' => 'datetime',
        'stopped_at' => 'datetime',
    ];

    public function borne(): BelongsTo
    {
        return $this->belongsTo(Borne::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** La facture émise pour cette session (Module 9), s'il y en a une. */
    public function facture(): HasOne
    {
        return $this->hasOne(Facture::class);
    }

    /**
     * Map to the shape the React app's `ChargeSession` type expects: `id`, `borne`,
     * `connecteur`, `idTag`, `utilisateur`, `debut`, `fin`, `dureeMin`, `energieKwh`,
     * `prix`, `etat`.
     */
    public function toFrontendArray(): array
    {
        $end = $this->stopped_at ?? now();
        $dureeMin = $this->started_at ? (int) round($this->started_at->diffInSeconds($end) / 60) : 0;

        return [
            'id' => (string) $this->id,
            'borne' => $this->borne?->name ?? '',
            'connecteur' => (string) $this->connector_id,
            'idTag' => $this->id_tag ?? '',
            'utilisateur' => $this->user?->name,
            'debut' => $this->started_at ? $this->started_at->toDateTimeString() : null,
            'fin' => $this->stopped_at ? $this->stopped_at->toDateTimeString() : null,
            'dureeMin' => $dureeMin,
            'energieKwh' => (float) $this->energie_kwh,
            'prix' => (float) ($this->prix ?? 0),
            'etat' => $this->status,
        ];
    }
}
