<?php

namespace App\Http\Controllers;

use App\Models\ChargeSession;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RapportController extends Controller
{
    public function exportSessions(): StreamedResponse
    {
        $sessions = ChargeSession::with(['borne', 'user'])->latest()->get();

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="sessions-'.now()->format('Y-m-d').'.csv"',
        ];

        return response()->stream(function () use ($sessions) {
            $handle = fopen('php://output', 'w');
            fprintf($handle, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel renders accents correctly.

            fputcsv($handle, ['Session', 'Borne', 'Connecteur', 'Utilisateur', 'Badge', 'Début', 'Fin', 'Durée (min)', 'Énergie (kWh)', 'Prix (DT)', 'État']);

            foreach ($sessions as $session) {
                $data = $session->toFrontendArray();
                fputcsv($handle, [
                    $data['id'],
                    $data['borne'],
                    $data['connecteur'],
                    $data['utilisateur'] ?? '',
                    $data['idTag'] ?? '',
                    $data['debut'] ?? '',
                    $data['fin'] ?? '',
                    $data['dureeMin'],
                    $data['energieKwh'],
                    $data['prix'],
                    $data['etat'],
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }
}
