<?php

namespace Tests\Feature;

use App\Models\Borne;
use App\Models\MaintenanceTicket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MaintenanceTicketApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_lists_creates_and_updates_ticket_status(): void
    {
        $admin = User::factory()->create();
        $borne = Borne::factory()->create(['name' => 'Borne Test']);

        $create = $this->actingAs($admin, 'sanctum')->postJson('/api/maintenance-tickets', [
            'borne_id' => $borne->id,
            'titre' => 'Connecteur endommagé',
            'priorite' => 'Haute',
            'technicien' => 'Ali Ben',
        ]);

        $create->assertCreated()->assertJson([
            'borne' => 'Borne Test',
            'titre' => 'Connecteur endommagé',
            'priorite' => 'Haute',
            'statut' => 'Ouvert',
        ]);

        $id = $create->json('id');

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/maintenance-tickets')
            ->assertOk()
            ->assertJsonCount(1);

        $update = $this->actingAs($admin, 'sanctum')->putJson("/api/maintenance-tickets/{$id}", [
            'statut' => 'Résolu',
        ]);
        $update->assertOk()->assertJson(['statut' => 'Résolu']);

        $this->assertSame('Résolu', MaintenanceTicket::findOrFail($id)->statut);
    }
}
