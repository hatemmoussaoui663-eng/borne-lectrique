<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Règlements et remboursements (Module 9).
     *
     * Séparé de `factures` parce qu'une facture peut rester impayée (paiement
     * différé), être réglée puis remboursée : ce sont des évènements successifs,
     * pas un état unique de la facture.
     */
    public function up(): void
    {
        Schema::create('paiements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facture_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            $table->decimal('montant', 10, 3);
            // carte | wallet | abonnement | differe
            $table->string('moyen');
            $table->string('statut');
            // Référence du règlement : identifiant de transaction du prestataire
            // pour une carte, référence interne sinon.
            $table->string('reference')->nullable();

            $table->timestamp('paye_le')->nullable();
            $table->timestamp('rembourse_le')->nullable();
            $table->string('motif_remboursement')->nullable();

            $table->foreignId('enregistre_par')->nullable()->constrained('users')->nullOnDelete();
            $table->string('enregistre_par_nom')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'statut']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('paiements');
    }
};
