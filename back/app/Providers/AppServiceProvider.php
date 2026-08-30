<?php

namespace App\Providers;

use App\Observers\AuditObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
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
