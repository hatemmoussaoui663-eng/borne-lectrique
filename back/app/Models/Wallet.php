<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Porte-monnaie prépayé d'un client (Module 9, « Wallet »).
 */
class Wallet extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'solde',
    ];

    protected $casts = [
        'solde' => 'float',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(WalletTransaction::class)->latest('id');
    }

    /** Crée le porte-monnaie à la première utilisation plutôt qu'à l'inscription. */
    public static function pour(User $user): self
    {
        return self::firstOrCreate(['user_id' => $user->id], ['solde' => 0]);
    }

    public function toFrontendArray(): array
    {
        return [
            'id' => (string) $this->id,
            'userId' => (string) $this->user_id,
            'client' => $this->user?->name,
            'solde' => (float) $this->solde,
            'transactions' => $this->relationLoaded('transactions')
                ? $this->transactions->map->toFrontendArray()->values()->all()
                : null,
        ];
    }
}
