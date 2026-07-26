<?php

namespace App\Http\Controllers;

use App\Events\BorneUpdated;
use App\Events\ChargeSessionUpdated;
use App\Models\Borne;
use App\Models\ChargeSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Machine-to-machine endpoints called by the `ocpp-central-system` Node process
 * (protected by the `ocpp.internal` shared-secret middleware, not Sanctum) as it
 * relays OCPP 1.6 messages from the simulator/real charge points.
 */
class OcppIngestController extends Controller
{
    public function bootNotification(Request $request): JsonResponse
    {
        $data = $request->validate([
            'chargePointId' => 'required|string|max:255',
            'vendor' => 'nullable|string|max:255',
            'model' => 'nullable|string|max:255',
            'firmwareVersion' => 'nullable|string|max:255',
        ]);

        $borne = $this->resolveBorne($data['chargePointId']);
        $borne->fill([
            'fabricant' => $data['vendor'] ?? $borne->fabricant,
            'modele' => $data['model'] ?? $borne->modele,
            'firmware' => $data['firmwareVersion'] ?? $borne->firmware,
            'status' => 'Disponible',
            'last_heartbeat_at' => now(),
        ]);
        $borne->save();

        BorneUpdated::dispatch($borne);

        return response()->json(['borneId' => $borne->id]);
    }

    public function heartbeat(Request $request): JsonResponse
    {
        $data = $request->validate([
            'chargePointId' => 'required|string|max:255',
        ]);

        $borne = $this->resolveBorne($data['chargePointId']);
        $borne->update(['last_heartbeat_at' => now()]);

        BorneUpdated::dispatch($borne);

        return response()->json(['ok' => true]);
    }

    public function statusNotification(Request $request): JsonResponse
    {
        $data = $request->validate([
            'chargePointId' => 'required|string|max:255',
            'connectorId' => 'required|integer|min:0',
            'status' => 'required|string|max:50',
        ]);

        $borne = $this->resolveBorne($data['chargePointId']);
        $this->applyConnectorStatus($borne, (int) $data['connectorId'], $data['status']);
        $borne->last_heartbeat_at = now();
        $borne->save();

        BorneUpdated::dispatch($borne);

        return response()->json(['ok' => true]);
    }

    public function startTransaction(Request $request): JsonResponse
    {
        $data = $request->validate([
            'chargePointId' => 'required|string|max:255',
            'connectorId' => 'required|integer|min:0',
            'idTag' => 'nullable|string|max:255',
            'meterStart' => 'nullable|integer|min:0',
        ]);

        $borne = $this->resolveBorne($data['chargePointId']);

        $session = ChargeSession::create([
            'borne_id' => $borne->id,
            'connector_id' => $data['connectorId'],
            'id_tag' => $data['idTag'] ?? null,
            'meter_start' => $data['meterStart'] ?? null,
            'status' => 'En cours',
            'started_at' => now(),
        ]);

        $this->applyConnectorStatus($borne, (int) $data['connectorId'], 'Charging');
        $borne->last_heartbeat_at = now();
        $borne->save();

        ChargeSessionUpdated::dispatch($session);
        BorneUpdated::dispatch($borne);

        return response()->json(['transactionId' => $session->id]);
    }

    public function meterValues(Request $request): JsonResponse
    {
        $data = $request->validate([
            'transactionId' => 'required|integer',
            'energyWh' => 'nullable|numeric|min:0',
        ]);

        $session = ChargeSession::find($data['transactionId']);
        if ($session === null) {
            return response()->json(['ok' => true]);
        }

        if (isset($data['energyWh'])) {
            $session->energie_kwh = round($data['energyWh'] / 1000, 3);
            $session->save();
            ChargeSessionUpdated::dispatch($session);
        }

        return response()->json(['ok' => true]);
    }

    public function stopTransaction(Request $request): JsonResponse
    {
        $data = $request->validate([
            'transactionId' => 'required|integer',
            'meterStop' => 'nullable|integer|min:0',
        ]);

        $session = ChargeSession::find($data['transactionId']);
        if ($session === null) {
            return response()->json(['ok' => true]);
        }

        $meterStop = $data['meterStop'] ?? null;
        $session->meter_stop = $meterStop;
        if ($meterStop !== null && $session->meter_start !== null) {
            $session->energie_kwh = round(max(0, $meterStop - $session->meter_start) / 1000, 3);
        }
        $session->status = 'Terminée';
        $session->stopped_at = now();
        $session->save();

        ChargeSessionUpdated::dispatch($session);

        $borne = $session->borne;
        if ($borne !== null) {
            $this->applyConnectorStatus($borne, (int) $session->connector_id, 'Available');
            $borne->save();
            BorneUpdated::dispatch($borne);
        }

        return response()->json(['ok' => true]);
    }

    public function disconnect(Request $request): JsonResponse
    {
        $data = $request->validate([
            'chargePointId' => 'required|string|max:255',
        ]);

        $borne = Borne::where('charge_point_id', $data['chargePointId'])->first();
        if ($borne !== null) {
            $borne->status = 'Déconnectée';
            $borne->save();
            BorneUpdated::dispatch($borne);
        }

        return response()->json(['ok' => true]);
    }

    private function resolveBorne(string $chargePointId): Borne
    {
        // OCPP never reports GPS coordinates, so a freshly discovered charge
        // point has no real location. Scatter it around Tunis (jittered so
        // several auto-created stations don't stack on the same map pixel)
        // rather than leaving it at (0, 0), which is off the coast of West
        // Africa and effectively invisible on a Tunisia-centered map.
        $tunisLatitude = 36.8065;
        $tunisLongitude = 10.1815;
        $jitter = fn (): float => mt_rand(-150, 150) / 1000;

        return Borne::firstOrCreate(
            ['charge_point_id' => $chargePointId],
            [
                'name' => $chargePointId,
                'status' => 'Disponible',
                'ocpp' => '1.6',
                'puissance' => 22,
                'connecteurs' => [],
                'latitude' => $tunisLatitude + $jitter(),
                'longitude' => $tunisLongitude + $jitter(),
            ]
        );
    }

    private function applyConnectorStatus(Borne $borne, int $connectorId, string $ocppStatus): void
    {
        $etat = $this->mapConnectorStatus($ocppStatus);

        // connectorId 0 represents the whole charge point (OCPP 1.6), not a physical
        // connector; only let it override the aggregate for fault/unavailable signals.
        if ($connectorId === 0) {
            if (in_array($ocppStatus, ['Faulted', 'Unavailable'], true)) {
                $borne->status = $etat;
            }

            return;
        }

        $connecteurs = collect($borne->connecteurs ?? []);
        $existingIndex = $connecteurs->search(fn (array $c) => ($c['id'] ?? null) === (string) $connectorId);
        $existing = $existingIndex !== false ? $connecteurs[$existingIndex] : null;

        $entry = [
            'id' => (string) $connectorId,
            'type' => $existing['type'] ?? 'AC',
            'puissance' => $existing['puissance'] ?? $borne->puissance,
            'etat' => $etat,
            'disponible' => $etat === 'Disponible',
        ];

        if ($existingIndex !== false) {
            $connecteurs->put($existingIndex, $entry);
        } else {
            $connecteurs->push($entry);
        }

        $borne->connecteurs = $connecteurs->values()->all();
        $borne->status = $this->recomputeAggregateStatus($borne->connecteurs);
    }

    private function mapConnectorStatus(string $ocppStatus): string
    {
        return match ($ocppStatus) {
            'Available' => 'Disponible',
            'Preparing', 'Charging', 'Finishing', 'SuspendedEVSE', 'SuspendedEV', 'Reserved' => 'Occupée',
            'Unavailable' => 'Maintenance',
            'Faulted' => 'Défaut',
            default => 'Déconnectée',
        };
    }

    private function recomputeAggregateStatus(array $connecteurs): string
    {
        $etats = collect($connecteurs)->pluck('etat');

        return match (true) {
            $etats->contains('Défaut') => 'Défaut',
            $etats->contains('Occupée') => 'Occupée',
            $etats->contains('Maintenance') => 'Maintenance',
            default => 'Disponible',
        };
    }
}
