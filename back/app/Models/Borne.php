<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Borne extends Model
{
    protected $fillable = [
        'name',
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
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'connecteurs' => 'array',
    ];
}
