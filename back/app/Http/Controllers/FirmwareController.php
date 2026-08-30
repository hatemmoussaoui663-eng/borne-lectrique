<?php

namespace App\Http\Controllers;

use App\Models\Borne;
use App\Models\Firmware;
use App\Models\FirmwareDeployment;
use App\Support\OcppClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

/**
 * Gestion Firmware (Module 13) : bibliothèque, déploiement, historique, rollback.
 *
 * Le déploiement s'appuie sur `UpdateFirmware` (OCPP 1.6 §9.4), qui ne transporte
 * pas le binaire : la borne reçoit une *URL* et va chercher le fichier elle-même.
 * Elle n'est pas authentifiée auprès de Laravel, d'où l'URL signée temporaire —
 * un lien public permanent aurait exposé les binaires du parc à qui les demande.
 */
class FirmwareController extends Controller
{
    /** 200 Mo : un firmware de borne est plus lourd qu'un document. */
    private const TAILLE_MAX_KO = 204800;

    /** Durée de vie du lien remis à la borne : le temps du téléchargement. */
    private const VALIDITE_LIEN_HEURES = 2;

    /**
     * Au-delà, un déploiement sans nouvelle de la borne est tenu pour perdu.
     * OCPP n'a aucun accusé de fin : si la borne ne rappelle jamais (coupure,
     * ordre ignoré, redémarrage au mauvais moment), rien ne viendrait clore la
     * ligne et elle bloquerait indéfiniment la borne et la suppression du binaire.
     */
    private const DELAI_ABANDON_MINUTES = 30;

    public function __construct(private readonly OcppClient $ocpp) {}

    // ---------------------------------------------------------------- Bibliothèque

    public function index(): JsonResponse
    {
        $firmwares = Firmware::with('uploader')
            ->withCount('deployments')
            ->orderByDesc('id')
            ->get();

        return response()->json($firmwares->map->toFrontendArray());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'version' => ['required', 'string', 'max:50'],
            'fabricant' => ['nullable', 'string', 'max:100'],
            'modele' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'fichier' => [
                'required',
                'file',
                'max:'.self::TAILLE_MAX_KO,
                'extensions:bin,hex,img,tar,gz,zip,fw',
            ],
        ]);

        // Deux binaires différents sous la même version pour le même matériel
        // rendraient l'historique et le rollback ambigus.
        $existe = Firmware::where('version', $data['version'])
            ->where('fabricant', $data['fabricant'] ?? null)
            ->where('modele', $data['modele'] ?? null)
            ->exists();

        if ($existe) {
            return response()->json([
                'message' => "La version {$data['version']} existe déjà pour ce matériel.",
            ], 422);
        }

        $fichier = $request->file('fichier');
        $chemin = $fichier->store('firmwares', 'local');

        try {
            $firmware = Firmware::create([
                'version' => $data['version'],
                'fabricant' => $data['fabricant'] ?? null,
                'modele' => $data['modele'] ?? null,
                'notes' => $data['notes'] ?? null,
                'chemin' => $chemin,
                'nom_fichier' => $fichier->getClientOriginalName(),
                'taille' => $fichier->getSize(),
                'checksum' => hash_file('sha256', Storage::disk('local')->path($chemin)),
                'uploaded_by' => $request->user()?->id,
            ]);
        } catch (Throwable $e) {
            // Même précaution que pour les documents : un échec après l'écriture
            // laisserait un binaire orphelin sur le disque.
            Storage::disk('local')->delete($chemin);

            throw $e;
        }

        $firmware->load('uploader')->loadCount('deployments');

        return response()->json($firmware->toFrontendArray(), 201);
    }

    public function destroy(Firmware $firmware): JsonResponse
    {
        // Une borne est peut-être en train de télécharger ce binaire depuis son
        // URL signée : le supprimer maintenant ferait échouer la mise à jour.
        $enCours = $firmware->deployments()
            ->whereIn('statut', FirmwareDeployment::STATUTS_EN_COURS)
            ->exists();

        if ($enCours) {
            return response()->json([
                'message' => 'Un déploiement de ce firmware est en cours ; attendez qu\'il se termine.',
            ], 422);
        }

        Storage::disk('local')->delete($firmware->chemin);
        // Les déploiements passés survivent (firmware_id passe à null) : ils
        // portent leur propre copie du numéro de version.
        $firmware->delete();

        return response()->json(['message' => 'Firmware supprimé de la bibliothèque.']);
    }

    /**
     * Servi à la borne elle-même, via l'URL signée placée dans `UpdateFirmware`.
     * Hors Sanctum : une borne n'a pas de session. La signature et l'expiration
     * portent seules la sécurité de ce point d'entrée.
     */
    public function telecharger(Firmware $firmware): StreamedResponse
    {
        if (! Storage::disk('local')->exists($firmware->chemin)) {
            abort(404, 'Binaire introuvable sur le serveur.');
        }

        return Storage::disk('local')->download($firmware->chemin, $firmware->nom_fichier);
    }

    // ---------------------------------------------------------------- Déploiement

    public function deployments(Request $request): JsonResponse
    {
        $filtres = $request->validate([
            'borne_id' => ['nullable', 'integer', Rule::exists('bornes', 'id')],
            'statut' => ['nullable', 'string', 'max:30'],
        ]);

        $this->cloreDeploiementsAbandonnes();

        $deployments = FirmwareDeployment::with('borne')
            ->when(
                $filtres['borne_id'] ?? null,
                fn ($q, $id) => $q->where('borne_id', $id)
            )
            ->when(
                $filtres['statut'] ?? null,
                fn ($q, $statut) => $q->where('statut', $statut)
            )
            ->orderByDesc('id')
            ->limit(200)
            ->get();

        return response()->json($deployments->map->toFrontendArray());
    }

    public function deployer(Request $request, Firmware $firmware): JsonResponse
    {
        $data = $request->validate([
            'borne_ids' => ['required', 'array', 'min:1'],
            'borne_ids.*' => ['integer', Rule::exists('bornes', 'id')],
        ]);

        $this->cloreDeploiementsAbandonnes();

        $bornes = Borne::whereIn('id', $data['borne_ids'])->get();
        $resultats = [];

        foreach ($bornes as $borne) {
            $resultats[] = $this->envoyerMiseAJour($firmware, $borne, $request->user()?->name);
        }

        return response()->json([
            'message' => $this->resume($resultats),
            'resultats' => $resultats,
        ]);
    }

    public function rollback(Request $request, FirmwareDeployment $deployment): JsonResponse
    {
        if ($deployment->version_precedente === null) {
            return response()->json([
                'message' => 'Aucune version précédente connue pour ce déploiement.',
            ], 422);
        }

        // Revenir en arrière suppose que le binaire d'avant soit toujours en
        // bibliothèque : OCPP ne sait que pousser une URL, il n'existe pas de
        // « annuler » côté borne.
        $cible = Firmware::where('version', $deployment->version_precedente)->first();

        if ($cible === null) {
            return response()->json([
                'message' => "Le firmware {$deployment->version_precedente} n'est plus dans la bibliothèque : "
                    .'téléversez-le à nouveau pour pouvoir revenir en arrière.',
            ], 422);
        }

        $borne = $deployment->borne;

        if ($borne === null) {
            return response()->json(['message' => 'La borne de ce déploiement n\'existe plus.'], 422);
        }

        $resultat = $this->envoyerMiseAJour($cible, $borne, $request->user()?->name, estRollback: true);

        return response()->json([
            'message' => $resultat['succes']
                ? "Retour à la version {$cible->version} demandé sur {$borne->name}."
                : $resultat['message'],
            'resultats' => [$resultat],
        ], $resultat['succes'] ? 200 : 422);
    }

    // ---------------------------------------------------------------- Interne

    /**
     * Crée la ligne de suivi puis envoie l'ordre OCPP. La ligne est écrite
     * *avant* l'envoi : si la borne est injoignable, l'échec doit lui aussi
     * apparaître dans l'historique, c'est même l'information la plus utile.
     *
     * @return array{borne: string, succes: bool, message: ?string}
     */
    private function envoyerMiseAJour(
        Firmware $firmware,
        Borne $borne,
        ?string $demandeur,
        bool $estRollback = false,
    ): array {
        // Une borne ne mène qu'une mise à jour à la fois : le simulateur comme
        // les bornes réelles ignorent purement et simplement un second
        // `UpdateFirmware` pendant qu'un cycle est en cours (« firmware update
        // already in progress »). Sans ce garde-fou on créerait une ligne de
        // suivi que la borne ne renseignera jamais.
        $enCours = FirmwareDeployment::where('borne_id', $borne->id)
            ->whereIn('statut', FirmwareDeployment::STATUTS_EN_COURS)
            ->latest('id')
            ->first();

        if ($enCours !== null) {
            $message = "Une mise à jour vers {$enCours->firmware_version} est déjà en cours sur cette borne.";

            return ['borne' => $borne->name, 'succes' => false, 'message' => $message];
        }

        $deployment = FirmwareDeployment::create([
            'firmware_id' => $firmware->id,
            'firmware_version' => $firmware->version,
            'borne_id' => $borne->id,
            'version_precedente' => $borne->firmware,
            'statut' => FirmwareDeployment::STATUT_EN_ATTENTE,
            'est_rollback' => $estRollback,
            'demande_par' => request()->user()?->id,
            'demande_par_nom' => $demandeur,
        ]);

        if (! $firmware->compatibleAvec($borne)) {
            $deployment->update([
                'statut' => FirmwareDeployment::STATUT_ECHEC,
                'message' => "Firmware déclaré pour {$firmware->fabricant} {$firmware->modele}, "
                    ."incompatible avec {$borne->fabricant} {$borne->modele}.",
            ]);

            return ['borne' => $borne->name, 'succes' => false, 'message' => $deployment->message];
        }

        $resultat = $this->ocpp->envoyer($borne, 'UpdateFirmware', [
            'location' => $this->lienTelechargement($firmware),
            // La borne récupère le binaire tout de suite ; OCPP permettrait de
            // planifier plus tard, mais rien dans le §13 ne le demande.
            'retrieveDate' => now()->toIso8601String(),
            'retries' => 3,
            'retryInterval' => 60,
        ]);

        if (! $resultat['succes']) {
            $deployment->update([
                'statut' => FirmwareDeployment::STATUT_ECHEC,
                'message' => $resultat['message'],
            ]);

            return ['borne' => $borne->name, 'succes' => false, 'message' => $resultat['message']];
        }

        return ['borne' => $borne->name, 'succes' => true, 'message' => null];
    }

    /**
     * Clôt les déploiements que la borne n'a jamais renseignés. Fait à la lecture
     * plutôt que par le scheduler : la seule conséquence d'un balayage tardif est
     * une ligne qui reste « en cours » un peu plus longtemps à l'écran, et cela
     * évite de dépendre d'un cron actif en développement.
     */
    private function cloreDeploiementsAbandonnes(): void
    {
        FirmwareDeployment::whereIn('statut', FirmwareDeployment::STATUTS_EN_COURS)
            ->where('updated_at', '<', now()->subMinutes(self::DELAI_ABANDON_MINUTES))
            ->update([
                'statut' => FirmwareDeployment::STATUT_ECHEC,
                'message' => 'Sans nouvelle de la borne après '.self::DELAI_ABANDON_MINUTES.' minutes.',
            ]);
    }

    private function lienTelechargement(Firmware $firmware): string
    {
        return URL::temporarySignedRoute(
            'firmware.telecharger',
            now()->addHours(self::VALIDITE_LIEN_HEURES),
            ['firmware' => $firmware->id],
        );
    }

    /** @param array<int, array{borne: string, succes: bool, message: ?string}> $resultats */
    private function resume(array $resultats): string
    {
        $ok = count(array_filter($resultats, fn ($r) => $r['succes']));
        $total = count($resultats);

        if ($ok === $total) {
            return "Mise à jour envoyée à {$total} borne".($total > 1 ? 's' : '').'.';
        }

        return "Mise à jour envoyée à {$ok} borne sur {$total} ; voir l'historique pour le détail.";
    }
}
