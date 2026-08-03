<?php

use App\Http\Controllers\AlerteController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\BorneController;
use App\Http\Controllers\ChargeSessionController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\OcppIngestController;
use App\Http\Controllers\SimulatorController;
use App\Http\Controllers\TarifController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);

// Bornes resource (CRUD) - protected by Sanctum

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::apiResource('bornes', BorneController::class);
    Route::apiResource('users', UserController::class);
    Route::get('/sessions', [ChargeSessionController::class, 'index']);
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/alertes', [AlerteController::class, 'index']);
    Route::patch('/alertes/{alerte}/read', [AlerteController::class, 'markRead']);
    Route::get('/tarif', [TarifController::class, 'show']);
    Route::put('/tarif', [TarifController::class, 'update']);

    Route::prefix('simulator')->group(function () {
        Route::get('/status', [SimulatorController::class, 'status']);
        Route::post('/start', [SimulatorController::class, 'start']);
        Route::post('/stop', [SimulatorController::class, 'stop']);
    });
});

// Machine-to-machine: called by the ocpp-central-system Node process, not by the SPA.
Route::middleware('ocpp.internal')->prefix('internal/ocpp')->group(function () {
    Route::post('/boot-notification', [OcppIngestController::class, 'bootNotification']);
    Route::post('/heartbeat', [OcppIngestController::class, 'heartbeat']);
    Route::post('/status-notification', [OcppIngestController::class, 'statusNotification']);
    Route::post('/start-transaction', [OcppIngestController::class, 'startTransaction']);
    Route::post('/meter-values', [OcppIngestController::class, 'meterValues']);
    Route::post('/stop-transaction', [OcppIngestController::class, 'stopTransaction']);
    Route::post('/disconnect', [OcppIngestController::class, 'disconnect']);
});
