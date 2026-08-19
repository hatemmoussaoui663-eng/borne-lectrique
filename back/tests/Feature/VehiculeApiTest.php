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
        $exploitant = User::factory()->asRole('exploitant')->create();
        $owner = User::factory()->create();

        $create = $this->actingAs($exploitant, 'sanctum')->postJson('/api/vehicules', [
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

        $this->actingAs($exploitant, 'sanctum')
            ->getJson('/api/vehicules')
            ->assertOk()
            ->assertJsonCount(1);

        $update = $this->actingAs($exploitant, 'sanctum')->putJson("/api/vehicules/{$id}", [
            'marque' => 'Tesla',
            'modele' => 'Model Y',
            'immatriculation' => '123TU4567',
            'connecteur_type' => 'CCS',
            'capacite_kwh' => 80,
        ]);
        $update->assertOk()->assertJson(['modele' => 'Model Y', 'capaciteKwh' => 80]);

        $this->actingAs($exploitant, 'sanctum')
            ->deleteJson("/api/vehicules/{$id}")
            ->assertOk();

        $this->assertSame(0, Vehicule::count());
    }

    public function test_it_rejects_a_duplicate_immatriculation(): void
    {
        $exploitant = User::factory()->asRole('exploitant')->create();
        Vehicule::factory()->create(['immatriculation' => 'DUPLICATE-1']);

        $response = $this->actingAs($exploitant, 'sanctum')->postJson('/api/vehicules', [
            'marque' => 'Kia',
            'modele' => 'Niro',
            'immatriculation' => 'DUPLICATE-1',
            'connecteur_type' => 'AC',
            'capacite_kwh' => 60,
        ]);

        $response->assertStatus(422);
    }

    /**
     * Vehicle management is an Exploitant task — Admin's usual "full access
     * everywhere" is deliberately not extended here (see VehiculeController).
     */
    public function test_super_admin_has_read_only_access_to_vehicules(): void
    {
        $admin = User::factory()->create();
        $vehicule = Vehicule::factory()->create(['modele' => 'Zoe']);

        $this->actingAs($admin, 'sanctum')->getJson('/api/vehicules')->assertOk();

        $this->actingAs($admin, 'sanctum')->postJson('/api/vehicules', [
            'marque' => 'Kia',
            'modele' => 'Niro',
            'immatriculation' => 'ADMIN-BLOCK',
            'connecteur_type' => 'AC',
            'capacite_kwh' => 60,
        ])->assertForbidden();

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/vehicules/{$vehicule->id}", [
                'marque' => $vehicule->marque,
                'modele' => 'Renamed',
                'immatriculation' => $vehicule->immatriculation,
                'connecteur_type' => $vehicule->connecteur_type,
                'capacite_kwh' => $vehicule->capacite_kwh,
            ])
            ->assertForbidden();

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/vehicules/{$vehicule->id}")
            ->assertForbidden();

        $this->assertModelExists($vehicule);
        $this->assertSame('Zoe', $vehicule->fresh()->modele);
        $this->assertDatabaseMissing('vehicules', ['immatriculation' => 'ADMIN-BLOCK']);
    }
}
