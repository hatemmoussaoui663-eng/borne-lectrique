<?php

namespace Tests\Feature;

use App\Models\Borne;
use App\Models\MaintenanceTicket;
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
        $ticket = MaintenanceTicket::factory()->create(['borne_id' => $borne->id, 'technicien_id' => $technicien->id]);

        $this->actingAs($technicien, 'sanctum')->getJson('/api/bornes/'.$borne->id)->assertOk();
        // GET /bornes/{id} is on the shared read-only route, not permission-gated;
        // the write side (update) is what the matrix restricts.
        $this->actingAs($technicien, 'sanctum')
            ->putJson("/api/bornes/{$borne->id}", ['name' => 'Renamed'])
            ->assertForbidden();

        // "Write" access to Maintenance for a Technicien means the statut of
        // their own assigned ticket — creating/deleting tickets is reserved
        // to Exploitant/Admin (see MaintenanceTicketApiTest).
        $this->actingAs($technicien, 'sanctum')
            ->putJson("/api/maintenance-tickets/{$ticket->id}", ['statut' => 'En cours'])
            ->assertOk();
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
     * on both Bornes and Maintenance, same as Admin — except resolving a
     * ticket's statut, which business logic reserves to the assigned
     * Technicien/Admin (see test_exploitant_can_create_but_not_resolve_a_maintenance_ticket).
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

    /**
     * An Exploitant reports/creates and assigns tickets but doesn't do the
     * repair itself — only the assigned Technicien resolves one.
     */
    public function test_exploitant_can_create_but_not_resolve_a_maintenance_ticket(): void
    {
        $exploitant = User::factory()->asRole('exploitant')->create();
        $borne = Borne::factory()->create();

        $create = $this->actingAs($exploitant, 'sanctum')->postJson('/api/maintenance-tickets', [
            'borne_id' => $borne->id,
            'titre' => 'Panne',
            'priorite' => 'Haute',
            'statut' => 'Résolu',
        ]);
        $create->assertCreated();
        $this->assertSame('Ouvert', $create->json('statut'));

        $ticketId = $create->json('id');
        $update = $this->actingAs($exploitant, 'sanctum')
            ->putJson("/api/maintenance-tickets/{$ticketId}", ['statut' => 'Résolu']);

        $update->assertOk();
        $this->assertSame('Ouvert', $update->json('statut'));
    }

    /**
     * Business rule (not from the PDF's simplified §7 example): only the
     * assigned Technicien resolves a ticket's statut — not even the Super
     * Administrateur can shortcut it, despite having no restriction elsewhere.
     */
    public function test_only_the_assigned_technicien_resolves_a_maintenance_ticket_not_even_admin(): void
    {
        $admin = User::factory()->create();
        $technicien = User::factory()->asRole('technicien')->create();
        $ticket = MaintenanceTicket::factory()->create(['technicien_id' => $technicien->id, 'statut' => 'Ouvert']);

        $update = $this->actingAs($admin, 'sanctum')
            ->putJson("/api/maintenance-tickets/{$ticket->id}", ['statut' => 'Résolu']);

        $update->assertOk();
        $this->assertSame('Ouvert', $ticket->fresh()->statut);
    }

    public function test_operateur_can_read_but_not_write_tarif(): void
    {
        $operateur = User::factory()->asRole('operateur')->create();

        $this->actingAs($operateur, 'sanctum')->getJson('/api/tarif')->assertOk();
        $this->actingAs($operateur, 'sanctum')->putJson('/api/tarif', ['prixKwh' => 0.3])->assertForbidden();
    }
}
