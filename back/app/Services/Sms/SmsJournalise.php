<?php

namespace App\Services\Sms;

use App\Contracts\PasserelleSms;
use Illuminate\Support\Facades\Log;

/**
 * Implementation de developpement : aucun SMS ne part reellement, le message
 * est ecrit dans les logs. Equivalent SMS de MAIL_MAILER=log.
 */
class SmsJournalise implements PasserelleSms
{
    public function envoyer(string $numero, string $message): void
    {
        Log::channel(config('sms.canal_log', 'stack'))->info('[SMS] vers '.$numero, [
            'message' => $message,
        ]);
    }
}
