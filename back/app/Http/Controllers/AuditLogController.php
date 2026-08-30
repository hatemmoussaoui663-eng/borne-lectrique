<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Journal d'audit (Module 18) : consultation et export.
 *
 * En lecture seule, volontairement — aucune route ne crée, ne modifie ni ne
 * supprime une ligne. Les écritures viennent de l'observateur Eloquent
 * (AuditObserver) et du contrôleur d'authentification ; un journal qu'on
 * pourrait retoucher depuis l'API ne prouverait plus rien.
 */
class AuditLogController extends Controller
{
    private const PAR_PAGE_DEFAUT = 25;

    private const PAR_PAGE_MAX = 200;

    public function index(Request $request): JsonResponse
    {
        $filtres = $this->filtresValides($request);

        // Pagination côté serveur, contrairement aux autres listes du projet :
        // le journal grossit sans limite, tout renvoyer finirait par saturer la
        // réponse et le navigateur.
        $parPage = min((int) ($filtres['par_page'] ?? self::PAR_PAGE_DEFAUT), self::PAR_PAGE_MAX);

        $page = $this->requete($filtres)
            ->with('user')
            ->orderByDesc('id')
            ->paginate($parPage);

        return response()->json([
            'data' => $page->getCollection()->map->toFrontendArray()->values(),
            'total' => $page->total(),
            'page' => $page->currentPage(),
            'parPage' => $page->perPage(),
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $filtres = $this->filtresValides($request);

        $entetes = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="journal-audit-'.now()->format('Y-m-d').'.csv"',
        ];

        $requete = $this->requete($filtres)->orderByDesc('id');

        return response()->stream(function () use ($requete) {
            $handle = fopen('php://output', 'w');
            fprintf($handle, "\xEF\xBB\xBF"); // BOM UTF-8, pour qu'Excel rende les accents.

            fputcsv($handle, [
                'Date', 'Utilisateur', 'Rôle', 'Action', 'Entité',
                'Identifiant', 'Libellé', 'Détail des changements', 'IP',
            ]);

            // `chunk` plutôt qu'un `get()` : l'export peut porter sur des
            // dizaines de milliers de lignes sans les charger toutes en mémoire.
            $requete->chunk(500, function ($lignes) use ($handle) {
                foreach ($lignes as $ligne) {
                    $data = $ligne->toFrontendArray();
                    fputcsv($handle, [
                        $data['date'],
                        $data['utilisateur'],
                        $data['role'] ?? '',
                        $data['action'],
                        $data['entite'] ?? '',
                        $data['entiteId'] ?? '',
                        $data['libelle'],
                        $this->changementsLisibles($data['changements']),
                        $data['ip'] ?? '',
                    ]);
                }
            });

            fclose($handle);
        }, 200, $entetes);
    }

    /** @return array<string, mixed> */
    private function filtresValides(Request $request): array
    {
        return $request->validate([
            'action' => ['nullable', Rule::in(AuditLog::ACTIONS)],
            'entite' => ['nullable', 'string', 'max:100'],
            'user_id' => ['nullable', 'integer'],
            'recherche' => ['nullable', 'string', 'max:150'],
            'du' => ['nullable', 'date'],
            'au' => ['nullable', 'date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'par_page' => ['nullable', 'integer', 'min:1'],
        ]);
    }

    /** @param array<string, mixed> $filtres */
    private function requete(array $filtres): Builder
    {
        return AuditLog::query()
            ->when($filtres['action'] ?? null, fn (Builder $q, $v) => $q->where('action', $v))
            ->when($filtres['entite'] ?? null, fn (Builder $q, $v) => $q->where('entite', $v))
            ->when($filtres['user_id'] ?? null, fn (Builder $q, $v) => $q->where('user_id', $v))
            ->when(
                $filtres['recherche'] ?? null,
                fn (Builder $q, $v) => $q->where(function (Builder $sous) use ($v) {
                    $sous->where('user_nom', 'like', '%'.$v.'%')
                        ->orWhere('libelle', 'like', '%'.$v.'%');
                })
            )
            ->when(
                $filtres['du'] ?? null,
                fn (Builder $q, $v) => $q->where('created_at', '>=', $v.' 00:00:00')
            )
            ->when(
                $filtres['au'] ?? null,
                fn (Builder $q, $v) => $q->where('created_at', '<=', $v.' 23:59:59')
            );
    }

    /** Aplatit le diff JSON en une colonne CSV lisible. */
    private function changementsLisibles(?array $changements): string
    {
        if (empty($changements)) {
            return '';
        }

        $morceaux = [];

        foreach ($changements as $champ => $valeur) {
            if (is_array($valeur) && array_key_exists('avant', $valeur)) {
                $morceaux[] = $champ.' : '.($valeur['avant'] ?? '—').' → '.($valeur['apres'] ?? '—');

                continue;
            }

            $morceaux[] = $champ.' : '.(is_scalar($valeur) ? $valeur : json_encode($valeur, JSON_UNESCAPED_UNICODE));
        }

        return implode(' ; ', $morceaux);
    }
}
