<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Vehicule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VehiculeApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_lists_creates_updates_and_deletes_a_vehicule(): void
    {
        $admin = User::factory()->create();
        $owner = User::factory()->create();

        $create = $this->actingAs($admin, 'sanctum')->postJson('/api/vehicules', [
            'user_id' => $owner->id,
            'marque' => 'Tesla',
            'modele' => 'Model 3',
            'immatriculation' => '123TU4567',
            'connecteur_type' => 'CCS',
            'capacite_kwh' => 75,
        ]);

        $create->assertCreated()->assertJson([
            'proprietaire' => $owner->name,
            'marque' => 'Tesla',
            'immatriculation' => '123TU4567',
        ]);

        $id = $create->json('id');

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/vehicules')
            ->assertOk()
            ->assertJsonCount(1);

        $update = $this->actingAs($admin, 'sanctum')->putJson("/api/vehicules/{$id}", [
            'marque' => 'Tesla',
            'modele' => 'Model Y',
            'immatriculation' => '123TU4567',
            'connecteur_type' => 'CCS',
            'capacite_kwh' => 80,
        ]);
        $update->assertOk()->assertJson(['modele' => 'Model Y', 'capaciteKwh' => 80]);

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/vehicules/{$id}")
            ->assertOk();

        $this->assertSame(0, Vehicule::count());
    }

    public function test_it_rejects_a_duplicate_immatriculation(): void
    {
        $admin = User::factory()->create();
        Vehicule::factory()->create(['immatriculation' => 'DUPLICATE-1']);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/vehicules', [
            'marque' => 'Kia',
            'modele' => 'Niro',
            'immatriculation' => 'DUPLICATE-1',
            'connecteur_type' => 'AC',
            'capacite_kwh' => 60,
        ]);

        $response->assertStatus(422);
    }
}
