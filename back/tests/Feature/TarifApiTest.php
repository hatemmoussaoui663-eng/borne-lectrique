<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TarifApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_returns_and_updates_the_current_tarif(): void
    {
        $user = User::factory()->create();

        $show = $this->actingAs($user, 'sanctum')->getJson('/api/tarif');
        $show->assertOk()->assertJsonStructure(['prixKwh']);

        $update = $this->actingAs($user, 'sanctum')->putJson('/api/tarif', ['prixKwh' => 0.42]);
        $update->assertOk()->assertJson(['prixKwh' => 0.42]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/tarif')
            ->assertJson(['prixKwh' => 0.42]);
    }
}
