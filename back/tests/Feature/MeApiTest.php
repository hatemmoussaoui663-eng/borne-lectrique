<?php

namespace Tests\Feature;

use App\Models\Borne;
use App\Models\ChargeSession;
use App\Models\User;
use App\Models\Vehicule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MeApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_only_returns_the_authenticated_users_own_sessions(): void
    {
        $me = User::factory()->create();
        $someoneElse = User::factory()->create();
        $borne = Borne::factory()->create();

        ChargeSession::factory()->create(['borne_id' => $borne->id, 'user_id' => $me->id]);
        ChargeSession::factory()->create(['borne_id' => $borne->id, 'user_id' => $someoneElse->id]);

        $response = $this->actingAs($me, 'sanctum')->getJson('/api/me/sessions');

        $response->assertOk()->assertJsonCount(1);
    }

    public function test_it_only_returns_the_authenticated_users_own_vehicules(): void
    {
        $me = User::factory()->create();
        $someoneElse = User::factory()->create();

        Vehicule::factory()->create(['user_id' => $me->id]);
        Vehicule::factory()->create(['user_id' => $someoneElse->id]);

        $response = $this->actingAs($me, 'sanctum')->getJson('/api/me/vehicules');

        $response->assertOk()->assertJsonCount(1);
    }

    public function test_it_creates_a_vehicule_owned_by_the_authenticated_user_regardless_of_payload(): void
    {
        $me = User::factory()->create();
        $someoneElse = User::factory()->create();

        $response = $this->actingAs($me, 'sanctum')->postJson('/api/me/vehicules', [
            'user_id' => $someoneElse->id, // attempted spoof, must be ignored
            'marque' => 'Renault',
            'modele' => 'Zoe',
            'immatriculation' => 'ME-VEHICULE-1',
            'connecteur_type' => 'Type2',
            'capacite_kwh' => 52,
        ]);

        $response->assertCreated();

        $vehicule = Vehicule::where('immatriculation', 'ME-VEHICULE-1')->firstOrFail();
        $this->assertSame($me->id, $vehicule->user_id);
    }

    public function test_it_forbids_updating_or_deleting_another_users_vehicule(): void
    {
        $me = User::factory()->create();
        $someoneElse = User::factory()->create();
        $vehicule = Vehicule::factory()->create(['user_id' => $someoneElse->id]);

        $this->actingAs($me, 'sanctum')
            ->putJson("/api/me/vehicules/{$vehicule->id}", [
                'marque' => 'Renault',
                'modele' => 'Zoe',
                'immatriculation' => $vehicule->immatriculation,
                'connecteur_type' => 'Type2',
                'capacite_kwh' => 52,
            ])
            ->assertForbidden();

        $this->actingAs($me, 'sanctum')
            ->deleteJson("/api/me/vehicules/{$vehicule->id}")
            ->assertForbidden();

        $this->assertNotNull(Vehicule::find($vehicule->id));
    }
}
