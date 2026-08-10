<?php

namespace Tests\Feature;

use App\Models\Badge;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BadgeApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_associates_a_badge_to_a_user(): void
    {
        $admin = User::factory()->create();
        $target = User::factory()->create();

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/users/{$target->id}/badge", [
            'code' => 'RFID-001',
            'status' => 'Actif',
        ]);

        $response->assertOk()->assertJson([
            'badge' => ['code' => 'RFID-001', 'status' => 'Actif'],
        ]);

        $this->assertSame(1, Badge::where('code', 'RFID-001')->where('user_id', $target->id)->count());
    }

    public function test_it_rejects_a_badge_code_already_used_by_another_user(): void
    {
        $admin = User::factory()->create();
        $existingOwner = User::factory()->create();
        Badge::factory()->create(['code' => 'RFID-DUP', 'user_id' => $existingOwner->id]);

        $target = User::factory()->create();

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/users/{$target->id}/badge", [
            'code' => 'RFID-DUP',
        ]);

        $response->assertStatus(422);
    }

    public function test_an_empty_code_detaches_the_badge(): void
    {
        $admin = User::factory()->create();
        $target = User::factory()->create();
        Badge::factory()->create(['code' => 'RFID-002', 'user_id' => $target->id]);

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/users/{$target->id}/badge", [
            'code' => null,
        ]);

        $response->assertOk()->assertJson(['badge' => null]);
        $this->assertSame(0, Badge::where('user_id', $target->id)->count());
    }
}
