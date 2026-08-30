<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Une écriture du journal d'audit (Module 18).
 *
 * Le modèle n'expose volontairement aucun setter métier ni suppression : les
 * lignes sont créées par le système (observateur Eloquent et contrôleur d'auth)
 * puis relues, jamais retouchées.
 */
class AuditLog extends Model
{
    public const ACTION_CONNEXION = 'connexion';
    public const ACTION_CONNEXION_ECHOUEE = 'connexion_echouee';
    public const ACTION_DECONNEXION = 'deconnexion';
    public const ACTION_CREATION = 'creation';
    public const ACTION_MODIFICATION = 'modification';
    public const ACTION_SUPPRESSION = 'suppression';

    public const ACTIONS = [
        self::ACTION_CONNEXION,
        self::ACTION_CONNEXION_ECHOUEE,
        self::ACTION_DECONNEXION,
        self::ACTION_CREATION,
        self::ACTION_MODIFICATION,
        self::ACTION_SUPPRESSION,
    ];

    /** Table en ajout seul : une ligne d'audit n'est jamais mise à jour. */
    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'user_nom',
        'user_role',
        'action',
        'entite',
        'entite_id',
        'libelle',
        'changements',
        'ip',
        'user_agent',
    ];

    protected $casts = [
        'changements' => 'array',
        'created_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Point d'entrée unique pour écrire au journal.
     *
     * L'auteur est déduit de la session courante. Deux échappatoires sont
     * nécessaires au moment de la connexion : `$utilisateur`, car `Auth::user()`
     * n'est pas encore renseigné quand on valide les identifiants, et `$auteur`,
     * pour tracer l'email saisi lors d'une tentative sur un compte inexistant.
     */
    public static function enregistrer(
        string $action,
        string $libelle,
        ?string $entite = null,
        ?string $entiteId = null,
        ?array $changements = null,
        ?string $auteur = null,
        ?User $utilisateur = null,
    ): self {
        $utilisateur ??= Auth::user();
        $request = request();

        return self::create([
            'user_id' => $utilisateur?->id,
            'user_nom' => $utilisateur?->name ?? $auteur ?? 'Système',
            'user_role' => $utilisateur?->role?->display_name ?? $utilisateur?->role?->name,
            'action' => $action,
            'entite' => $entite,
            'entite_id' => $entiteId,
            'libelle' => $libelle,
            'changements' => $changements,
            'ip' => $request instanceof Request ? $request->ip() : null,
            'user_agent' => $request instanceof Request
                ? substr((string) $request->userAgent(), 0, 512)
                : null,
        ]);
    }

    public function toFrontendArray(): array
    {
        return [
            'id' => (string) $this->id,
            'utilisateur' => $this->user_nom,
            'role' => $this->user_role,
            // La ligne pointe-t-elle encore vers un compte existant ? Faux dans
            // deux cas très différents — compte supprimé depuis, ou tentative de
            // connexion sur un email inconnu — que seul `action` permet de
            // distinguer ; le front s'en charge plutôt que d'inférer ici à tort.
            'compteLie' => $this->user_id !== null,
            'action' => $this->action,
            'entite' => $this->entite,
            'entiteId' => $this->entite_id,
            'libelle' => $this->libelle,
            'changements' => $this->changements,
            'ip' => $this->ip,
            'date' => $this->created_at?->toDateTimeString(),
        ];
    }
}
