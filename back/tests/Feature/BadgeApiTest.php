<?php

namespace Tests\Feature;

use App\Models\Badge;
use App\Models\ChargeSession;
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

    public function test_an_empty_code_auto_generates_the_next_sequential_badge_for_a_user_with_none(): void
    {
        $admin = User::factory()->create();
        $target = User::factory()->create();
        Badge::factory()->create(['code' => 'RFID-0003']);

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/users/{$target->id}/badge", [
            'code' => null,
            'status' => 'Actif',
        ]);

        $response->assertOk()->assertJson(['badge' => ['code' => 'RFID-0004']]);
    }

    public function test_a_used_badge_code_cannot_be_changed_or_detached(): void
    {
        $admin = User::factory()->create();
        $target = User::factory()->create();
        $badge = Badge::factory()->create(['code' => 'RFID-USED', 'user_id' => $target->id]);
        ChargeSession::factory()->create(['id_tag' => 'RFID-USED']);

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/users/{$target->id}/badge", ['code' => 'RFID-NEW'])
            ->assertStatus(422);

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/users/{$target->id}/badge", ['code' => null])
            ->assertStatus(422);

        $this->assertSame('RFID-USED', $badge->fresh()->code);
    }

    public function test_a_used_badges_status_can_still_be_updated(): void
    {
        $admin = User::factory()->create();
        $target = User::factory()->create();
        $badge = Badge::factory()->create(['code' => 'RFID-USED2', 'user_id' => $target->id, 'status' => 'Actif']);
        ChargeSession::factory()->create(['id_tag' => 'RFID-USED2']);

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/users/{$target->id}/badge", [
            'code' => 'RFID-USED2',
            'status' => 'Bloqué',
        ]);

        $response->assertOk();
        $this->assertSame('Bloqué', $badge->fresh()->status);
    }
}
