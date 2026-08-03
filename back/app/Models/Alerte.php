<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Alerte extends Model
{
    use HasFactory;

    protected $fillable = [
        'borne_id',
        'connector_id',
        'type',
        'severite',
        'message',
        'read_at',
    ];

    protected $casts = [
        'read_at' => 'datetime',
    ];

    public function borne(): BelongsTo
    {
        return $this->belongsTo(Borne::class);
    }

    /**
     * Map to the shape the React app's `Alerte` type expects: `id`, `borne`,
     * `message`, `severite`, `date`, `lue`.
     */
    public function toFrontendArray(): array
    {
        return [
            'id' => (string) $this->id,
            'borne' => $this->borne?->name ?? '',
            'message' => $this->message,
            'severite' => $this->severite,
            'date' => $this->created_at?->locale('fr')->diffForHumans(),
            'lue' => $this->read_at !== null,
        ];
    }
}
