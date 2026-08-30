<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Un binaire de la bibliothèque de firmwares (Module 13).
 */
class Firmware extends Model
{
    use HasFactory;

    /**
     * Explicite : le pluraliseur de Laravel tient « firmware » pour déjà pluriel
     * et déduirait la table `firmware`, alors que la migration crée `firmwares`.
     */
    protected $table = 'firmwares';

    protected $fillable = [
        'version',
        'fabricant',
        'modele',
        'notes',
        'chemin',
        'nom_fichier',
        'taille',
        'checksum',
        'uploaded_by',
    ];

    protected $casts = [
        'taille' => 'integer',
    ];

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function deployments(): HasMany
    {
        return $this->hasMany(FirmwareDeployment::class);
    }

    /** Un firmware sans fabricant ni modèle s'applique à toutes les bornes. */
    public function compatibleAvec(Borne $borne): bool
    {
        $fabricantOk = $this->fabricant === null
            || $borne->fabricant === null
            || strcasecmp($this->fabricant, $borne->fabricant) === 0;

        $modeleOk = $this->modele === null
            || $borne->modele === null
            || strcasecmp($this->modele, $borne->modele) === 0;

        return $fabricantOk && $modeleOk;
    }

    public function toFrontendArray(): array
    {
        return [
            'id' => (string) $this->id,
            'version' => $this->version,
            'fabricant' => $this->fabricant,
            'modele' => $this->modele,
            'notes' => $this->notes,
            'nomFichier' => $this->nom_fichier,
            'taille' => (int) $this->taille,
            'checksum' => $this->checksum,
            'ajoutePar' => $this->uploader?->name,
            'ajouteLe' => $this->created_at?->toDateTimeString(),
            // Combien de bornes tournent avec cette version aujourd'hui —
            // renseigné par le contrôleur via withCount, absent ailleurs.
            'deploiements' => $this->deployments_count === null
                ? null
                : (int) $this->deployments_count,
        ];
    }
}
