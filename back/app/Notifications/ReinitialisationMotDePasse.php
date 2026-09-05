<?php

namespace App\Notifications;

use App\Notifications\Channels\CanalSms;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Lien de reinitialisation, envoye par email ou par SMS selon le canal choisi
 * dans AuthController::forgotPassword. Le token reste celui du PasswordBroker
 * de Laravel : meme duree de vie, meme usage unique, quel que soit le canal.
 */
class ReinitialisationMotDePasse extends Notification
{
    public const CANAL_MAIL = 'mail';

    public const CANAL_SMS = 'sms';

    public function __construct(
        private readonly string $token,
        private readonly string $canal = self::CANAL_MAIL,
    ) {
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return [$this->canal === self::CANAL_SMS ? CanalSms::class : 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject('Reinitialisation de votre mot de passe')
            ->greeting('Bonjour '.$notifiable->name.',')
            ->line('Vous recevez cet email car une reinitialisation de mot de passe a ete demandee pour votre compte.')
            ->action('Reinitialiser mon mot de passe', $this->lien($notifiable))
            ->line('Ce lien expirera dans '.$this->minutesDeValidite().' minutes et ne peut servir qu\'une seule fois.')
            ->line("Si vous n'etes pas a l'origine de cette demande, vous pouvez ignorer cet email.")
            ->salutation('Cordialement, l\'equipe BornElect');
    }

    public function toSms(object $notifiable): string
    {
        return sprintf(
            'BornElect : reinitialisez votre mot de passe ici %s (lien valable %d minutes). Si vous n\'etes pas a l\'origine de cette demande, ignorez ce message.',
            $this->lien($notifiable),
            $this->minutesDeValidite(),
        );
    }

    /**
     * Le SPA React lit le token en query string ; l'API n'expose aucune vue,
     * donc le lien ne doit surtout pas passer par route('password.reset').
     */
    private function lien(object $notifiable): string
    {
        return sprintf(
            '%s/reset-password?token=%s&email=%s',
            rtrim((string) config('app.frontend_url'), '/'),
            $this->token,
            urlencode($notifiable->getEmailForPasswordReset()),
        );
    }

    private function minutesDeValidite(): int
    {
        return (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire', 60);
    }
}
