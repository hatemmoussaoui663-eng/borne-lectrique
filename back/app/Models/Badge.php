<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Badge extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'user_id',
        'status',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'date',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * OCPP idTagInfo.status this badge currently resolves to.
     */
    public function ocppStatus(): string
    {
        if ($this->status === 'Bloqué') {
            return 'Blocked';
        }

        if ($this->status === 'Expiré' || ($this->expires_at !== null && $this->expires_at->isPast())) {
            return 'Expired';
        }

        return 'Accepted';
    }
}
