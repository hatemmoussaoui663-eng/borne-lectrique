<?php

namespace App\Events;

use App\Models\Borne;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class BorneUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;

    public function __construct(public Borne $borne)
    {
    }

    public function broadcastOn(): Channel
    {
        return new Channel('bornes-updates');
    }

    public function broadcastAs(): string
    {
        return 'borne.updated';
    }

    public function broadcastWith(): array
    {
        return $this->borne->toFrontendArray();
    }
}
