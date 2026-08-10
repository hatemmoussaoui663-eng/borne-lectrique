<?php

namespace Database\Factories;

use App\Models\Vehicule;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Vehicule>
 */
class VehiculeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => null,
            'marque' => $this->faker->randomElement(['Renault', 'Peugeot', 'Tesla', 'Kia', 'Volvo']),
            'modele' => $this->faker->word(),
            'immatriculation' => strtoupper($this->faker->bothify('###TU####')),
            'connecteur_type' => $this->faker->randomElement(['CCS', 'Type2', 'CHAdeMO', 'AC', 'DC']),
            'capacite_kwh' => $this->faker->numberBetween(30, 100),
        ];
    }
}
