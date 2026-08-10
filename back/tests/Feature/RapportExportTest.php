<?php

namespace Tests\Feature;

use App\Models\Borne;
use App\Models\ChargeSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RapportExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_exports_sessions_as_csv(): void
    {
        $admin = User::factory()->create();
        $borne = Borne::factory()->create(['name' => 'Borne Export']);
        ChargeSession::factory()->create([
            'borne_id' => $borne->id,
            'connector_id' => 1,
            'status' => 'Terminée',
            'energie_kwh' => 1.5,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->get('/api/rapports/export');

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('Borne Export', $response->streamedContent());
    }
}
