<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\ReinitialisationMotDePasse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class MotDePasseOublieTest extends TestCase
{
    use RefreshDatabase;

    public function test_un_lien_est_envoye_par_email(): void
    {
        Notification::fake();
        $utilisateur = User::factory()->create(['email' => 'pilote@borne-electrique.com']);

        $this->postJson('/api/auth/forgot-password', ['email' => 'pilote@borne-electrique.com'])
            ->assertOk();

        Notification::assertSentTo(
            $utilisateur,
            fn (ReinitialisationMotDePasse $notification) => $notification->via($utilisateur) === ['mail'],
        );
    }

    public function test_un_lien_est_envoye_par_sms_depuis_un_numero(): void
    {
        Notification::fake();
        $utilisateur = User::factory()->create(['phone' => '+21622410552']);

        $this->postJson('/api/auth/forgot-password', ['phone' => '+21622410552'])
            ->assertOk();

        Notification::assertSentTo(
            $utilisateur,
            fn (ReinitialisationMotDePasse $notification) => $notification->via($utilisateur) !== ['mail'],
        );
    }

    public function test_le_numero_est_reconnu_quel_que_soit_son_formatage(): void
    {
        Notification::fake();
        $utilisateur = User::factory()->create(['phone' => '+21622410552']);

        $this->postJson('/api/auth/forgot-password', ['phone' => '22 410 552'])
            ->assertOk();

        Notification::assertSentTo($utilisateur, ReinitialisationMotDePasse::class);
    }

    public function test_un_numero_exact_prime_sur_une_correspondance_de_fin(): void
    {
        Notification::fake();
        $avecIndicatif = User::factory()->create(['phone' => '+21622410552']);
        $sansIndicatif = User::factory()->create(['phone' => '22410552']);

        $this->postJson('/api/auth/forgot-password', ['phone' => '22410552'])
            ->assertOk();

        Notification::assertSentTo($sansIndicatif, ReinitialisationMotDePasse::class);
        Notification::assertNotSentTo($avecIndicatif, ReinitialisationMotDePasse::class);
    }

    public function test_un_numero_partage_par_plusieurs_comptes_est_refuse(): void
    {
        Notification::fake();
        // Aucun des deux ne correspond exactement a "22410552" : seule la
        // correspondance de fin joue, et elle ne permet pas de trancher.
        User::factory()->create(['phone' => '+21622410552']);
        User::factory()->create(['phone' => '0021622410552']);

        $this->postJson('/api/auth/forgot-password', ['phone' => '22410552'])
            ->assertStatus(422);

        Notification::assertNothingSent();
    }

    public function test_un_numero_inconnu_est_refuse(): void
    {
        Notification::fake();

        $this->postJson('/api/auth/forgot-password', ['phone' => '99999999'])
            ->assertStatus(422);

        Notification::assertNothingSent();
    }

    public function test_il_faut_fournir_un_identifiant_et_un_seul(): void
    {
        $this->postJson('/api/auth/forgot-password', [])->assertStatus(422);

        $this->postJson('/api/auth/forgot-password', [
            'email' => 'pilote@borne-electrique.com',
            'phone' => '22410552',
        ])->assertStatus(422);
    }

    public function test_le_lien_envoye_vise_le_front_et_non_une_route_web(): void
    {
        $utilisateur = User::factory()->create();
        config(['app.frontend_url' => 'http://localhost:5173']);

        $notification = new ReinitialisationMotDePasse('jeton-de-test');
        $lien = $notification->toMail($utilisateur)->actionUrl;

        $this->assertSame(
            'http://localhost:5173/reset-password?token=jeton-de-test&email='.urlencode($utilisateur->email),
            $lien,
        );
    }
}
