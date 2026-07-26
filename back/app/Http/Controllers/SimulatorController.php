<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class SimulatorController extends Controller
{
    public function status(): JsonResponse
    {
        return $this->forwardRequest('simulatorState', []);
    }

    public function start(Request $request): JsonResponse
    {
        return $this->forwardRequest('startSimulator', $request->all());
    }

    public function stop(Request $request): JsonResponse
    {
        return $this->forwardRequest('stopSimulator', $request->all());
    }

    private function forwardRequest(string $procedure, array $payload): JsonResponse
    {
        $url = $this->buildSimulatorUrl($procedure);

        try {
            $response = Http::withBasicAuth(
                $this->getSetting('SIMULATOR_UI_USERNAME', 'admin'),
                $this->getSetting('SIMULATOR_UI_PASSWORD', 'admin')
            )->post($url, $payload);

            $data = $response->json();

            return response()->json([
                'connected' => $response->successful(),
                'status' => $data['status'] ?? ($response->successful() ? 'success' : 'failure'),
                'state' => $data['state'] ?? [],
                'message' => $data['errorMessage'] ?? null,
            ], $response->status());
        } catch (\Throwable $exception) {
            return response()->json([
                'connected' => false,
                'status' => 'failure',
                'state' => [],
                'message' => $exception->getMessage(),
            ], 502);
        }
    }

    private function buildSimulatorUrl(string $procedure): string
    {
        $baseUrl = rtrim($this->getSetting('SIMULATOR_UI_BASE_URL', 'http://127.0.0.1:8080'), '/');

        // The simulator's UI protocol version (in the URL path) is fixed at
        // 0.0.1 (see ProtocolVersion in the simulator's src/types/UIProtocol.ts).
        // It is unrelated to uiServer.version ("1.1") in the simulator's
        // config.json, which selects the HTTP/1.1 vs HTTP/2 transport.
        return $baseUrl . '/ui/0.0.1/' . ltrim($procedure, '/');
    }

    private function getSetting(string $name, string $default): string
    {
        return (string) env($name, $default);
    }
}
