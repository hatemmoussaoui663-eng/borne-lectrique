<?php

namespace App\Providers;

use App\Contracts\PasserelleSms;
use App\Observers\AuditObserver;
use App\Services\Sms\SmsJournalise;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(PasserelleSms::class, fn () => match (config('sms.passerelle')) {
            default => new SmsJournalise(),
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Journal d'audit (Module 18) : brancher l'observateur ici plutôt que
        // dans chaque contrôleur garantit qu'aucune écriture métier ne peut
        // passer sous le radar, y compris celles ajoutées plus tard.
        foreach (AuditObserver::modelesAudites() as $modele) {
            $modele::observe(AuditObserver::class);
        }
    }
}
