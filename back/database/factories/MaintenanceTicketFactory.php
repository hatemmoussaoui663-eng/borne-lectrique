<?php

namespace Database\Factories;

use App\Models\Borne;
use App\Models\MaintenanceTicket;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MaintenanceTicket>
 */
class MaintenanceTicketFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'borne_id' => Borne::factory(),
            'titre' => $this->faker->sentence(4),
            'priorite' => $this->faker->randomElement(['Basse', 'Moyenne', 'Haute', 'Critique']),
            'statut' => $this->faker->randomElement(['Ouvert', 'Planifié', 'En cours', 'Résolu']),
            'technicien_id' => null,
            'pieces_remplacees' => [],
        ];
    }
}
