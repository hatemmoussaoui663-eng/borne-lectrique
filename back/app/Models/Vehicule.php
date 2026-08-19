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
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
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
        ];
    }
}
