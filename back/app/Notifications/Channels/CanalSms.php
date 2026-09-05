<?php

namespace App\Notifications\Channels;

use App\Contracts\PasserelleSms;
use Illuminate\Notifications\Notification;

/**
 * Canal de notification "sms" : recupere le numero via
 * routeNotificationForSms() sur le notifiable et delegue a la passerelle.
 */
class CanalSms
{
    public function __construct(private readonly PasserelleSms $passerelle)
    {
    }

    public function send(object $notifiable, Notification $notification): void
    {
        $numero = $notifiable->routeNotificationFor('sms', $notification);

        if (blank($numero)) {
            return;
        }

        $this->passerelle->envoyer($numero, $notification->toSms($notifiable));
    }
}
