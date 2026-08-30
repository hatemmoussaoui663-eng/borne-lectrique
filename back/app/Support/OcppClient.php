<?php

namespace App\Support;

use App\Models\Borne;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * Envoi d'une commande OCPP sortante au processus Node `ocpp-central-system`,
 * qui détient la WebSocket vivante vers la borne.
 *
 * Extrait d'OcppCommandController car le Module 13 (Firmware) doit envoyer des
 * `UpdateFirmware` par le même chemin : deux copies de cette logique auraient
 * divergé à la première évolution du protocole d'échange interne.
 */
class OcppClient
{
    /**
     * @return array{succes: bool, status: int, donnees: array, message: ?string}
     */
    public function envoyer(Borne $borne, string $action, array $payload = []): array
    {
        if ($borne->charge_point_id === null) {
            return $this->echec(422, "Cette borne n'est pas reliée au serveur OCPP.");
        }

        $baseUrl = rtrim((string) env('OCPP_CENTRAL_URL', 'http://127.0.0.1:8010'), '/');
        $token = (string) env('OCPP_INGEST_TOKEN', '');

        try {
            $response = Http::timeout(25)
                ->withHeaders(['X-Internal-Token' => $token])
                ->post("{$baseUrl}/commands/{$borne->charge_point_id}", [
                    'action' => $action,
                    'payload' => $payload,
                ]);
        } catch (ConnectionException) {
            return $this->echec(502, 'Serveur OCPP central injoignable.');
        }

        if (! $response->successful()) {
            return $this->echec(
                $response->status(),
                $response->json('message') ?? 'La commande a échoué.'
            );
        }

        return [
            'succes' => true,
            'status' => 200,
            'donnees' => (array) $response->json(),
            'message' => null,
        ];
    }

    private function echec(int $status, string $message): array
    {
        return [
            'succes' => false,
            'status' => $status,
            'donnees' => [],
            'message' => $message,
        ];
    }
}
