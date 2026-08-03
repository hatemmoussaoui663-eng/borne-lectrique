<?php

namespace Tests\Feature;

use App\Models\Borne;
use App\Models\ChargeSession;
use App\Models\Tarif;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OcppIngestTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'test-ocpp-internal-token';

    public function test_it_rejects_requests_without_the_internal_token(): void
    {
        $response = $this->postJson('/api/internal/ocpp/boot-notification', [
            'chargePointId' => 'CS-TEST-001',
        ]);

        $response->assertStatus(401);
        $this->assertDatabaseCount('bornes', 0);
    }

    public function test_boot_notification_auto_creates_a_borne(): void
    {
        $response = $this->withHeaders(['X-Internal-Token' => self::TOKEN])
            ->postJson('/api/internal/ocpp/boot-notification', [
                'chargePointId' => 'CS-TEST-001',
                'vendor' => 'Ovomaltin',
                'model' => 'Simulator simple',
                'firmwareVersion' => '1.0.0',
            ]);

        $response->assertOk();

        $borne = Borne::where('charge_point_id', 'CS-TEST-001')->firstOrFail();
        $this->assertSame('Disponible', $borne->status);
        $this->assertSame('Ovomaltin', $borne->fabricant);
        $this->assertNotNull($borne->last_heartbeat_at);
    }

    public function test_status_notification_updates_borne_and_connector_status(): void
    {
        $borne = Borne::factory()->create(['charge_point_id' => 'CS-TEST-002', 'status' => 'Disponible']);

        $response = $this->withHeaders(['X-Internal-Token' => self::TOKEN])
            ->postJson('/api/internal/ocpp/status-notification', [
                'chargePointId' => 'CS-TEST-002',
                'connectorId' => 1,
                'status' => 'Faulted',
            ]);

        $response->assertOk();

        $borne->refresh();
        $this->assertSame('Défaut', $borne->status);
        $this->assertSame('Défaut', $borne->connecteurs[0]['etat']);
    }

    public function test_start_and_stop_transaction_creates_and_closes_a_charge_session(): void
    {
        Borne::factory()->create(['charge_point_id' => 'CS-TEST-003']);

        $start = $this->withHeaders(['X-Internal-Token' => self::TOKEN])
            ->postJson('/api/internal/ocpp/start-transaction', [
                'chargePointId' => 'CS-TEST-003',
                'connectorId' => 1,
                'idTag' => 'BADGE-01',
                'meterStart' => 1000,
            ]);

        $start->assertOk()->assertJsonStructure(['transactionId']);
        $transactionId = $start->json('transactionId');

        $this->assertDatabaseHas('charge_sessions', [
            'id' => $transactionId,
            'id_tag' => 'BADGE-01',
            'status' => 'En cours',
        ]);

        $stop = $this->withHeaders(['X-Internal-Token' => self::TOKEN])
            ->postJson('/api/internal/ocpp/stop-transaction', [
                'transactionId' => $transactionId,
                'meterStop' => 3500,
            ]);

        $stop->assertOk();

        $session = ChargeSession::findOrFail($transactionId);
        $this->assertSame('Terminée', $session->status);
        $this->assertEquals(2.5, $session->energie_kwh);
        $this->assertNotNull($session->stopped_at);
        $this->assertEquals(round(2.5 * Tarif::current()->prix_kwh, 3), $session->prix);
    }

    public function test_start_transaction_links_the_session_to_the_user_owning_the_badge(): void
    {
        Borne::factory()->create(['charge_point_id' => 'CS-TEST-004']);
        $user = User::factory()->create(['badge_rfid' => 'BADGE-42']);

        $start = $this->withHeaders(['X-Internal-Token' => self::TOKEN])
            ->postJson('/api/internal/ocpp/start-transaction', [
                'chargePointId' => 'CS-TEST-004',
                'connectorId' => 1,
                'idTag' => 'BADGE-42',
                'meterStart' => 0,
            ]);

        $start->assertOk();

        $session = ChargeSession::findOrFail($start->json('transactionId'));
        $this->assertSame($user->id, $session->user_id);
    }
}
