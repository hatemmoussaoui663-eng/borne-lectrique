<?php

namespace App\Events;

use App\Models\Alerte;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class AlerteUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;

    public function __construct(public Alerte $alerte)
    {
    }

    public function broadcastOn(): Channel
    {
        return new Channel('alertes-updates');
    }

    public function broadcastAs(): string
    {
        return 'alerte.updated';
    }

    public function broadcastWith(): array
    {
        return $this->alerte->toFrontendArray();
    }
}
