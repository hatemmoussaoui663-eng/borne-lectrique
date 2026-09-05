<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

        $documents = Document::with(['borne', 'uploader', 'rolesDestinataires'])
            // Une sous-requête d'existence plutôt qu'un chargement des lecteurs :
            // la liste reste à deux requêtes quel que soit le nombre de comptes
            // ayant déjà ouvert les pièces.
            ->withExists(['lecteurs as lu_par_utilisateur' => fn ($query) => $query
                ->where('users.id', $request->user()?->id)])
            ->visiblePour($request->user())
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

    /**
     * Rôles proposables comme destinataires d'un document.
     *
     * Dérivés de la matrice de permissions §7 plutôt que codés en dur : cibler
     * un métier qui n'a pas accès au module produirait un document que
     * personne ne pourrait ouvrir.
     */
    public function destinatairesPossibles(): JsonResponse
    {
        $roles = Role::query()
            ->orderBy('id')
            ->get()
            ->filter(fn (Role $role) => $role->name !== 'super_admin'
                && (config("permissions.roles.{$role->name}.documents")
                    ?? config("permissions.roles.{$role->name}.*")) !== null)
            ->map(fn (Role $role) => [
                'id' => (string) $role->id,
                'nom' => $role->display_name ?? $role->name,
            ])
            ->values();

        return response()->json($roles);
    }

    /**
     * Nombre de documents jamais ouverts par l'utilisateur courant.
     *
     * Sert la pastille rouge du menu : un simple COUNT, sans charger les
     * fiches, pour que le layout puisse l'appeler à chaque navigation.
     */
    public function compteurNonLus(Request $request): JsonResponse
    {
        $utilisateur = $request->user();

        $total = Document::query()
            ->visiblePour($utilisateur)
            ->whereDoesntHave('lecteurs', fn ($query) => $query->where('users.id', $utilisateur?->id))
            ->count();

        return response()->json(['total' => $total]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'borne_id' => ['nullable', 'integer', Rule::exists('bornes', 'id')],
            'type' => ['required', Rule::in(Document::TYPES)],
            'titre' => ['required', 'string', 'max:150'],
            'date_expiration' => ['nullable', 'date'],
            // Aucun rôle transmis = document général, visible de tous les
            // métiers ayant accès au module.
            'roles' => ['nullable', 'array'],
            'roles.*' => ['integer', Rule::exists('roles', 'id')],
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
        // Fiche et ciblage dans la meme transaction : un ciblage perdu en
        // cours de route rendrait visible de tous une piece destinee a un
        // seul metier.
        try {
            $document = DB::transaction(function () use ($data, $chemin, $fichier, $request) {
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
                $document->rolesDestinataires()->sync($data['roles'] ?? []);

                return $document;
            });
        } catch (Throwable $e) {
            Storage::disk('local')->delete($chemin);

            throw $e;
        }

        // L'auteur du dépôt n'a rien à découvrir : sans ça son propre
        // document lui reviendrait signalé comme neuf.
        if ($utilisateur = $request->user()) {
            $document->marquerLuPar($utilisateur);
        }

        $document->load(['borne', 'uploader', 'rolesDestinataires']);

        return response()->json($document->toFrontendArray(), 201);
    }

    public function download(Request $request, Document $document): StreamedResponse
    {
        // Le filtrage de la liste ne protege que l'affichage : sans ce
        // controle, un document cible resterait telechargeable en devinant
        // son identifiant.
        if (! $document->estVisiblePar($request->user())) {
            abort(403, "Ce document ne s'adresse pas a votre role.");
        }

        if (! Storage::disk('local')->exists($document->chemin)) {
            abort(404, 'Le fichier est introuvable sur le serveur.');
        }

        // Télécharger ou prévisualiser, c'est consulter : le marqueur « nouveau »
        // s'éteint ici plutôt que sur un appel dédié que le front pourrait
        // oublier d'émettre.
        if ($utilisateur = $request->user()) {
            $document->marquerLuPar($utilisateur);
        }

        return Storage::disk('local')->download($document->chemin, $document->nom_fichier);
    }

    public function destroy(Request $request, Document $document): JsonResponse
    {
        // Meme regle que l'affichage : on ne supprime pas une piece qu'on n'a
        // pas le droit de voir. Le super admin, lui, voit tout et peut donc
        // faire le menage sur un ciblage errone.
        if (! $document->estVisiblePar($request->user())) {
            abort(403, "Ce document ne s'adresse pas a votre role.");
        }

        // Le fichier part avec la fiche : sans ça le disque accumulerait des
        // orphelins que plus rien ne référence.
        Storage::disk('local')->delete($document->chemin);
        $document->delete();

        return response()->json(['message' => 'Document supprimé.']);
    }
}
