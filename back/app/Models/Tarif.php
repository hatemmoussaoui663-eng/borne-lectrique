<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Tarif extends Model
{
    protected $fillable = [
        'prix_kwh',
        'tva_taux',
    ];

    protected $casts = [
        'prix_kwh' => 'float',
        'tva_taux' => 'float',
    ];

    /**
     * The single active tariff applied to every session at StopTransaction.
     * There is intentionally only ever one row (id=1, seeded by the
     * `create_tarifs_table` migration).
     */
    public static function current(): self
    {
        return self::firstOrCreate(['id' => 1], ['prix_kwh' => 0.35, 'tva_taux' => 19.00]);
    }

    public function toFrontendArray(): array
    {
        return [
            'prixKwh' => (float) $this->prix_kwh,
            'tvaTaux' => (float) $this->tva_taux,
        ];
    }
}
