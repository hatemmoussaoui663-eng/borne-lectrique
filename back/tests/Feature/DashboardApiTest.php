<?php

namespace Tests\Feature;

use App\Models\Borne;
use App\Models\ChargeSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_returns_aggregated_kpis(): void
    {
        $user = User::factory()->create();
        Borne::factory()->create(['status' => 'Disponible']);
        Borne::factory()->create(['status' => 'Défaut']);
        $borne = Borne::factory()->create(['status' => 'Occupée']);

        ChargeSession::factory()->create([
            'borne_id' => $borne->id,
            'started_at' => now()->subMinutes(30),
            'stopped_at' => now(),
            'energie_kwh' => 5,
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/dashboard');

        $response->assertOk();
        $response->assertJson([
            'totalBornes' => 3,
            'bornesActives' => 2,
            'bornesIndisponibles' => 1,
            'sessionsAujourdhui' => 1,
            'kwhDelivres' => 5.0,
        ]);
        $response->assertJsonStructure([
            'consumptionSeries' => ['days', 'kwh'],
        ]);
        $this->assertCount(7, $response->json('consumptionSeries.days'));
    }
}
