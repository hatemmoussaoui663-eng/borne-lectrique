<?php

use App\Http\Controllers\AlerteController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\BorneController;
use App\Http\Controllers\ChargeSessionController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\MaintenanceTicketController;
use App\Http\Controllers\MeController;
use App\Http\Controllers\OcppCommandController;
use App\Http\Controllers\OcppIngestController;
use App\Http\Controllers\RapportController;
use App\Http\Controllers\SimulatorController;
use App\Http\Controllers\TarifController;
use App\Http\Controllers\UserController;
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
    });

    // Operator/admin back-office: forbidden to the "Client" role even with a
    // valid token (see EnsureStaffRole) — the frontend's route guards are not
    // the only thing standing between a client's session and this data.
    Route::middleware('staff')->group(function () {
        Route::apiResource('bornes', BorneController::class)->except(['index', 'show']);
        Route::apiResource('users', UserController::class);
        Route::put('/users/{user}/badge', [UserController::class, 'updateBadge']);
        Route::get('/sessions', [ChargeSessionController::class, 'index']);
        Route::get('/dashboard', [DashboardController::class, 'index']);
        Route::get('/alertes', [AlerteController::class, 'index']);
        Route::patch('/alertes/{alerte}/read', [AlerteController::class, 'markRead']);
        Route::get('/tarif', [TarifController::class, 'show']);
        Route::put('/tarif', [TarifController::class, 'update']);
        Route::apiResource('vehicules', VehiculeController::class)->except(['show']);
        Route::apiResource('maintenance-tickets', MaintenanceTicketController::class)->except(['show']);
        Route::get('/rapports/export', [RapportController::class, 'exportSessions']);

        // Commandes OCPP sortantes (Module 6) — actions envoyées à la borne,
        // pas des événements qu'elle rapporte.
        Route::prefix('bornes/{borne}/commands')->group(function () {
            Route::post('/remote-start', [OcppCommandController::class, 'remoteStart']);
            Route::post('/remote-stop', [OcppCommandController::class, 'remoteStop']);
            Route::post('/unlock-connector', [OcppCommandController::class, 'unlockConnector']);
            Route::post('/reset', [OcppCommandController::class, 'reset']);
        });

        Route::prefix('simulator')->group(function () {
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
    Route::post('/disconnect', [OcppIngestController::class, 'disconnect']);
});
