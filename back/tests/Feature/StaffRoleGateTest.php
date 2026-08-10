<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StaffRoleGateTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_client_cannot_reach_staff_only_endpoints(): void
    {
        $client = User::factory()->client()->create();

        $this->actingAs($client, 'sanctum')->getJson('/api/users')->assertForbidden();
        $this->actingAs($client, 'sanctum')->getJson('/api/dashboard')->assertForbidden();
        $this->actingAs($client, 'sanctum')->postJson('/api/bornes', ['name' => 'X'])->assertForbidden();
    }

    public function test_a_client_can_still_reach_the_read_only_bornes_list_and_me_endpoints(): void
    {
        $client = User::factory()->client()->create();

        $this->actingAs($client, 'sanctum')->getJson('/api/bornes')->assertOk();
        $this->actingAs($client, 'sanctum')->getJson('/api/me/sessions')->assertOk();
        $this->actingAs($client, 'sanctum')->getJson('/api/me/vehicules')->assertOk();
    }

    public function test_staff_roles_can_still_reach_admin_endpoints(): void
    {
        $admin = User::factory()->create();

        $this->actingAs($admin, 'sanctum')->getJson('/api/users')->assertOk();
        $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard')->assertOk();
    }
}
