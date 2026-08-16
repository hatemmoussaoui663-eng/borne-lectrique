<?php

namespace Tests\Feature;

use App\Models\Borne;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PermissionMatrixTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_has_full_access_everywhere(): void
    {
        $admin = User::factory()->create(); // default role is super_admin

        $this->actingAs($admin, 'sanctum')->getJson('/api/users')->assertOk();
        $this->actingAs($admin, 'sanctum')->getJson('/api/tarif')->assertOk();
        $this->actingAs($admin, 'sanctum')->putJson('/api/tarif', ['prixKwh' => 0.5])->assertOk();
    }

    public function test_technicien_can_write_maintenance_but_only_read_bornes(): void
    {
        $technicien = User::factory()->asRole('technicien')->create();
        $borne = Borne::factory()->create();

        $this->actingAs($technicien, 'sanctum')->getJson('/api/bornes/'.$borne->id)->assertOk();
        // GET /bornes/{id} is on the shared read-only route, not permission-gated;
        // the write side (update) is what the matrix restricts.
        $this->actingAs($technicien, 'sanctum')
            ->putJson("/api/bornes/{$borne->id}", ['name' => 'Renamed'])
            ->assertForbidden();

        $this->actingAs($technicien, 'sanctum')
            ->postJson('/api/maintenance-tickets', [
                'borne_id' => $borne->id,
                'titre' => 'Panne',
                'priorite' => 'Haute',
            ])
            ->assertCreated();
    }

    public function test_technicien_cannot_reach_utilisateurs_tarif_or_rapports(): void
    {
        $technicien = User::factory()->asRole('technicien')->create();

        $this->actingAs($technicien, 'sanctum')->getJson('/api/users')->assertForbidden();
        $this->actingAs($technicien, 'sanctum')->getJson('/api/tarif')->assertForbidden();
        $this->actingAs($technicien, 'sanctum')->getJson('/api/rapports/export')->assertForbidden();
    }

    public function test_technicien_can_send_ocpp_commands(): void
    {
        $technicien = User::factory()->asRole('technicien')->create();
        $borne = Borne::factory()->create(['charge_point_id' => null]);

        // No charge_point_id -> the controller itself 422s, but that only
        // happens *after* the permission gate lets the request through.
        $this->actingAs($technicien, 'sanctum')
            ->postJson("/api/bornes/{$borne->id}/commands/unlock-connector", ['connectorId' => 1])
            ->assertStatus(422);
    }

    public function test_finance_can_manage_tarif_and_rapports_but_not_maintenance(): void
    {
        $finance = User::factory()->asRole('finance')->create();

        $this->actingAs($finance, 'sanctum')->putJson('/api/tarif', ['prixKwh' => 0.4])->assertOk();
        $this->actingAs($finance, 'sanctum')->getJson('/api/rapports/export')->assertOk();
        $this->actingAs($finance, 'sanctum')->getJson('/api/maintenance-tickets')->assertForbidden();
        $this->actingAs($finance, 'sanctum')->getJson('/api/users')->assertForbidden();
    }

    public function test_service_client_can_manage_users_but_not_maintenance_or_tarif(): void
    {
        $serviceClient = User::factory()->asRole('service_client')->create();

        $this->actingAs($serviceClient, 'sanctum')->getJson('/api/users')->assertOk();
        $this->actingAs($serviceClient, 'sanctum')->getJson('/api/maintenance-tickets')->assertForbidden();
        $this->actingAs($serviceClient, 'sanctum')->getJson('/api/tarif')->assertForbidden();
    }

    /**
     * Cahier des charges §7 matrix, example rows: Exploitant = "✔" (full)
     * on both Bornes and Maintenance, same as Admin.
     */
    public function test_exploitant_has_full_access_to_bornes_and_maintenance(): void
    {
        $exploitant = User::factory()->asRole('exploitant')->create();
        $borne = Borne::factory()->create();

        $this->actingAs($exploitant, 'sanctum')
            ->putJson("/api/bornes/{$borne->id}", ['name' => 'Renamed'])
            ->assertOk();

        $this->actingAs($exploitant, 'sanctum')
            ->postJson('/api/maintenance-tickets', [
                'borne_id' => $borne->id,
                'titre' => 'Panne',
                'priorite' => 'Haute',
            ])
            ->assertCreated();
    }

    public function test_operateur_can_read_but_not_write_tarif(): void
    {
        $operateur = User::factory()->asRole('operateur')->create();

        $this->actingAs($operateur, 'sanctum')->getJson('/api/tarif')->assertOk();
        $this->actingAs($operateur, 'sanctum')->putJson('/api/tarif', ['prixKwh' => 0.3])->assertForbidden();
    }
}
