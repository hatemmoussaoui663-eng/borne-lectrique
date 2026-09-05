<?php

namespace App\Contracts;

/**
 * Envoi d'un SMS. L'implementation est choisie dans AppServiceProvider selon
 * MAIL/SMS_DRIVER : brancher un vrai operateur (Twilio, Vonage, OVH...) ne
 * demande que d'ecrire une classe de plus derriere cette interface, sans
 * toucher aux notifications ni aux controleurs.
 */
interface PasserelleSms
{
    public function envoyer(string $numero, string $message): void;
}
