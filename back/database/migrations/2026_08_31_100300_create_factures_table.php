<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Factures (Module 9). Une facture naît d'une session de recharge terminée
     * dont le badge est rattaché à un client.
     *
     * Tous les montants sont figés à l'émission plutôt que recalculés : une
     * facture doit rester identique même si le tarif, la TVA ou la remise
     * d'abonnement changent ensuite — c'est une pièce comptable, pas une vue.
     */
    public function up(): void
    {
        Schema::create('factures', function (Blueprint $table) {
            $table->id();
            $table->string('numero')->unique();

            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            // Le client peut être supprimé ; la facture, elle, doit rester
            // lisible et rattachable à un nom.
            $table->string('user_nom');

            // Une facture par session au plus : la contrainte d'unicité est ce
            // qui empêche une double facturation en cas de rejeu.
            $table->foreignId('charge_session_id')->nullable()->unique()->constrained()->nullOnDelete();

            $table->decimal('montant_ht', 10, 3);
            $table->decimal('remise_pourcent', 5, 2)->default(0);
            $table->decimal('montant_remise', 10, 3)->default(0);
            $table->decimal('tva_taux', 5, 2);
            $table->decimal('montant_tva', 10, 3);
            $table->decimal('montant_ttc', 10, 3);

            $table->string('statut');
            // Paiement différé : date limite au-delà de laquelle la facture est
            // en retard. Nulle pour un règlement immédiat.
            $table->date('echeance')->nullable();
            $table->timestamp('emise_le');
            $table->timestamps();

            $table->index(['user_id', 'statut']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('factures');
    }
};
