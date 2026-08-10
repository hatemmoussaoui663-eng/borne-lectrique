<?php

namespace App\Http\Controllers;

use App\Models\Borne;
use App\Models\ChargeSession;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

/**
 * CSMS-initiated OCPP commands (Module 6, "communication avec les bornes"):
 * unlike everything else in the ingest pipeline, these are staff-initiated
 * actions sent *to* the charge point, not events reported *by* it. Forwards
 * to the ocpp-central-system Node process, which holds the live WebSocket.
 */
class OcppCommandController extends Controller
{
    public function remoteStart(Request $request, Borne $borne): JsonResponse
    {
        $data = $request->validate([
            'connectorId' => 'required|integer|min:1',
            'idTag' => 'required|string|max:255',
        ]);

        return $this->send($borne, 'RemoteStartTransaction', [
            'connectorId' => $data['connectorId'],
            'idTag' => $data['idTag'],
        ]);
    }

    public function remoteStop(Request $request, Borne $borne): JsonResponse
    {
        $data = $request->validate([
            'connectorId' => 'required|integer|min:1',
        ]);

        $session = ChargeSession::where('borne_id', $borne->id)
            ->where('connector_id', $data['connectorId'])
            ->where('status', 'En cours')
            ->latest()
            ->first();

        if ($session === null) {
            return response()->json(['message' => 'Aucune session en cours sur ce connecteur.'], 422);
        }

        return $this->send($borne, 'RemoteStopTransaction', [
            'transactionId' => $session->id,
        ]);
    }

    public function unlockConnector(Request $request, Borne $borne): JsonResponse
    {
        $data = $request->validate([
            'connectorId' => 'required|integer|min:1',
        ]);

        return $this->send($borne, 'UnlockConnector', [
            'connectorId' => $data['connectorId'],
        ]);
    }

    public function reset(Request $request, Borne $borne): JsonResponse
    {
        $data = $request->validate([
            'type' => 'required|in:Soft,Hard',
        ]);

        return $this->send($borne, 'Reset', [
            'type' => $data['type'],
        ]);
    }

    private function send(Borne $borne, string $action, array $payload): JsonResponse
    {
        if ($borne->charge_point_id === null) {
            return response()->json(['message' => "Cette borne n'est pas reliée au serveur OCPP."], 422);
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
            return response()->json(['message' => 'Serveur OCPP central injoignable.'], 502);
        }

        if (! $response->successful()) {
            return response()->json(
                ['message' => $response->json('message') ?? 'La commande a échoué.'],
                $response->status()
            );
        }

        return response()->json($response->json());
    }
}
