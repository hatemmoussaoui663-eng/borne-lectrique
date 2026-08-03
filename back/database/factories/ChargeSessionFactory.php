<?php

namespace Database\Factories;

use App\Models\Borne;
use App\Models\ChargeSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ChargeSession>
 */
class ChargeSessionFactory extends Factory
{
    protected $model = ChargeSession::class;

    public function definition(): array
    {
        return [
            'borne_id' => Borne::factory(),
            'connector_id' => 1,
            'id_tag' => fake()->bothify('BADGE-####'),
            'meter_start' => 0,
            'status' => 'En cours',
            'energie_kwh' => 0,
            'started_at' => now(),
        ];
    }
}
