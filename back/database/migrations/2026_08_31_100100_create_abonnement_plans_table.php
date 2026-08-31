<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Formules d'abonnement (Module 9 « Abonnement », Module 6 « Abonnements »).
     * La remise s'applique au montant HT des factures de recharge du client.
     */
    public function up(): void
    {
        Schema::create('abonnement_plans', function (Blueprint $table) {
            $table->id();
            $table->string('nom');
            $table->text('description')->nullable();
            $table->decimal('prix_mensuel', 10, 3);
            $table->decimal('remise_pourcent', 5, 2)->default(0);
            // Une formule retirée du catalogue ne doit pas disparaître : des
            // abonnements en cours la référencent encore.
            $table->boolean('actif')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('abonnement_plans');
    }
};
