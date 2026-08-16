<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoleApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_lists_roles_for_a_user_with_utilisateurs_access(): void
    {
        $admin = User::factory()->create();
        Role::firstOrCreate(['name' => 'technicien'], ['display_name' => 'Technicien']);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/roles');

        $response->assertOk();
        $response->assertJsonFragment(['name' => 'super_admin', 'displayName' => 'Super Administrateur']);
        $response->assertJsonFragment(['name' => 'technicien', 'displayName' => 'Technicien']);
    }

    public function test_a_technicien_cannot_list_roles(): void
    {
        $technicien = User::factory()->asRole('technicien')->create();

        $this->actingAs($technicien, 'sanctum')->getJson('/api/roles')->assertForbidden();
    }

    public function test_super_admin_can_create_a_role(): void
    {
        $admin = User::factory()->create();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/roles', [
            'name' => 'auditeur',
            'display_name' => 'Auditeur',
        ]);

        $response->assertCreated();
        $response->assertJsonFragment(['name' => 'auditeur', 'displayName' => 'Auditeur']);
        $this->assertDatabaseHas('roles', ['name' => 'auditeur', 'display_name' => 'Auditeur']);
    }

    public function test_an_exploitant_with_full_utilisateurs_access_cannot_create_a_role(): void
    {
        $exploitant = User::factory()->asRole('exploitant')->create();

        $response = $this->actingAs($exploitant, 'sanctum')->postJson('/api/roles', [
            'name' => 'auditeur',
            'display_name' => 'Auditeur',
        ]);

        $response->assertForbidden();
        $this->assertDatabaseMissing('roles', ['name' => 'auditeur']);
    }

    public function test_a_technicien_cannot_create_a_role(): void
    {
        $technicien = User::factory()->asRole('technicien')->create();

        $this->actingAs($technicien, 'sanctum')->postJson('/api/roles', [
            'name' => 'auditeur',
            'display_name' => 'Auditeur',
        ])->assertForbidden();
    }
}
