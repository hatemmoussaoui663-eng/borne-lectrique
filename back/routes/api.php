<?php

use App\Http\Controllers\AbonnementController;
use App\Http\Controllers\AlerteController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\BorneController;
use App\Http\Controllers\ChargeSessionController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\FactureController;
use App\Http\Controllers\FirmwareController;
use App\Http\Controllers\MaintenanceTicketController;
use App\Http\Controllers\MeController;
use App\Http\Controllers\OcppCommandController;
use App\Http\Controllers\OcppIngestController;
use App\Http\Controllers\PaiementController;
use App\Http\Controllers\RapportController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\SimulatorController;
use App\Http\Controllers\TarifController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WalletController;
use App\Http\Controllers\VehiculeController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // Read-only network status, shared by staff (Bornes admin page) and the
    // "Client" role (Espace Client's availability map) alike.
    Route::get('/bornes', [BorneController::class, 'index']);
    // Doit rester avant /bornes/{borne} : sans quoi le paramètre de route
    // capturerait le mot « proches » et chercherait une borne d'id « proches ».
    Route::get('/bornes/proches', [BorneController::class, 'proches']);
    Route::get('/bornes/{borne}', [BorneController::class, 'show']);

    // Espace Client: self-scoped endpoints, usable by any authenticated user.
    // The "Client" role's portal only ever calls these plus the read-only
    // /bornes routes above — never the staff-only resources below.
    Route::prefix('me')->group(function () {
        Route::get('/sessions', [MeController::class, 'sessions']);
        Route::get('/vehicules', [MeController::class, 'vehicules']);
        Route::post('/vehicules', [MeController::class, 'storeVehicule']);
        Route::put('/vehicules/{vehicule}', [MeController::class, 'updateVehicule']);
        Route::delete('/vehicules/{vehicule}', [MeController::class, 'destroyVehicule']);
        // Suivi GPS : position émise par le véhicule lui-même.
        Route::post('/vehicules/{vehicule}/position', [MeController::class, 'majPosition']);
        // §5 : compléter le véhicule d'une session qu'OCPP n'a pas su déterminer.
        Route::put('/sessions/{session}/vehicule', [MeController::class, 'affecterVehicule']);

        // Module 9 côté Client : consultation seule (§7 « Paiement : Lecture »).
        Route::get('/factures', [MeController::class, 'factures']);
        Route::get('/factures/{facture}/pdf', [MeController::class, 'facturePdf']);
        Route::get('/wallet', [MeController::class, 'wallet']);
        Route::get('/abonnements', [MeController::class, 'abonnements']);
    });

    // Operator/admin back-office: forbidden to the "Client" role even with a
    // valid token (see EnsureStaffRole). Within staff, `permission:<module>`
    // (see config/permissions.php, cahier des charges §7) further restricts
    // each route to the roles allowed to read/write that specific module —
    // e.g. a Technicien can write Maintenance but only read Bornes.
    Route::middleware('staff')->group(function () {
        Route::middleware('permission:bornes')->group(function () {
            Route::apiResource('bornes', BorneController::class)->except(['index', 'show']);
        });

        Route::middleware('permission:utilisateurs')->group(function () {
            Route::apiResource('users', UserController::class)->only(['index', 'show']);
            Route::put('/users/{user}/badge', [UserController::class, 'updateBadge']);
            Route::get('/roles', [RoleController::class, 'index']);
        });

        // Account CRUD (create/update/delete) and role creation are both
        // reserved to the Super Administrateur — Exploitant/Service Client
        // keep read access to /users above (and can still manage RFID badges,
        // a separate day-to-day operational task) but cannot themselves
        // create, edit, or delete an account.
        Route::middleware('super_admin')->group(function () {
            Route::post('/users', [UserController::class, 'store']);
            Route::put('/users/{user}', [UserController::class, 'update']);
            Route::delete('/users/{user}', [UserController::class, 'destroy']);
            Route::post('/roles', [RoleController::class, 'store']);
        });

        Route::middleware('permission:sessions')->group(function () {
            Route::get('/sessions', [ChargeSessionController::class, 'index']);
        });

        Route::middleware('permission:dashboard')->group(function () {
            Route::get('/dashboard', [DashboardController::class, 'index']);
        });

        Route::middleware('permission:alertes')->group(function () {
            Route::get('/alertes', [AlerteController::class, 'index']);
            Route::patch('/alertes/{alerte}/read', [AlerteController::class, 'markRead']);
        });

        Route::middleware('permission:tarif')->group(function () {
            Route::get('/tarif', [TarifController::class, 'show']);
            Route::put('/tarif', [TarifController::class, 'update']);
        });

        Route::middleware('permission:vehicules')->group(function () {
            Route::apiResource('vehicules', VehiculeController::class)->except(['show']);
        });

        Route::middleware('permission:maintenance')->group(function () {
            Route::apiResource('maintenance-tickets', MaintenanceTicketController::class)->except(['show']);
        });

        // Journal d'audit (Module 18) : consultation et export uniquement.
        // Aucune route d'écriture — le journal est alimenté par l'observateur
        // Eloquent et par AuthController, jamais depuis l'API.
        Route::middleware('permission:audit')->group(function () {
            Route::get('/audit-logs', [AuditLogController::class, 'index']);
            Route::get('/audit-logs/export', [AuditLogController::class, 'export']);
        });

        // Paiement (Module 9) : facturation, règlements, porte-monnaie et
        // abonnements. Le PDF est un GET, donc accessible aux rôles en lecture.
        Route::middleware('permission:paiement')->group(function () {
            Route::get('/factures', [FactureController::class, 'index']);
            Route::post('/factures/generer', [FactureController::class, 'generer']);
            Route::get('/factures/{facture}/pdf', [FactureController::class, 'pdf']);
            Route::post('/factures/{facture}/regler', [FactureController::class, 'regler']);

            Route::get('/paiements', [PaiementController::class, 'index']);
            Route::post('/paiements/{paiement}/rembourser', [PaiementController::class, 'rembourser']);

            Route::get('/wallets', [WalletController::class, 'index']);
            Route::get('/wallets/{wallet}', [WalletController::class, 'show']);
            Route::post('/wallets/crediter', [WalletController::class, 'crediter']);
            // Correction d'un rechargement erroné. Pas de DELETE : un mouvement
            // de porte-monnaie se contre-passe, il ne s'efface pas.
            Route::post('/wallets/debiter', [WalletController::class, 'debiter']);
            Route::post('/wallets/transactions/{transaction}/annuler', [WalletController::class, 'annulerTransaction']);

            Route::get('/abonnement-plans', [AbonnementController::class, 'plans']);
            Route::post('/abonnement-plans', [AbonnementController::class, 'storePlan']);
            Route::put('/abonnement-plans/{plan}', [AbonnementController::class, 'updatePlan']);
            Route::delete('/abonnement-plans/{plan}', [AbonnementController::class, 'destroyPlan']);

            Route::get('/abonnements', [AbonnementController::class, 'index']);
            Route::post('/abonnements', [AbonnementController::class, 'souscrire']);
            Route::post('/abonnements/{abonnement}/resilier', [AbonnementController::class, 'resilier']);
        });

        // Gestion Firmware (Module 13) : bibliothèque, déploiement, historique
        // et rollback. Le téléchargement du binaire par la borne passe par une
        // route signée hors session, déclarée plus bas.
        Route::middleware('permission:firmware')->group(function () {
            Route::get('/firmwares', [FirmwareController::class, 'index']);
            Route::post('/firmwares', [FirmwareController::class, 'store']);
            Route::delete('/firmwares/{firmware}', [FirmwareController::class, 'destroy']);
            Route::post('/firmwares/{firmware}/deployer', [FirmwareController::class, 'deployer']);
            Route::get('/firmware-deployments', [FirmwareController::class, 'deployments']);
            Route::post('/firmware-deployments/{deployment}/rollback', [FirmwareController::class, 'rollback']);
        });

        // Gestion documentaire (Module 16) : notices, photos, contrats, plans
        // et garanties. Le téléchargement est un GET, donc ouvert aux rôles en
        // lecture seule ; l’ajout et la suppression exigent 'full'.
        Route::middleware('permission:documents')->group(function () {
            Route::get('/documents', [DocumentController::class, 'index']);
            // Avant /documents/{document} : sans ça le segment littéral
            // serait avalé comme un identifiant de document.
            Route::get('/documents/compteur-non-lus', [DocumentController::class, 'compteurNonLus']);
            Route::get('/documents/destinataires', [DocumentController::class, 'destinatairesPossibles']);
            Route::post('/documents', [DocumentController::class, 'store']);
            Route::get('/documents/{document}/download', [DocumentController::class, 'download']);
            Route::delete('/documents/{document}', [DocumentController::class, 'destroy']);
        });

        Route::middleware('permission:rapports')->group(function () {
            Route::get('/rapports/export', [RapportController::class, 'exportSessions']);
        });

        // Commandes OCPP sortantes (Module 6) — actions envoyées à la borne,
        // pas des événements qu'elle rapporte.
        Route::middleware('permission:commandes_ocpp')->prefix('bornes/{borne}/commands')->group(function () {
            Route::post('/remote-start', [OcppCommandController::class, 'remoteStart']);
            Route::post('/remote-stop', [OcppCommandController::class, 'remoteStop']);
            Route::post('/unlock-connector', [OcppCommandController::class, 'unlockConnector']);
            Route::post('/reset', [OcppCommandController::class, 'reset']);
        });

        Route::middleware('permission:simulateur')->prefix('simulator')->group(function () {
            Route::get('/status', [SimulatorController::class, 'status']);
            Route::post('/start', [SimulatorController::class, 'start']);
            Route::post('/stop', [SimulatorController::class, 'stop']);
        });
    });
});

// Machine-to-machine: called by the ocpp-central-system Node process, not by the SPA.
Route::middleware('ocpp.internal')->prefix('internal/ocpp')->group(function () {
    Route::post('/boot-notification', [OcppIngestController::class, 'bootNotification']);
    Route::post('/authorize', [OcppIngestController::class, 'authorize']);
    Route::post('/heartbeat', [OcppIngestController::class, 'heartbeat']);
    Route::post('/status-notification', [OcppIngestController::class, 'statusNotification']);
    Route::post('/start-transaction', [OcppIngestController::class, 'startTransaction']);
    Route::post('/meter-values', [OcppIngestController::class, 'meterValues']);
    Route::post('/stop-transaction', [OcppIngestController::class, 'stopTransaction']);
    Route::post('/firmware-status-notification', [OcppIngestController::class, 'firmwareStatusNotification']);
    Route::post('/disconnect', [OcppIngestController::class, 'disconnect']);
});

// Téléchargement du binaire par la borne (Module 13). Hors Sanctum : une borne
// n'a pas de session. L'URL est signée et expire — voir FirmwareController.
Route::get('/firmwares/{firmware}/telecharger', [FirmwareController::class, 'telecharger'])
    ->middleware('signed')
    ->name('firmware.telecharger');
