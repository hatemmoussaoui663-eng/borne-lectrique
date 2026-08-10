<?php

namespace Tests\Feature;

use App\Models\Borne;
use App\Models\ChargeSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class OcppCommandApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_remote_start_forwards_to_the_central_system_and_returns_its_reply(): void
    {
        $admin = User::factory()->create();
        $borne = Borne::factory()->create(['charge_point_id' => 'CS-CMD-001']);

        Http::fake([
            'http://127.0.0.1:8010/commands/CS-CMD-001' => Http::response(['status' => 'Accepted']),
        ]);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/bornes/{$borne->id}/commands/remote-start", [
            'connectorId' => 1,
            'idTag' => 'BADGE-1',
        ]);

        $response->assertOk()->assertJson(['status' => 'Accepted']);

        Http::assertSent(function ($request) {
            return $request->url() === 'http://127.0.0.1:8010/commands/CS-CMD-001'
                && $request['action'] === 'RemoteStartTransaction'
                && $request['payload']['connectorId'] === 1
                && $request['payload']['idTag'] === 'BADGE-1';
        });
    }

    public function test_remote_start_is_rejected_for_a_borne_not_linked_to_ocpp(): void
    {
        $admin = User::factory()->create();
        $borne = Borne::factory()->create(['charge_point_id' => null]);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/bornes/{$borne->id}/commands/remote-start", [
            'connectorId' => 1,
            'idTag' => 'BADGE-1',
        ]);

        $response->assertStatus(422);
    }

    public function test_remote_stop_requires_an_active_session_on_the_connector(): void
    {
        $admin = User::factory()->create();
        $borne = Borne::factory()->create(['charge_point_id' => 'CS-CMD-002']);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/bornes/{$borne->id}/commands/remote-stop", [
            'connectorId' => 1,
        ]);

        $response->assertStatus(422);
    }

    public function test_remote_stop_uses_the_active_sessions_id_as_the_transaction_id(): void
    {
        $admin = User::factory()->create();
        $borne = Borne::factory()->create(['charge_point_id' => 'CS-CMD-003']);
        $session = ChargeSession::factory()->create([
            'borne_id' => $borne->id,
            'connector_id' => 2,
            'status' => 'En cours',
        ]);

        Http::fake([
            'http://127.0.0.1:8010/commands/CS-CMD-003' => Http::response(['status' => 'Accepted']),
        ]);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/bornes/{$borne->id}/commands/remote-stop", [
            'connectorId' => 2,
        ]);

        $response->assertOk();

        Http::assertSent(fn ($request) => $request['action'] === 'RemoteStopTransaction'
            && $request['payload']['transactionId'] === $session->id);
    }

    public function test_it_returns_a_502_when_the_central_system_is_unreachable(): void
    {
        $admin = User::factory()->create();
        $borne = Borne::factory()->create(['charge_point_id' => 'CS-CMD-004']);

        Http::fake(function () {
            throw new \Illuminate\Http\Client\ConnectionException('refused');
        });

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/bornes/{$borne->id}/commands/unlock-connector", [
            'connectorId' => 1,
        ]);

        $response->assertStatus(502);
    }

    public function test_a_client_cannot_send_ocpp_commands(): void
    {
        $client = User::factory()->client()->create();
        $borne = Borne::factory()->create(['charge_point_id' => 'CS-CMD-005']);

        $this->actingAs($client, 'sanctum')
            ->postJson("/api/bornes/{$borne->id}/commands/reset", ['type' => 'Soft'])
            ->assertForbidden();
    }
}
