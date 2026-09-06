<?php

namespace Tests\Feature;

use App\Models\Badge;
use App\Models\Facture;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Wallet;
use App\Support\PaiementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Porte-monnaie prépayé (Module 9) : clôturer une session de recharge débite
 * le solde du client, via la facture émise pour cette session.
 */
class RechargeDebiteWalletTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'test-ocpp-internal-token';

    private function clientAvecBadge(float $solde): array
    {
        $client = User::factory()->client()->create();
        $badge = Badge::factory()->create(['user_id' => $client->id]);

        if ($solde > 0) {
            app(PaiementService::class)->crediter($client, $solde, 'Approvisionnement de test');
        }

        return [$client, $badge];
    }

    private function jouerSession(string $codeBadge, int $wattheures): int
    {
        $depart = $this->withHeaders(['X-Internal-Token' => self::TOKEN])
            ->postJson('/api/internal/ocpp/start-transaction', [
                'chargePointId' => 'CS-SIMU-001',
                'connectorId' => 1,
                'idTag' => $codeBadge,
                'meterStart' => 0,
            ])->assertOk();

        $id = $depart->json('transactionId');

        $this->withHeaders(['X-Internal-Token' => self::TOKEN])
            ->postJson('/api/internal/ocpp/stop-transaction', [
                'transactionId' => $id,
                'meterStop' => $wattheures,
            ])->assertOk();

        return $id;
    }

    public function test_cloturer_une_session_debite_le_porte_monnaie(): void
    {
        Tarif::current();
        [$client, $badge] = $this->clientAvecBadge(100);

        $id = $this->jouerSession($badge->code, 5000); // 5 kWh

        $facture = Facture::where('charge_session_id', $id)->firstOrFail();

        $this->assertSame(Facture::STATUT_PAYEE, $facture->statut);
        $this->assertEqualsWithDelta(
            100 - (float) $facture->montant_ttc,
            (float) Wallet::pour($client)->fresh()->solde,
            0.001,
            'Le solde doit baisser exactement du montant TTC de la facture.',
        );
    }

    public function test_le_debit_laisse_une_ecriture_de_porte_monnaie(): void
    {
        Tarif::current();
        [$client, $badge] = $this->clientAvecBadge(100);

        $id = $this->jouerSession($badge->code, 5000);
        $facture = Facture::where('charge_session_id', $id)->firstOrFail();

        $this->assertDatabaseHas('wallet_transactions', [
            'type' => 'debit',
            'facture_id' => $facture->id,
        ]);
    }

    public function test_un_solde_insuffisant_laisse_la_facture_impayee(): void
    {
        Tarif::current();
        [$client, $badge] = $this->clientAvecBadge(0.5);

        $id = $this->jouerSession($badge->code, 20000); // 20 kWh, hors budget

        $facture = Facture::where('charge_session_id', $id)->firstOrFail();

        // Clôturer la session prime sur l'encaissement : la borne ne doit pas
        // rester bloquée parce que le client n'a plus de crédit.
        $this->assertSame(Facture::STATUT_IMPAYEE, $facture->statut);
        $this->assertEqualsWithDelta(0.5, (float) Wallet::pour($client)->fresh()->solde, 0.001);
    }

    public function test_une_session_sans_badge_ne_touche_aucun_porte_monnaie(): void
    {
        Tarif::current();

        $this->jouerSession('BADGE-INCONNU', 5000);

        $this->assertDatabaseCount('wallet_transactions', 0);
    }
}
