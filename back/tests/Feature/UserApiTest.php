<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserApiTest extends TestCase
{
    use RefreshDatabase;

    private function userPayload(): array
    {
        return [
            'name' => 'Nouvel Utilisateur',
            'email' => 'nouvel.utilisateur@example.com',
            'phone' => null,
            'role_id' => Role::firstOrCreate(['name' => 'client'], ['display_name' => 'Client'])->id,
            'is_active' => true,
            'password' => 'password123',
        ];
    }

    public function test_super_admin_can_create_a_user(): void
    {
        $admin = User::factory()->create();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/users', $this->userPayload());

        $response->assertCreated();
        $this->assertDatabaseHas('users', ['email' => 'nouvel.utilisateur@example.com']);
    }

    public function test_an_exploitant_with_full_utilisateurs_access_cannot_create_a_user(): void
    {
        $exploitant = User::factory()->asRole('exploitant')->create();

        $response = $this->actingAs($exploitant, 'sanctum')->postJson('/api/users', $this->userPayload());

        $response->assertForbidden();
        $this->assertDatabaseMissing('users', ['email' => 'nouvel.utilisateur@example.com']);
    }

    public function test_a_service_client_cannot_create_a_user(): void
    {
        $serviceClient = User::factory()->asRole('service_client')->create();

        $this->actingAs($serviceClient, 'sanctum')
            ->postJson('/api/users', $this->userPayload())
            ->assertForbidden();
    }

    public function test_a_technicien_cannot_create_a_user(): void
    {
        $technicien = User::factory()->asRole('technicien')->create();

        $this->actingAs($technicien, 'sanctum')
            ->postJson('/api/users', $this->userPayload())
            ->assertForbidden();
    }

    public function test_super_admin_can_update_and_delete_a_user(): void
    {
        $admin = User::factory()->create();
        $target = User::factory()->create(['name' => 'Ancien Nom']);

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/users/{$target->id}", ['name' => 'Nouveau Nom'])
            ->assertOk()
            ->assertJsonFragment(['name' => 'Nouveau Nom']);

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/users/{$target->id}")
            ->assertOk();

        $this->assertModelMissing($target);
    }

    public function test_an_exploitant_with_full_utilisateurs_access_cannot_update_or_delete_a_user(): void
    {
        $exploitant = User::factory()->asRole('exploitant')->create();
        $target = User::factory()->create(['name' => 'Ancien Nom']);

        $this->actingAs($exploitant, 'sanctum')
            ->putJson("/api/users/{$target->id}", ['name' => 'Nouveau Nom'])
            ->assertForbidden();

        $this->actingAs($exploitant, 'sanctum')
            ->deleteJson("/api/users/{$target->id}")
            ->assertForbidden();

        $this->assertSame('Ancien Nom', $target->fresh()->name);
        $this->assertModelExists($target);
    }

    public function test_a_service_client_cannot_update_or_delete_a_user(): void
    {
        $serviceClient = User::factory()->asRole('service_client')->create();
        $target = User::factory()->create();

        $this->actingAs($serviceClient, 'sanctum')
            ->putJson("/api/users/{$target->id}", ['name' => 'Nouveau Nom'])
            ->assertForbidden();

        $this->actingAs($serviceClient, 'sanctum')
            ->deleteJson("/api/users/{$target->id}")
            ->assertForbidden();
    }

    public function test_a_user_cannot_delete_their_own_account(): void
    {
        $admin = User::factory()->create();

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/users/{$admin->id}")
            ->assertStatus(422);

        $this->assertModelExists($admin);
    }
}
