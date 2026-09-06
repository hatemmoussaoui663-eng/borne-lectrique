<?php

namespace Tests\Feature;

use App\Models\Borne;
use App\Models\ChargeSession;
use App\Models\Facture;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Rechargement du porte-monnaie par carte simulée (Module 9).
 */
class RechargementCarteTest extends TestCase
{
    use RefreshDatabase;

    /** Carte STB valide au sens de Luhn, cf. config/cartes.php. */
    private const CARTE_TUNISIENNE = '5100 0000 0000 0008';

    private function charge(array $remplacements = []): array
    {
        return array_merge([
            'montant' => 100,
            'numero' => self::CARTE_TUNISIENNE,
            'titulaire' => 'CLIENT TEST',
            'mois_expiration' => 12,
            'annee_expiration' => (int) date('Y') + 3,
            'cvv' => '123',
        ], $remplacements);
    }

    private function client(): User
    {
        return User::factory()->client()->create();
    }

    public function test_une_carte_tunisienne_valide_credite_le_porte_monnaie(): void
    {
        $client = $this->client();

        $this->actingAs($client, 'sanctum')
            ->postJson('/api/me/rechargements', $this->charge())
            ->assertCreated()
            ->assertJsonPath('paiement.statut', 'accepte')
            ->assertJsonPath('paiement.banque', 'STB')
            ->assertJsonPath('solde', 100);

        $this->assertSame(100.0, (float) Wallet::pour($client)->fresh()->solde);
    }

    public function test_une_carte_etrangere_est_refusee(): void
    {
        $client = $this->client();

        // Visa de test international : Luhn valide, BIN hors table tunisienne.
        $this->actingAs($client, 'sanctum')
            ->postJson('/api/me/rechargements', $this->charge(['numero' => '4111111111111111']))
            ->assertStatus(402)
            ->assertJsonPath('paiement.statut', 'refuse');

        $this->assertSame(0.0, (float) Wallet::pour($client)->fresh()->solde);
    }

    public function test_un_numero_qui_echoue_a_luhn_est_refuse(): void
    {
        $client = $this->client();

        $this->actingAs($client, 'sanctum')
            ->postJson('/api/me/rechargements', $this->charge(['numero' => '5100000000000000']))
            ->assertStatus(402)
            ->assertJsonPath('paiement.motifRefus', 'Numéro de carte invalide.');
    }

    public function test_une_carte_expiree_est_refusee(): void
    {
        $client = $this->client();

        $this->actingAs($client, 'sanctum')
            ->postJson('/api/me/rechargements', $this->charge([
                'mois_expiration' => 1,
                'annee_expiration' => 2024,
            ]))
            ->assertStatus(402)
            ->assertJsonPath('paiement.motifRefus', 'Carte expirée.');
    }

    public function test_ni_le_numero_complet_ni_le_cryptogramme_ne_sont_stockes(): void
    {
        $client = $this->client();

        $this->actingAs($client, 'sanctum')
            ->postJson('/api/me/rechargements', $this->charge())
            ->assertCreated();

        $ligne = (array) \DB::table('paiements_carte')->first();

        foreach ($ligne as $colonne => $valeur) {
            $this->assertNotSame('5100000000000008', (string) $valeur, "Le PAN complet ne doit jamais etre stocke ({$colonne}).");
            $this->assertNotSame('123', (string) $valeur, "Le cryptogramme ne doit jamais etre stocke ({$colonne}).");
        }

        $this->assertSame('**** **** **** 0008', $ligne['numero_masque']);
    }

    public function test_le_rechargement_solde_les_factures_impayees(): void
    {
        $client = $this->client();
        $borne = Borne::factory()->create();
        $session = ChargeSession::factory()->create(['borne_id' => $borne->id, 'user_id' => $client->id]);

        Facture::create([
            'numero' => 'FAC-TEST-1',
            'user_id' => $client->id,
            'user_nom' => $client->name,
            'charge_session_id' => $session->id,
            'montant_ht' => 30,
            'remise_pourcent' => 0,
            'montant_remise' => 0,
            'tva_taux' => 0,
            'montant_tva' => 0,
            'montant_ttc' => 30,
            'statut' => Facture::STATUT_IMPAYEE,
            'emise_le' => now(),
        ]);

        $this->actingAs($client, 'sanctum')
            ->postJson('/api/me/rechargements', $this->charge(['montant' => 100]))
            ->assertCreated()
            ->assertJsonPath('facturesReglees', 1)
            ->assertJsonPath('solde', 70);

        $this->assertDatabaseHas('factures', ['numero' => 'FAC-TEST-1', 'statut' => Facture::STATUT_PAYEE]);
    }

    public function test_une_facture_hors_budget_reste_impayee(): void
    {
        $client = $this->client();
        $borne = Borne::factory()->create();
        $session = ChargeSession::factory()->create(['borne_id' => $borne->id, 'user_id' => $client->id]);

        Facture::create([
            'numero' => 'FAC-TEST-2',
            'user_id' => $client->id,
            'user_nom' => $client->name,
            'charge_session_id' => $session->id,
            'montant_ht' => 500,
            'remise_pourcent' => 0,
            'montant_remise' => 0,
            'tva_taux' => 0,
            'montant_tva' => 0,
            'montant_ttc' => 500,
            'statut' => Facture::STATUT_IMPAYEE,
            'emise_le' => now(),
        ]);

        $this->actingAs($client, 'sanctum')
            ->postJson('/api/me/rechargements', $this->charge(['montant' => 100]))
            ->assertCreated()
            ->assertJsonPath('facturesReglees', 0)
            ->assertJsonPath('solde', 100);

        $this->assertDatabaseHas('factures', ['numero' => 'FAC-TEST-2', 'statut' => Facture::STATUT_IMPAYEE]);
    }

    public function test_un_client_ne_voit_que_ses_propres_rechargements(): void
    {
        $moi = $this->client();
        $autre = $this->client();

        $this->actingAs($autre, 'sanctum')->postJson('/api/me/rechargements', $this->charge())->assertCreated();
        $this->actingAs($moi, 'sanctum')->postJson('/api/me/rechargements', $this->charge())->assertCreated();

        $this->actingAs($moi, 'sanctum')->getJson('/api/me/rechargements')->assertOk()->assertJsonCount(1);
    }

    public function test_le_montant_est_plafonne(): void
    {
        $client = $this->client();

        $this->actingAs($client, 'sanctum')
            ->postJson('/api/me/rechargements', $this->charge(['montant' => 999999]))
            ->assertStatus(422);

        $this->assertSame(0.0, (float) Wallet::pour($client)->fresh()->solde);
    }
}
