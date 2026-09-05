<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

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

    /**
     * Rôles destinataires (Module 16). Vide = document valable pour tous les
     * métiers, ce qui reste le cas des pièces déposées avant le ciblage.
     */
    public function rolesDestinataires(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'document_role');
    }

    /**
     * Restreint la requête aux documents que cet utilisateur a le droit de
     * voir.
     *
     * Unique définition de la règle : `index`, le compteur de non-lus et le
     * téléchargement s'appuient tous dessus. Un document ciblé reste sinon
     * accessible en devinant son identifiant, la liste filtrée ne protégeant
     * que l'affichage.
     */
    public function scopeVisiblePour(Builder $query, ?User $utilisateur): Builder
    {
        // Le super administrateur administre le parc documentaire : lui cacher
        // des pièces l'empêcherait de corriger un ciblage erroné.
        if ($utilisateur?->role?->name === 'super_admin') {
            return $query;
        }

        return $query->where(fn (Builder $sous) => $sous
            ->whereDoesntHave('rolesDestinataires')
            ->orWhereHas(
                'rolesDestinataires',
                fn (Builder $roles) => $roles->where('roles.id', $utilisateur?->role_id)
            ));
    }

    /** Pendant du scope pour une pièce déjà chargée. */
    public function estVisiblePar(?User $utilisateur): bool
    {
        return self::query()->whereKey($this->getKey())->visiblePour($utilisateur)->exists();
    }

    /**
     * Utilisateurs ayant ouvert ce document (Module 16). Sert à distinguer un
     * document neuf d'un document déjà consulté, par utilisateur.
     */
    public function lecteurs(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'document_lectures')
            ->withPivot('lu_le');
    }

    /**
     * Marque le document comme consulté par cet utilisateur. Idempotent : une
     * relecture ne déplace pas la date de première ouverture.
     */
    public function marquerLuPar(User $utilisateur): void
    {
        $this->lecteurs()->syncWithoutDetaching([
            $utilisateur->id => ['lu_le' => now()],
        ]);
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
            // Liste vide = document général, visible de tous les métiers.
            'destinataires' => $this->rolesDestinataires
                ->map(fn (Role $role) => [
                    'id' => (string) $role->id,
                    'nom' => $role->display_name ?? $role->name,
                ])
                ->values()
                ->all(),
            'ajouteLe' => $this->created_at?->toDateTimeString(),
            // `lu_par_utilisateur` est ajouté par le withExists() de
            // DocumentController::index. Absent ailleurs — la réponse du dépôt
            // part vers l'auteur du document, pour qui rien n'est neuf — d'où
            // le repli sur « déjà lu ».
            'nonLu' => ! (bool) ($this->lu_par_utilisateur ?? true),
        ];
    }
}
