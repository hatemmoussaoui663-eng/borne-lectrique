<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Borne extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'charge_point_id',
        'reference',
        'numero_serie',
        'modele',
        'fabricant',
        'adresse',
        'ville',
        'status',
        'latitude',
        'longitude',
        'puissance',
        'ocpp',
        'firmware',
        'connecteurs',
        'last_heartbeat_at',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'connecteurs' => 'array',
        'last_heartbeat_at' => 'datetime',
    ];

    public function chargeSessions(): HasMany
    {
        return $this->hasMany(ChargeSession::class);
    }

    /** Notices, photos, contrats, plans et garanties de la borne (Module 16). */
    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    /**
     * Map to the shape the React app expects: `id`, `nom`, `reference`, `numeroSerie`,
     * `modele`, `fabricant`, `adresse`, `ville`, `lat`, `lng`, `firmware`, `ocpp`,
     * `puissance`, `etat`, `dernierHeartbeat`, `connecteurs`.
     */
    public function toFrontendArray(): array
    {
        $heartbeat = $this->last_heartbeat_at ?? $this->updated_at;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'nom' => $this->name,
            'reference' => $this->reference ?? '',
            'numeroSerie' => $this->numero_serie ?? '',
            'modele' => $this->modele ?? '',
            'fabricant' => $this->fabricant ?? '',
            'adresse' => $this->adresse ?? '',
            'ville' => $this->ville ?? '',
            'lat' => $this->latitude !== null ? (float) $this->latitude : 0,
            'lng' => $this->longitude !== null ? (float) $this->longitude : 0,
            'latitude' => $this->latitude !== null ? (float) $this->latitude : null,
            'longitude' => $this->longitude !== null ? (float) $this->longitude : null,
            'firmware' => $this->firmware ?? '',
            'ocpp' => $this->ocpp ?? '1.6',
            'puissance' => $this->puissance ?? 22,
            'status' => $this->status ?? 'inactive',
            'etat' => $this->status ?? 'Déconnectée',
            'dernierHeartbeat' => $heartbeat ? $heartbeat->toDateTimeString() : null,
            'connecteurs' => $this->connecteurs ?? [],
            'created_at' => $this->created_at ? $this->created_at->toDateTimeString() : null,
            'updated_at' => $this->updated_at ? $this->updated_at->toDateTimeString() : null,
        ];
    }
}
