<?php

namespace App\Http\Controllers;

use App\Models\Badge;
use App\Models\Borne;
use App\Models\Tarif;
use App\Models\Vehicule;
use App\Models\Wallet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Contexte du simulateur de recharge de l'espace client (Module 5).
 *
 * Le simulateur lui-même parle OCPP 1.6-J : le navigateur ouvre une
 * WebSocket vers le serveur central et se comporte en borne. Ce contrôleur ne
 * sert donc qu'à lui fournir de quoi composer ses trames — badge, véhicule,
 * tarif — et l'identifiant du point de charge à utiliser. Aucune donnée de
 * session ne transite par ici : elle remonte par la voie OCPP normale.
 */
class SimulateurClientController extends Controller
{
    /**
     * Point de charge réservé à la démonstration.
     *
     * Distinct de CS-BASIC-00001, qu'occupe le simulateur de bornes : le
     * serveur central n'indexe qu'une connexion par identifiant, deux clients
     * sous le même nom se déconnecteraient mutuellement.
     */
    public const CHARGE_POINT_ID = 'SIM-CLIENT-01';

    public function contexte(Request $request): JsonResponse
    {
        $client = $request->user();

        $badge = Badge::where('user_id', $client->id)->first();
        $vehicule = Vehicule::where('user_id', $client->id)->first();
        $tarif = Tarif::first();
        $borne = $this->borneDeDemonstration();

        return response()->json([
            'client' => [
                'id' => (string) $client->id,
                'nom' => $client->name,
                'email' => $client->email,
            ],
            // Sans badge actif, la borne refusera l'autorisation : le front
            // l'annonce avant de laisser démarrer plutôt qu'après le refus.
            'badge' => $badge === null ? null : [
                'code' => $badge->code,
                'statut' => $badge->status,
                'expireLe' => $badge->expires_at?->toDateString(),
            ],
            'vehicule' => $vehicule === null ? null : [
                'id' => (string) $vehicule->id,
                'marque' => $vehicule->marque,
                'modele' => $vehicule->modele,
                'immatriculation' => $vehicule->immatriculation,
                'connecteur' => $vehicule->connecteur_type,
                'capaciteKwh' => (float) $vehicule->capacite_kwh,
            ],
            'solde' => (float) Wallet::pour($client)->solde,
            'tarif' => [
                'prixKwh' => (float) ($tarif->prix_kwh ?? 0),
                'tvaTaux' => (float) ($tarif->tva_taux ?? 0),
            ],
            'borne' => [
                'chargePointId' => $borne->charge_point_id,
                'nom' => $borne->name,
                'puissanceKw' => (float) $borne->puissance,
            ],
        ]);
    }

    /**
     * Borne dédiée au simulateur, créée à la première utilisation.
     *
     * Elle vit dans le parc comme les autres : l'exploitant voit donc la
     * session du client apparaître en direct sur son tableau de bord, ce qui
     * est précisément ce qu'on veut démontrer.
     */
    private function borneDeDemonstration(): Borne
    {
        return Borne::firstOrCreate(
            ['charge_point_id' => self::CHARGE_POINT_ID],
            [
                'name' => 'Borne de démonstration',
                'status' => 'Disponible',
                'ocpp' => '1.6',
                'puissance' => 22,
                'connecteurs' => [],
                'latitude' => 36.8065,
                'longitude' => 10.1815,
            ]
        );
    }
}
