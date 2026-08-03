<?php

namespace Database\Factories;

use App\Models\Alerte;
use App\Models\Borne;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Alerte>
 */
class AlerteFactory extends Factory
{
    protected $model = Alerte::class;

    public function definition(): array
    {
        return [
            'borne_id' => Borne::factory(),
            'connector_id' => 1,
            'type' => 'defaut_materiel',
            'severite' => 'critical',
            'message' => fake()->sentence(),
        ];
    }
}
