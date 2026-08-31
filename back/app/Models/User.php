<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'role_id',
        'is_active',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    public function badge()
    {
        return $this->hasOne(Badge::class);
    }

    public function vehicules()
    {
        return $this->hasMany(Vehicule::class);
    }

    public function wallet()
    {
        return $this->hasOne(Wallet::class);
    }

    public function factures()
    {
        return $this->hasMany(Facture::class);
    }

    public function abonnements()
    {
        return $this->hasMany(Abonnement::class);
    }

    /**
     * L'abonnement qui donne droit a une remise aujourd'hui, s'il y en a un.
     * Un client peut en avoir plusieurs dans l'historique (resilies, expires) ;
     * un seul au plus est en cours.
     */
    public function abonnementEnCours(): ?Abonnement
    {
        return $this->abonnements()
            ->where('statut', Abonnement::STATUT_ACTIF)
            ->where(function ($q) {
                $q->whereNull('fin')->orWhere('fin', '>=', now()->toDateString());
            })
            ->latest('id')
            ->first();
    }

    /**
     * This user's access level ('full' | 'read' | 'none') for a given module,
     * per the intra-staff permission matrix (config/permissions.php, cahier
     * des charges §7). Roles not present in the matrix (e.g. "client", which
     * is gated out entirely before reaching these modules) default to 'none'.
     */
    public function permissionFor(string $module): string
    {
        $roleName = $this->role?->name;
        $roleMatrix = config("permissions.roles.{$roleName}", []);

        return $roleMatrix['*'] ?? $roleMatrix[$module] ?? 'none';
    }

    /**
     * This user's full permission map, one level per configured module —
     * what the frontend uses to hide/disable actions it already knows the
     * API would reject.
     */
    public function permissions(): array
    {
        $modules = array_keys(config('permissions.roles.exploitant', []));

        return collect($modules)->mapWithKeys(fn (string $module) => [
            $module => $this->permissionFor($module),
        ])->all();
    }
}
