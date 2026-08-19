<?php

namespace Tests\Feature;

use App\Events\AlerteUpdated;
use App\Events\BorneUpdated;
use App\Events\MaintenanceTicketUpdated;
use App\Models\Borne;
use App\Models\MaintenanceTicket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class MaintenanceTicketApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_lists_creates_and_updates_ticket_status(): void
    {
        Event::fake([MaintenanceTicketUpdated::class]);

        $admin = User::factory()->create();
        $technicien = User::factory()->asRole('technicien')->create(['name' => 'Ali Ben']);
        $borne = Borne::factory()->create(['name' => 'Borne Test']);

        $create = $this->actingAs($admin, 'sanctum')->postJson('/api/maintenance-tickets', [
            'borne_id' => $borne->id,
            'titre' => 'Connecteur endommagé',
            'priorite' => 'Haute',
            'technicien_id' => $technicien->id,
        ]);

        $create->assertCreated()->assertJson([
            'borne' => 'Borne Test',
            'titre' => 'Connecteur endommagé',
            'priorite' => 'Haute',
            'statut' => 'Ouvert',
            'technicien' => 'Ali Ben',
        ]);

        $id = $create->json('id');

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/maintenance-tickets')
            ->assertOk()
            ->assertJsonCount(1);

        $update = $this->actingAs($technicien, 'sanctum')->putJson("/api/maintenance-tickets/{$id}", [
            'statut' => 'Résolu',
        ]);
        $update->assertOk()->assertJson(['statut' => 'Résolu']);

        $this->assertSame('Résolu', MaintenanceTicket::findOrFail($id)->statut);
        Event::assertDispatched(MaintenanceTicketUpdated::class, 2);
    }

    public function test_a_technicien_cannot_create_a_maintenance_ticket(): void
    {
        $technicien = User::factory()->asRole('technicien')->create();
        $borne = Borne::factory()->create();

        $response = $this->actingAs($technicien, 'sanctum')->postJson('/api/maintenance-tickets', [
            'borne_id' => $borne->id,
            'titre' => 'Panne détectée sur site',
            'priorite' => 'Haute',
        ]);

        $response->assertForbidden();
        $this->assertSame(0, MaintenanceTicket::count());
    }

    public function test_a_technicien_cannot_delete_a_maintenance_ticket(): void
    {
        $technicien = User::factory()->asRole('technicien')->create();
        $ticket = MaintenanceTicket::factory()->create(['technicien_id' => $technicien->id]);

        $this->actingAs($technicien, 'sanctum')
            ->deleteJson("/api/maintenance-tickets/{$ticket->id}")
            ->assertForbidden();

        $this->assertModelExists($ticket);
    }

    public function test_an_admin_can_delete_a_maintenance_ticket(): void
    {
        $admin = User::factory()->create();
        $ticket = MaintenanceTicket::factory()->create();

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/maintenance-tickets/{$ticket->id}")
            ->assertOk();

        $this->assertModelMissing($ticket);
    }

    public function test_a_technicien_can_only_update_their_own_assigned_ticket(): void
    {
        $technicien = User::factory()->asRole('technicien')->create();
        $someoneElse = User::factory()->asRole('technicien')->create();
        $borne = Borne::factory()->create();

        $myTicket = MaintenanceTicket::factory()->create(['borne_id' => $borne->id, 'technicien_id' => $technicien->id]);
        $otherTicket = MaintenanceTicket::factory()->create(['borne_id' => $borne->id, 'technicien_id' => $someoneElse->id]);

        $this->actingAs($technicien, 'sanctum')
            ->putJson("/api/maintenance-tickets/{$myTicket->id}", ['statut' => 'En cours'])
            ->assertOk();

        $this->actingAs($technicien, 'sanctum')
            ->putJson("/api/maintenance-tickets/{$otherTicket->id}", ['statut' => 'En cours'])
            ->assertForbidden();
    }

    public function test_a_technicien_cannot_change_priorite_or_reassign_their_own_ticket(): void
    {
        $technicien = User::factory()->asRole('technicien')->create();
        $ticket = MaintenanceTicket::factory()->create(['technicien_id' => $technicien->id, 'priorite' => 'Basse']);

        $this->actingAs($technicien, 'sanctum')
            ->putJson("/api/maintenance-tickets/{$ticket->id}", ['priorite' => 'Critique'])
            ->assertOk();

        $this->assertSame('Basse', $ticket->fresh()->priorite);
    }

    public function test_a_technicien_can_log_replaced_parts_on_their_own_ticket(): void
    {
        $technicien = User::factory()->asRole('technicien')->create();
        $ticket = MaintenanceTicket::factory()->create(['technicien_id' => $technicien->id]);

        $response = $this->actingAs($technicien, 'sanctum')->putJson("/api/maintenance-tickets/{$ticket->id}", [
            'pieces_remplacees' => ['Contacteur 32A', 'Câble CCS'],
        ]);

        $response->assertOk();
        $this->assertSame(['Contacteur 32A', 'Câble CCS'], $ticket->fresh()->pieces_remplacees);
    }

    public function test_a_critical_ticket_marks_the_borne_as_en_panne_and_raises_an_alert(): void
    {
        Event::fake([BorneUpdated::class, AlerteUpdated::class, MaintenanceTicketUpdated::class]);

        $admin = User::factory()->create();
        $borne = Borne::factory()->create(['status' => 'Disponible']);

        $create = $this->actingAs($admin, 'sanctum')->postJson('/api/maintenance-tickets', [
            'borne_id' => $borne->id,
            'titre' => 'Court-circuit',
            'priorite' => 'Critique',
        ]);
        $create->assertCreated();

        $this->assertSame('Défaut', $borne->fresh()->status);
        Event::assertDispatched(BorneUpdated::class);
        Event::assertDispatched(AlerteUpdated::class);
    }

    public function test_resolving_the_last_critical_ticket_clears_the_borne_fault(): void
    {
        $technicien = User::factory()->asRole('technicien')->create();
        $borne = Borne::factory()->create(['status' => 'Disponible']);

        $ticket = MaintenanceTicket::factory()->create([
            'borne_id' => $borne->id,
            'priorite' => 'Critique',
            'statut' => 'Ouvert',
            'technicien_id' => $technicien->id,
        ]);

        // Creating it (via the API, so the sync logic actually runs) puts the borne in Défaut.
        $this->actingAs($technicien, 'sanctum')->putJson("/api/maintenance-tickets/{$ticket->id}", ['statut' => 'En cours']);
        $this->assertSame('Défaut', $borne->fresh()->status);

        $this->actingAs($technicien, 'sanctum')
            ->putJson("/api/maintenance-tickets/{$ticket->id}", ['statut' => 'Résolu'])
            ->assertOk();

        $this->assertSame('Disponible', $borne->fresh()->status);
    }

    public function test_the_borne_stays_en_panne_while_another_critical_ticket_is_still_open(): void
    {
        $admin = User::factory()->create();
        $technicien = User::factory()->asRole('technicien')->create();
        $borne = Borne::factory()->create(['status' => 'Disponible']);

        $first = $this->actingAs($admin, 'sanctum')->postJson('/api/maintenance-tickets', [
            'borne_id' => $borne->id,
            'titre' => 'Premier défaut',
            'priorite' => 'Critique',
            'technicien_id' => $technicien->id,
        ])->json('id');

        MaintenanceTicket::factory()->create(['borne_id' => $borne->id, 'priorite' => 'Critique', 'statut' => 'Ouvert']);
        $this->assertSame('Défaut', $borne->fresh()->status);

        $this->actingAs($technicien, 'sanctum')->putJson("/api/maintenance-tickets/{$first}", ['statut' => 'Résolu']);

        $this->assertSame('Défaut', $borne->fresh()->status);
    }
}
