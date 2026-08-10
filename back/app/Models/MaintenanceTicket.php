<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MaintenanceTicket extends Model
{
    /** @use HasFactory<\Database\Factories\MaintenanceTicketFactory> */
    use HasFactory;

    protected $fillable = [
        'borne_id',
        'titre',
        'priorite',
        'statut',
        'technicien',
        'pieces_remplacees',
    ];

    protected function casts(): array
    {
        return [
            'pieces_remplacees' => 'array',
        ];
    }

    public function borne()
    {
        return $this->belongsTo(Borne::class);
    }

    public function toFrontendArray(): array
    {
        return [
            'id' => (string) $this->id,
            'borne' => $this->borne?->name ?? '',
            'titre' => $this->titre,
            'priorite' => $this->priorite,
            'statut' => $this->statut,
            'technicien' => $this->technicien ?? '',
            'creeLe' => $this->created_at ? $this->created_at->toDateString() : null,
            'piecesRemplacees' => $this->pieces_remplacees ?? [],
        ];
    }
}
