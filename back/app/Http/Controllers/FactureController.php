<?php

namespace App\Http\Controllers;

use App\Models\Facture;
use App\Models\Paiement;
use App\Support\FacturationService;
use App\Support\PaiementService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * Facturation (Module 9) : consultation, émission, règlement et facture PDF.
 */
class FactureController extends Controller
{
    public function __construct(
        private readonly FacturationService $facturation,
        private readonly PaiementService $paiements,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filtres = $request->validate([
            'statut' => ['nullable', Rule::in(Facture::STATUTS)],
            'user_id' => ['nullable', 'integer'],
            'recherche' => ['nullable', 'string', 'max:150'],
            'en_retard' => ['nullable', 'boolean'],
        ]);

        $factures = Facture::with(['chargeSession.borne', 'paiements'])
            ->when($filtres['statut'] ?? null, fn ($q, $v) => $q->where('statut', $v))
            ->when($filtres['user_id'] ?? null, fn ($q, $v) => $q->where('user_id', $v))
            ->when(
                $filtres['recherche'] ?? null,
                fn ($q, $v) => $q->where(function ($sous) use ($v) {
                    $sous->where('numero', 'like', '%'.$v.'%')
                        ->orWhere('user_nom', 'like', '%'.$v.'%');
                })
            )
            ->when(
                $filtres['en_retard'] ?? false,
                fn ($q) => $q->where('statut', Facture::STATUT_IMPAYEE)
                    ->whereNotNull('echeance')
                    ->whereDate('echeance', '<', now()->toDateString())
            )
            ->orderByDesc('id')
            ->limit(300)
            ->get();

        return response()->json($factures->map->toFrontendArray());
    }

    /**
     * Émet les factures des sessions terminées qui n'en ont pas encore —
     * rattrapage pour les sessions antérieures à la mise en service du module.
     */
    public function generer(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jours_echeance' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        $bilan = $this->facturation->emettreLesManquantes($data['jours_echeance'] ?? null);

        return response()->json([
            'message' => $bilan['emises'] === 0
                ? 'Aucune session à facturer.'
                : "{$bilan['emises']} facture(s) émise(s).",
            ...$bilan,
        ]);
    }

    public function regler(Request $request, Facture $facture): JsonResponse
    {
        $data = $request->validate([
            'moyen' => ['required', Rule::in(Paiement::MOYENS)],
            'reference' => ['nullable', 'string', 'max:100'],
            'jours_echeance' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        // Un paiement différé n'a de sens qu'assorti d'une date limite ; sans
        // échéance, « différé » ne serait qu'un impayé sans fin.
        if ($data['moyen'] === Paiement::MOYEN_DIFFERE) {
            $facture->update([
                'echeance' => now()->addDays($data['jours_echeance'] ?? 30)->toDateString(),
            ]);
        }

        try {
            $paiement = $this->paiements->regler($facture, $data['moyen'], $data['reference'] ?? null);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $facture->refresh()->load(['chargeSession.borne', 'paiements']);

        return response()->json([
            'message' => $data['moyen'] === Paiement::MOYEN_DIFFERE
                ? "Règlement différé enregistré, échéance au {$facture->echeance?->format('d/m/Y')}."
                : "Facture {$facture->numero} réglée.",
            'facture' => $facture->toFrontendArray(),
            'paiement' => $paiement->toFrontendArray(),
        ]);
    }

    /**
     * Facture au format PDF (Module 9 « Factures PDF »), rendue à la volée
     * plutôt que stockée : elle se déduit entièrement de données déjà figées
     * en base, un fichier de plus n'apporterait qu'un risque de divergence.
     */
    public function pdf(Facture $facture): Response
    {
        $facture->load(['chargeSession.borne', 'paiements', 'user']);

        $pdf = Pdf::loadView('factures.pdf', ['facture' => $facture]);

        return $pdf->download("{$facture->numero}.pdf");
    }
}
