<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Passerelle SMS
    |--------------------------------------------------------------------------
    |
    | 'log' n'envoie rien et ecrit le message dans les logs (equivalent SMS de
    | MAIL_MAILER=log). Pour passer en reel, ajouter une implementation de
    | App\Contracts\PasserelleSms et la declarer dans AppServiceProvider.
    |
    */

    'passerelle' => env('SMS_PASSERELLE', 'log'),

    'canal_log' => env('SMS_CANAL_LOG', 'stack'),

];
