<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Rattache une session de recharge au véhicule rechargé.
     *
     * Le §5 du cahier des charges liste « Véhicule » parmi les informations
     * d'une session, et le §8 réclame un « Historique recharges » par véhicule :
     * les deux sont impossibles sans cette colonne. `user_id` ne suffit pas —
     * un client peut posséder plusieurs voitures.
     *
     * Nullable, et pas seulement pour les sessions déjà en base : OCPP ne
     * transporte aucune information de véhicule. Un badge présenté par un client
     * qui possède deux voitures ne dit pas laquelle est branchée ; la session
     * reste alors sans véhicule jusqu'à ce qu'on le lui affecte.
     */
    public function up(): void
    {
        Schema::table('charge_sessions', function (Blueprint $table) {
            // `nullOnDelete` : supprimer un véhicule ne doit pas effacer
            // l'historique de ses recharges, qui reste rattaché au client et
            // porte la facturation.
            $table->foreignId('vehicule_id')->nullable()->after('user_id')
                ->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('charge_sessions', function (Blueprint $table) {
            $table->dropForeign(['vehicule_id']);
            $table->dropColumn('vehicule_id');
        });
    }
};
