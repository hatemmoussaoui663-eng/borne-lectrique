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
     * Has this badge ever authorized a real charge session? Once true, its
     * code is locked (see UserController::updateBadge) — only status/expiry
     * stay editable, e.g. to block a lost card.
     */
    public function isUsed(): bool
    {
        return ChargeSession::where('id_tag', $this->code)->exists();
    }

    /**
     * Next sequential RFID-XXXX code, for auto-assigning a brand-new badge
     * instead of having an admin type one by hand.
     */
    public static function nextCode(): string
    {
        $max = static::query()
            ->where('code', 'like', 'RFID-%')
            ->get()
            ->map(fn (self $badge) => (int) substr($badge->code, 5))
            ->max() ?? 0;

        return sprintf('RFID-%04d', $max + 1);
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
