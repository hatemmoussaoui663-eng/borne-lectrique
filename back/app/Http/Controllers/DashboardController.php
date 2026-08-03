<?php

namespace App\Http\Controllers;

use App\Models\Borne;
use App\Models\ChargeSession;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    private const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

    public function index(): JsonResponse
    {
        $bornes = Borne::all();
        $totalBornes = $bornes->count();
        $bornesActives = $bornes->whereIn('status', ['Disponible', 'Occupée'])->count();

        $today = now()->startOfDay();

        $sessionsAujourdhui = ChargeSession::where('started_at', '>=', $today)->count();
        $kwhDelivres = (float) ChargeSession::where('started_at', '>=', $today)->sum('energie_kwh');

        $completedToday = ChargeSession::where('started_at', '>=', $today)
            ->whereNotNull('stopped_at')
            ->get();

        $dureeMoyenneMin = $completedToday->isEmpty()
            ? 0
            : (int) round($completedToday->avg(
                fn (ChargeSession $s) => $s->started_at->diffInMinutes($s->stopped_at)
            ));

        return response()->json([
            'totalBornes' => $totalBornes,
            'bornesActives' => $bornesActives,
            'bornesIndisponibles' => $totalBornes - $bornesActives,
            'sessionsAujourdhui' => $sessionsAujourdhui,
            'kwhDelivres' => round($kwhDelivres, 2),
            'dureeMoyenneMin' => $dureeMoyenneMin,
            'consumptionSeries' => $this->buildConsumptionSeries(),
        ]);
    }

    /**
     * Energy delivered per day over the last 7 days (oldest first), for the
     * dashboard's consumption chart.
     */
    private function buildConsumptionSeries(): array
    {
        $days = collect(range(6, 0))->map(fn (int $i) => now()->subDays($i));

        return [
            'days' => $days->map(fn ($d) => self::DAY_LABELS[$d->dayOfWeek])->values(),
            'kwh' => $days->map(function ($d) {
                return round((float) ChargeSession::whereBetween('started_at', [
                    $d->copy()->startOfDay(),
                    $d->copy()->endOfDay(),
                ])->sum('energie_kwh'), 2);
            })->values(),
        ];
    }
}
