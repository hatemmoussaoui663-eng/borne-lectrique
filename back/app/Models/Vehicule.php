<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Vehicule extends Model
{
    /** @use HasFactory<\Database\Factories\VehiculeFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id',
        'marque',
        'modele',
        'immatriculation',
        'connecteur_type',
        'capacite_kwh',
        'latitude',
        'longitude',
        'position_precision_m',
        'position_maj_le',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'position_precision_m' => 'integer',
        'position_maj_le' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /** Historique des recharges de ce véhicule (§8). */
    public function chargeSessions()
    {
        return $this->hasMany(ChargeSession::class);
    }

    public function toFrontendArray(): array
    {
        return [
            'id' => (string) $this->id,
            'proprietaire' => $this->user?->name ?? '',
            'badge' => $this->user?->badge?->code ?? null,
            'marque' => $this->marque,
            'modele' => $this->modele,
            'immatriculation' => $this->immatriculation,
            'connecteur' => $this->connecteur_type,
            'capaciteKwh' => (int) $this->capacite_kwh,
            // §8 « Historique recharges » : renseigné quand le contrôleur charge
            // les agrégats (withCount / withSum), absent sinon.
            'recharges' => $this->charge_sessions_count === null ? null : [
                'nombre' => (int) $this->charge_sessions_count,
                'energieKwh' => round((float) ($this->charge_sessions_sum_energie_kwh ?? 0), 3),
                'coutDt' => round((float) ($this->charge_sessions_sum_prix ?? 0), 3),
            ],
            // Suivi GPS : nul tant que le véhicule n'a jamais émis de position.
            'position' => $this->latitude === null || $this->longitude === null ? null : [
                'lat' => (float) $this->latitude,
                'lng' => (float) $this->longitude,
                'precisionM' => $this->position_precision_m,
                'majLe' => $this->position_maj_le?->toDateTimeString(),
            ],
        ];
    }
}
