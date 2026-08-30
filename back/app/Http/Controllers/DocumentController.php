<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

/**
 * Gestion documentaire (Module 16) : notices, photos, contrats, plans et
 * garanties rattachés aux bornes.
 *
 * Les fichiers sont stockés sur le disque privé (storage/app/private/documents)
 * et jamais exposés en statique : le téléchargement repasse par
 * `download()`, donc par Sanctum et par la matrice de permissions §7. Un lien
 * public aurait rendu accessible à quiconque un contrat ou un plan
 * d'installation en devinant l'URL.
 */
class DocumentController extends Controller
{
    /** Aligné sur upload_max_filesize (40M) avec de la marge : 20 Mo par fichier. */
    private const TAILLE_MAX_KO = 20480;

    public function index(Request $request): JsonResponse
    {
        $filtres = $request->validate([
            'borne_id' => ['nullable', 'integer', Rule::exists('bornes', 'id')],
            'type' => ['nullable', Rule::in(Document::TYPES)],
        ]);

        $documents = Document::with(['borne', 'uploader'])
            ->when(
                $filtres['borne_id'] ?? null,
                fn ($query, $borneId) => $query->where('borne_id', $borneId)
            )
            ->when(
                $filtres['type'] ?? null,
                fn ($query, $type) => $query->where('type', $type)
            )
            ->orderByDesc('id')
            ->get();

        return response()->json($documents->map->toFrontendArray());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'borne_id' => ['nullable', 'integer', Rule::exists('bornes', 'id')],
            'type' => ['required', Rule::in(Document::TYPES)],
            'titre' => ['required', 'string', 'max:150'],
            'date_expiration' => ['nullable', 'date'],
            'fichier' => [
                'required',
                'file',
                'max:'.self::TAILLE_MAX_KO,
                // `extensions` plutôt que `mimes` : les plans CAO (.dwg) n'ont
                // pas d'entrée dans la table MIME de Laravel et seraient
                // systématiquement rejetés.
                'extensions:pdf,jpg,jpeg,png,webp,doc,docx,xls,xlsx,dwg,zip',
            ],
        ]);

        $fichier = $request->file('fichier');
        $chemin = $fichier->store('documents', 'local');

        // Le fichier est déjà écrit sur le disque : si l'insertion échoue, il
        // faut le reprendre, sinon chaque erreur laisse derrière elle un
        // orphelin que plus aucune ligne ne référence et que rien ne nettoiera.
        try {
            $document = Document::create([
                'borne_id' => $data['borne_id'] ?? null,
                'type' => $data['type'],
                'titre' => $data['titre'],
                'chemin' => $chemin,
                'nom_fichier' => $fichier->getClientOriginalName(),
                'mime' => $fichier->getClientMimeType(),
                'taille' => $fichier->getSize(),
                // Une échéance n'a de sens que sur un contrat ou une garantie ;
                // sur une notice elle est ignorée plutôt que stockée à tort.
                'date_expiration' => in_array($data['type'], Document::TYPES_AVEC_ECHEANCE, true)
                    ? ($data['date_expiration'] ?? null)
                    : null,
                'uploaded_by' => $request->user()?->id,
            ]);
        } catch (Throwable $e) {
            Storage::disk('local')->delete($chemin);

            throw $e;
        }

        $document->load(['borne', 'uploader']);

        return response()->json($document->toFrontendArray(), 201);
    }

    public function download(Document $document): StreamedResponse
    {
        if (! Storage::disk('local')->exists($document->chemin)) {
            abort(404, 'Le fichier est introuvable sur le serveur.');
        }

        return Storage::disk('local')->download($document->chemin, $document->nom_fichier);
    }

    public function destroy(Document $document): JsonResponse
    {
        // Le fichier part avec la fiche : sans ça le disque accumulerait des
        // orphelins que plus rien ne référence.
        Storage::disk('local')->delete($document->chemin);
        $document->delete();

        return response()->json(['message' => 'Document supprimé.']);
    }
}
