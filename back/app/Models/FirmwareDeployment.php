<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un ordre de mise à jour envoyé à une borne, et son suivi (Module 13).
 */
class FirmwareDeployment extends Model
{
    use HasFactory;

    public const STATUT_EN_ATTENTE = 'en_attente';
    public const STATUT_TELECHARGEMENT = 'telechargement';
    public const STATUT_TELECHARGE = 'telecharge';
    public const STATUT_INSTALLATION = 'installation';
    public const STATUT_INSTALLE = 'installe';
    public const STATUT_ECHEC = 'echec';

    /** Un déploiement dans l'un de ces états attend encore la borne. */
    public const STATUTS_EN_COURS = [
        self::STATUT_EN_ATTENTE,
        self::STATUT_TELECHARGEMENT,
        self::STATUT_TELECHARGE,
        self::STATUT_INSTALLATION,
    ];

    /**
     * Correspondance FirmwareStatusNotification (OCPP 1.6 §4.4) → statut métier.
     * `Idle` est absent volontairement : la borne l'émet aussi bien avant qu'après
     * une mise à jour, il ne dit rien de l'avancement et écraserait un état utile.
     */
    public const MAPPING_OCPP = [
        'Downloading' => self::STATUT_TELECHARGEMENT,
        'Downloaded' => self::STATUT_TELECHARGE,
        'DownloadFailed' => self::STATUT_ECHEC,
        'Installing' => self::STATUT_INSTALLATION,
        'Installed' => self::STATUT_INSTALLE,
        'InstallationFailed' => self::STATUT_ECHEC,
        'InstallVerificationFailed' => self::STATUT_ECHEC,
        'InvalidSignature' => self::STATUT_ECHEC,
        'SignatureVerified' => self::STATUT_TELECHARGE,
    ];

    protected $fillable = [
        'firmware_id',
        'firmware_version',
        'borne_id',
        'version_precedente',
        'statut',
        'ocpp_status',
        'message',
        'est_rollback',
        'demande_par',
        'demande_par_nom',
    ];

    protected $casts = [
        'est_rollback' => 'boolean',
    ];

    public function firmware(): BelongsTo
    {
        return $this->belongsTo(Firmware::class);
    }

    public function borne(): BelongsTo
    {
        return $this->belongsTo(Borne::class);
    }

    public function estEnCours(): bool
    {
        return in_array($this->statut, self::STATUTS_EN_COURS, true);
    }

    public function toFrontendArray(): array
    {
        return [
            'id' => (string) $this->id,
            'firmwareId' => $this->firmware_id === null ? null : (string) $this->firmware_id,
            'version' => $this->firmware_version,
            'versionPrecedente' => $this->version_precedente,
            'borneId' => (string) $this->borne_id,
            'borne' => $this->borne?->name,
            'statut' => $this->statut,
            'ocppStatus' => $this->ocpp_status,
            'message' => $this->message,
            'estRollback' => (bool) $this->est_rollback,
            'enCours' => $this->estEnCours(),
            // Un rollback n'est possible que depuis un déploiement abouti dont
            // on connaît la version d'avant — sinon il n'y a nulle part où revenir.
            'rollbackPossible' => $this->statut === self::STATUT_INSTALLE
                && $this->version_precedente !== null
                && ! $this->est_rollback,
            'demandePar' => $this->demande_par_nom,
            'date' => $this->created_at?->toDateTimeString(),
            'majLe' => $this->updated_at?->toDateTimeString(),
        ];
    }
}
