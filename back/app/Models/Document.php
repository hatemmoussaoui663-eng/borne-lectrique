<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pièce jointe de la gestion documentaire (Module 16). Le fichier lui-même
 * vit sur le disque privé ; ce modèle n'en porte que les métadonnées.
 */
class Document extends Model
{
    use HasFactory;

    /** Les cinq natures listées au Module 16 du cahier des charges. */
    public const TYPES = ['notice', 'photo', 'contrat', 'plan', 'garantie'];

    /** Seuls les contrats et garanties ont une échéance à surveiller. */
    public const TYPES_AVEC_ECHEANCE = ['contrat', 'garantie'];

    protected $fillable = [
        'borne_id',
        'type',
        'titre',
        'chemin',
        'nom_fichier',
        'mime',
        'taille',
        'date_expiration',
        'uploaded_by',
    ];

    protected $casts = [
        'date_expiration' => 'date',
        'taille' => 'integer',
    ];

    public function borne(): BelongsTo
    {
        return $this->belongsTo(Borne::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /** Une garantie ou un contrat dont l'échéance est dépassée. */
    public function estExpire(): bool
    {
        return $this->date_expiration !== null && $this->date_expiration->isPast();
    }

    public function toFrontendArray(): array
    {
        return [
            'id' => (string) $this->id,
            'borneId' => $this->borne_id === null ? null : (string) $this->borne_id,
            'borne' => $this->borne?->name,
            'type' => $this->type,
            'titre' => $this->titre,
            'nomFichier' => $this->nom_fichier,
            'mime' => $this->mime,
            'taille' => (int) $this->taille,
            'dateExpiration' => $this->date_expiration?->toDateString(),
            'expire' => $this->estExpire(),
            'ajoutePar' => $this->uploader?->name,
            'ajouteLe' => $this->created_at?->toDateTimeString(),
        ];
    }
}
