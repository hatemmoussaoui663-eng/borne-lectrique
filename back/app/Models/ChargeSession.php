<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChargeSession extends Model
{
    protected $fillable = [
        'borne_id',
        'connector_id',
        'id_tag',
        'meter_start',
        'meter_stop',
        'energie_kwh',
        'status',
        'started_at',
        'stopped_at',
    ];

    protected $casts = [
        'energie_kwh' => 'float',
        'started_at' => 'datetime',
        'stopped_at' => 'datetime',
    ];

    public function borne(): BelongsTo
    {
        return $this->belongsTo(Borne::class);
    }

    /**
     * Map to the shape the React app's `ChargeSession` type expects: `id`, `borne`,
     * `connecteur`, `idTag`, `debut`, `fin`, `dureeMin`, `energieKwh`, `etat`.
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
            'debut' => $this->started_at ? $this->started_at->toDateTimeString() : null,
            'fin' => $this->stopped_at ? $this->stopped_at->toDateTimeString() : null,
            'dureeMin' => $dureeMin,
            'energieKwh' => (float) $this->energie_kwh,
            'etat' => $this->status,
        ];
    }
}
