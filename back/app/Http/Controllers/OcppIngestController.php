<?php

namespace App\Http\Controllers;

use App\Events\AlerteUpdated;
use App\Events\BorneUpdated;
use App\Events\ChargeSessionUpdated;
use App\Models\Alerte;
use App\Models\Badge;
use App\Models\Borne;
use App\Models\ChargeSession;
use App\Models\FirmwareDeployment;
use App\Models\Tarif;
use App\Models\Vehicule;
use App\Support\FacturationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

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

    public function authorize(Request $request): JsonResponse
    {
        $data = $request->validate([
            'idTag' => 'nullable|string|max:255',
        ]);

        return response()->json(['status' => $this->resolveIdTagStatus($data['idTag'] ?? null)]);
    }

    public function startTransaction(Request $request): JsonResponse
    {
        $data = $request->validate([
            'chargePointId' => 'required|string|max:255',
            'connectorId' => 'required|integer|min:0',
            'idTag' => 'nullable|string|max:255',
            'meterStart' => 'nullable|integer|min:0',
        ]);

        $idTag = $data['idTag'] ?? null;
        $idTagStatus = $this->resolveIdTagStatus($idTag);

        // A blocked/expired badge never opens a session — the CSMS refuses the
        // transaction outright, mirroring how a real charge point would react.
        if ($idTagStatus !== 'Accepted') {
            return response()->json(['transactionId' => 0, 'idTagStatus' => $idTagStatus]);
        }

        $borne = $this->resolveBorne($data['chargePointId']);
        $badge = $idTag !== null ? Badge::where('code', $idTag)->first() : null;

        $session = ChargeSession::create([
            'borne_id' => $borne->id,
            'connector_id' => $data['connectorId'],
            'id_tag' => $idTag,
            'user_id' => $badge?->user_id,
            'vehicule_id' => $this->resolveVehiculeId($badge?->user_id),
            'meter_start' => $data['meterStart'] ?? null,
            'status' => 'En cours',
            'started_at' => now(),
        ]);

        $this->applyConnectorStatus($borne, (int) $data['connectorId'], 'Charging');
        $borne->last_heartbeat_at = now();
        $borne->save();

        ChargeSessionUpdated::dispatch($session);
        BorneUpdated::dispatch($borne);

        return response()->json(['transactionId' => $session->id, 'idTagStatus' => 'Accepted']);
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
        $session->prix = round($session->energie_kwh * Tarif::current()->prix_kwh, 3);
        $session->status = 'Terminée';
        $session->stopped_at = now();
        $session->save();

        ChargeSessionUpdated::dispatch($session);

        // Facturation (Module 9) : une session close et rattachée à un client
        // donne lieu à une facture. Isolée dans un try/catch parce qu'un
        // incident de facturation ne doit pas faire échouer l'acquittement OCPP
        // — la borne resterait alors bloquée sur une transaction ouverte. Les
        // sessions manquées se rattrapent via POST /api/factures/generer.
        try {
            app(FacturationService::class)->emettrePourSession($session);
        } catch (Throwable $e) {
            Log::error("Facturation de la session {$session->id} impossible : {$e->getMessage()}");
        }

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
            $this->maybeRaiseAlert($borne, 0, 'deconnexion', 'critical', "{$borne->name} déconnectée du système central");
        }

        return response()->json(['ok' => true]);
    }

    /**
     * FirmwareStatusNotification (OCPP 1.6 §4.4), suivi du Module 13 : la borne
     * rend compte de sa mise à jour. C'est le seul retour dont on dispose — la
     * réponse à `UpdateFirmware` n'accuse que la réception de l'ordre, pas son
     * issue, qui n'arrive que par ces notifications successives.
     */
    public function firmwareStatusNotification(Request $request): JsonResponse
    {
        $data = $request->validate([
            'chargePointId' => 'required|string|max:255',
            'status' => 'required|string|max:50',
        ]);

        $borne = $this->resolveBorne($data['chargePointId']);

        $deployment = FirmwareDeployment::where('borne_id', $borne->id)
            ->whereIn('statut', FirmwareDeployment::STATUTS_EN_COURS)
            ->latest('id')
            ->first();

        // Une borne émet aussi des statuts sans qu'on ait rien demandé (`Idle`
        // au démarrage). Sans déploiement en cours, il n'y a rien à rattacher.
        if ($deployment === null) {
            return response()->json(['ok' => true, 'suivi' => false]);
        }

        $deployment->ocpp_status = $data['status'];
        $statut = FirmwareDeployment::MAPPING_OCPP[$data['status']] ?? null;

        if ($statut === null) {
            // Statut inconnu ou `Idle` : on garde le brut sans écraser un état
            // d'avancement déjà acquis.
            $deployment->save();

            return response()->json(['ok' => true, 'suivi' => false]);
        }

        $deployment->statut = $statut;

        if ($statut === FirmwareDeployment::STATUT_ECHEC) {
            $deployment->message = "La borne a signalé « {$data['status']} ».";
        }

        $deployment->save();

        if ($statut === FirmwareDeployment::STATUT_INSTALLE) {
            // La version portée par la borne ne change qu'ici : tant que
            // l'installation n'est pas confirmée, la fiche doit continuer
            // d'afficher l'ancienne.
            $borne->firmware = $deployment->firmware_version;
            $borne->save();
            BorneUpdated::dispatch($borne);
        }

        if ($statut === FirmwareDeployment::STATUT_ECHEC) {
            $this->maybeRaiseAlert(
                $borne,
                0,
                'firmware',
                'warning',
                "Échec de la mise à jour firmware {$deployment->firmware_version} sur {$borne->name}"
            );
        }

        return response()->json(['ok' => true, 'suivi' => true]);
    }

    /**
     * OCPP idTagInfo.status for a presented badge. Unregistered idTags are left
     * Accepted (the simulator's own generated tags aren't pre-provisioned as
     * badges) — only badges explicitly created via Module 7 can gate charging.
     */
    private function resolveIdTagStatus(?string $idTag): string
    {
        if ($idTag === null || $idTag === '') {
            return 'Accepted';
        }

        $badge = Badge::where('code', $idTag)->first();

        return $badge?->ocppStatus() ?? 'Accepted';
    }

    /**
     * Véhicule à rattacher à une session ouverte par ce client (§5 et §8).
     *
     * OCPP ne transporte aucune information de véhicule : le badge identifie le
     * porteur, pas sa voiture. On ne rattache donc que lorsqu'il n'y a aucune
     * ambiguïté — un seul véhicule au compte. Deviner parmi plusieurs, au type
     * de connecteur par exemple, finirait par attribuer une recharge à la
     * mauvaise voiture, et l'erreur se propagerait jusqu'à la facturation.
     * Une session ambiguë reste sans véhicule, à affecter depuis l'espace client.
     */
    private function resolveVehiculeId(?int $userId): ?int
    {
        if ($userId === null) {
            return null;
        }

        $vehicules = Vehicule::where('user_id', $userId)->pluck('id');

        return $vehicules->count() === 1 ? (int) $vehicules->first() : null;
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
            if ($ocppStatus === 'Faulted') {
                $this->maybeRaiseAlert($borne, 0, 'defaut_materiel', 'critical', "Défaut matériel sur {$borne->name}");
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

        if ($ocppStatus === 'Faulted') {
            $this->maybeRaiseAlert(
                $borne,
                $connectorId,
                'defaut_materiel',
                'critical',
                "Défaut matériel sur le connecteur {$connectorId} de {$borne->name}"
            );
        }
    }

    /**
     * Raise a new alert unless an unread one of the same (borne, connector, type)
     * already exists — keeps a flapping OCPP status from spamming duplicates.
     */
    private function maybeRaiseAlert(Borne $borne, int $connectorId, string $type, string $severite, string $message): void
    {
        $hasUnread = Alerte::where('borne_id', $borne->id)
            ->where('connector_id', $connectorId)
            ->where('type', $type)
            ->whereNull('read_at')
            ->exists();

        if ($hasUnread) {
            return;
        }

        $alerte = Alerte::create([
            'borne_id' => $borne->id,
            'connector_id' => $connectorId,
            'type' => $type,
            'severite' => $severite,
            'message' => $message,
        ]);

        AlerteUpdated::dispatch($alerte);
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
