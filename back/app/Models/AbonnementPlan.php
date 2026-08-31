<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Une formule d'abonnement du catalogue (Module 9).
 */
class AbonnementPlan extends Model
{
    use HasFactory;

    protected $fillable = [
        'nom',
        'description',
        'prix_mensuel',
        'remise_pourcent',
        'actif',
    ];

    protected $casts = [
        'prix_mensuel' => 'float',
        'remise_pourcent' => 'float',
        'actif' => 'boolean',
    ];

    public function abonnements(): HasMany
    {
        return $this->hasMany(Abonnement::class);
    }

    public function toFrontendArray(): array
    {
        return [
            'id' => (string) $this->id,
            'nom' => $this->nom,
            'description' => $this->description,
            'prixMensuel' => (float) $this->prix_mensuel,
            'remisePourcent' => (float) $this->remise_pourcent,
            'actif' => (bool) $this->actif,
            'abonnes' => $this->abonnements_count === null ? null : (int) $this->abonnements_count,
        ];
    }
}
