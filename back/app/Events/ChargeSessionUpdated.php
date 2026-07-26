<?php

namespace App\Events;

use App\Models\ChargeSession;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class ChargeSessionUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;

    public function __construct(public ChargeSession $session)
    {
    }

    public function broadcastOn(): Channel
    {
        return new Channel('sessions-updates');
    }

    public function broadcastAs(): string
    {
        return 'session.updated';
    }

    public function broadcastWith(): array
    {
        return $this->session->toFrontendArray();
    }
}
