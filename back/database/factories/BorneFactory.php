<?php

namespace Database\Factories;

use App\Models\Borne;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Borne>
 */
class BorneFactory extends Factory
{
    protected $model = Borne::class;

    public function definition(): array
    {
        return [
            'name' => fake()->words(2, true),
            'status' => 'Disponible',
            'ocpp' => '1.6',
            'puissance' => 22,
            'connecteurs' => [],
        ];
    }
}
