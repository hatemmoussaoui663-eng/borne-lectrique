<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Souscription d'un client à une formule (Module 9).
     */
    public function up(): void
    {
        Schema::create('abonnements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('abonnement_plan_id')->nullable()->constrained()->nullOnDelete();

            // Conditions figées à la souscription : si le catalogue change de
            // prix ou de remise demain, un abonnement déjà signé garde les
            // siennes, et les factures passées restent explicables.
            $table->string('plan_nom');
            $table->decimal('prix_mensuel', 10, 3);
            $table->decimal('remise_pourcent', 5, 2)->default(0);

            $table->string('statut');
            $table->date('debut');
            $table->date('fin')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'statut']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('abonnements');
    }
};
