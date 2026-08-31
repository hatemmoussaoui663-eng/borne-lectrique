<?php

namespace App\Observers;

use App\Models\AuditLog;
use App\Models\Abonnement;
use App\Models\AbonnementPlan;
use App\Models\Badge;
use App\Models\Borne;
use App\Models\Document;
use App\Models\Facture;
use App\Models\Firmware;
use App\Models\MaintenanceTicket;
use App\Models\Paiement;
use App\Models\Role;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Vehicule;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

/**
 * Alimente le journal d'audit (Module 18) depuis les évènements Eloquent :
 * une création, une modification ou une suppression sur l'un des modèles
 * ci-dessous laisse une trace, sans que chaque contrôleur ait à y penser.
 *
 * Deux absences volontaires :
 *
 * - `ChargeSession` et `Alerte` ne sont pas audités. Ils sont écrits en continu
 *   par le pipeline OCPP (une session, un changement de statut, des MeterValues
 *   toutes les quelques secondes) ; les tracer noierait le journal sous de la
 *   télémétrie machine, alors que le §18 parle des actions humaines. Ces
 *   évènements sont déjà couverts par les Alertes (Module 12) et `ocpp.log`.
 * - Rien n'est écrit hors session authentifiée (`Auth::check()`). Une borne dont
 *   le statut est mis à jour par le serveur OCPP n'est pas une modification
 *   d'utilisateur ; le seeder et les migrations non plus.
 */
class AuditObserver
{
    /** Jamais recopiés dans le journal, même chiffrés. */
    private const CHAMPS_SENSIBLES = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    /** Bruit technique : sans valeur pour une relecture d'audit. */
    private const CHAMPS_IGNORES = [
        'created_at',
        'updated_at',
        'last_heartbeat_at',
    ];

    /**
     * Libellé métier et champ à afficher pour désigner l'enregistrement.
     * Un `titre` nul signifie un enregistrement unique (la tarification).
     */
    private const ENTITES = [
        Borne::class => ['libelle' => 'Borne', 'titre' => 'name'],
        User::class => ['libelle' => 'Utilisateur', 'titre' => 'name'],
        Role::class => ['libelle' => 'Rôle', 'titre' => 'display_name'],
        Vehicule::class => ['libelle' => 'Véhicule', 'titre' => 'immatriculation'],
        Badge::class => ['libelle' => 'Badge RFID', 'titre' => 'code'],
        MaintenanceTicket::class => ['libelle' => 'Ticket de maintenance', 'titre' => 'titre'],
        Tarif::class => ['libelle' => 'Tarification', 'titre' => null],
        Document::class => ['libelle' => 'Document', 'titre' => 'titre'],
        // Un binaire de la bibliothèque finit poussé sur des bornes du parc :
        // son ajout et son retrait doivent laisser une trace. Les déploiements
        // eux-mêmes ne sont pas audités ici — le Module 13 tient déjà son propre
        // historique, plus riche (statut OCPP, version précédente, rollback).
        Firmware::class => ['libelle' => 'Firmware', 'titre' => 'version'],
        // Module 9 : tout ce qui touche à l’argent est audité. Les factures
        // émises automatiquement en fin de session ne le sont pas, faute de
        // session authentifiée côté ingest OCPP — seuls les émissions,
        // règlements et remboursements décidés par un humain laissent une trace.
        Facture::class => ['libelle' => 'Facture', 'titre' => 'numero'],
        Paiement::class => ['libelle' => 'Paiement', 'titre' => 'reference'],
        Abonnement::class => ['libelle' => 'Abonnement', 'titre' => 'plan_nom'],
        AbonnementPlan::class => ['libelle' => "Formule d'abonnement", 'titre' => 'nom'],
    ];

    /** Les modèles à observer, pour l'enregistrement dans AppServiceProvider. */
    public static function modelesAudites(): array
    {
        return array_keys(self::ENTITES);
    }

    public function created(Model $model): void
    {
        if (! Auth::check()) {
            return;
        }

        AuditLog::enregistrer(
            AuditLog::ACTION_CREATION,
            'Création : '.$this->description($model),
            $this->entite($model),
            (string) $model->getKey(),
            $this->valeursCreation($model),
        );
    }

    public function updated(Model $model): void
    {
        if (! Auth::check()) {
            return;
        }

        $changements = $this->diff($model);

        // Une sauvegarde qui ne change aucun champ suivi ne mérite pas de ligne.
        if ($changements === []) {
            return;
        }

        AuditLog::enregistrer(
            AuditLog::ACTION_MODIFICATION,
            'Modification : '.$this->description($model),
            $this->entite($model),
            (string) $model->getKey(),
            $changements,
        );
    }

    public function deleted(Model $model): void
    {
        if (! Auth::check()) {
            return;
        }

        AuditLog::enregistrer(
            AuditLog::ACTION_SUPPRESSION,
            'Suppression : '.$this->description($model),
            $this->entite($model),
            (string) $model->getKey(),
            $this->valeursCreation($model),
        );
    }

    private function entite(Model $model): string
    {
        return self::ENTITES[$model::class]['libelle'] ?? class_basename($model);
    }

    /** « Borne "Parking Nord" » — de quoi relire le journal sans requête annexe. */
    private function description(Model $model): string
    {
        $entite = $this->entite($model);
        $champ = self::ENTITES[$model::class]['titre'] ?? null;
        $titre = $champ === null ? null : $model->getAttribute($champ);

        return $titre === null || $titre === ''
            ? $entite
            : $entite.' « '.$titre.' »';
    }

    /** Diff champ par champ, mis en forme pour l'affichage : avant → après. */
    private function diff(Model $model): array
    {
        $changements = [];

        foreach ($model->getChanges() as $champ => $apres) {
            if ($this->champIgnore($champ)) {
                continue;
            }

            if (in_array($champ, self::CHAMPS_SENSIBLES, true)) {
                // On trace *qu'il* a changé, jamais sa valeur.
                $changements[$champ] = ['avant' => '••••••', 'apres' => '••••••'];

                continue;
            }

            $changements[$champ] = [
                'avant' => $this->lisible($model->getOriginal($champ)),
                'apres' => $this->lisible($apres),
            ];
        }

        return $changements;
    }

    /** État complet à la création comme à la suppression, pour pouvoir reconstituer. */
    private function valeursCreation(Model $model): array
    {
        $valeurs = [];

        foreach ($model->getAttributes() as $champ => $valeur) {
            if ($this->champIgnore($champ) || $champ === $model->getKeyName()) {
                continue;
            }

            $valeurs[$champ] = in_array($champ, self::CHAMPS_SENSIBLES, true)
                ? '••••••'
                : $this->lisible($valeur);
        }

        return $valeurs;
    }

    private function champIgnore(string $champ): bool
    {
        return in_array($champ, self::CHAMPS_IGNORES, true);
    }

    /** Aplatit les valeurs non scalaires (JSON, dates) pour un affichage direct. */
    private function lisible(mixed $valeur): ?string
    {
        if ($valeur === null) {
            return null;
        }

        if (is_bool($valeur)) {
            return $valeur ? 'oui' : 'non';
        }

        if (is_array($valeur) || is_object($valeur)) {
            return json_encode($valeur, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        return (string) $valeur;
    }
}
