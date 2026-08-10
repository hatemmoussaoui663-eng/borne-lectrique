<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'badge' => $this->whenLoaded('badge', fn () => $this->badge === null ? null : [
                'id' => $this->badge->id,
                'code' => $this->badge->code,
                'status' => $this->badge->status,
                'expiresAt' => $this->badge->expires_at?->toDateString(),
            ]),
            'role' => $this->role->display_name,
            'role_slug' => $this->role->name,
            'is_active' => $this->is_active,
            'email_verified_at' => $this->email_verified_at,
            'created_at' => $this->created_at,
        ];
    }
}
