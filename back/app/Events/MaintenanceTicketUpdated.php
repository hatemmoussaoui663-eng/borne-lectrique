<?php

namespace App\Events;

use App\Models\MaintenanceTicket;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class MaintenanceTicketUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;

    public function __construct(public MaintenanceTicket $ticket)
    {
    }

    public function broadcastOn(): Channel
    {
        return new Channel('maintenance-updates');
    }

    public function broadcastAs(): string
    {
        return 'maintenance.updated';
    }

    public function broadcastWith(): array
    {
        return $this->ticket->toFrontendArray();
    }
}
