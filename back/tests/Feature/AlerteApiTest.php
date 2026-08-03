<?php

namespace Tests\Feature;

use App\Models\Alerte;
use App\Models\Borne;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AlerteApiTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'test-ocpp-internal-token';

    public function test_it_lists_alertes_for_an_authenticated_user(): void
    {
        $user = User::factory()->create();
        $borne = Borne::factory()->create(['name' => 'Borne Test']);
        Alerte::factory()->create(['borne_id' => $borne->id, 'message' => 'Défaut matériel']);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/alertes');

        $response->assertOk();
        $response->assertJsonFragment(['borne' => 'Borne Test', 'message' => 'Défaut matériel', 'lue' => false]);
    }

    public function test_it_marks_an_alerte_as_read(): void
    {
        $user = User::factory()->create();
        $alerte = Alerte::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->patchJson("/api/alertes/{$alerte->id}/read");

        $response->assertOk();
        $response->assertJsonFragment(['lue' => true]);
        $this->assertNotNull($alerte->fresh()->read_at);
    }

    public function test_a_faulted_status_notification_raises_an_alerte_once(): void
    {
        Borne::factory()->create(['charge_point_id' => 'CS-ALERT-001']);

        $this->withHeaders(['X-Internal-Token' => self::TOKEN])
            ->postJson('/api/internal/ocpp/status-notification', [
                'chargePointId' => 'CS-ALERT-001',
                'connectorId' => 1,
                'status' => 'Faulted',
            ])->assertOk();

        $this->assertDatabaseCount('alertes', 1);

        // A repeated Faulted notification while the first alert is still
        // unread must not create a duplicate.
        $this->withHeaders(['X-Internal-Token' => self::TOKEN])
            ->postJson('/api/internal/ocpp/status-notification', [
                'chargePointId' => 'CS-ALERT-001',
                'connectorId' => 1,
                'status' => 'Faulted',
            ])->assertOk();

        $this->assertDatabaseCount('alertes', 1);
    }
}
