<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SimulatorApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_returns_simulator_status_from_ui_server(): void
    {
        Http::fake([
            'http://127.0.0.1:8080/ui/0.0.1/simulatorState' => Http::response([
                'status' => 'success',
                'state' => ['running' => true],
            ], 200),
        ]);

        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/simulator/status');

        $response->assertOk()
            ->assertJson([
                'connected' => true,
                'status' => 'success',
                'state' => ['running' => true],
            ]);
    }
}
