<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Permet d'annuler un rechargement saisi par erreur.
     *
     * Un mouvement de porte-monnaie ne se supprime pas : il se contre-passe par
     * un mouvement inverse, et les deux restent visibles. Effacer la ligne
     * fautive ferait diverger le solde de son historique, et une correction
     * discrète sur de l'argent client est exactement ce qu'un journal doit
     * empêcher.
     *
     * Cette colonne pointe vers le débit de correction : elle sert à la fois de
     * garde-fou (un rechargement ne peut être annulé qu'une fois) et de marque
     * visible dans l'historique. Ni le montant ni le motif d'origine ne sont
     * jamais retouchés.
     */
    public function up(): void
    {
        Schema::table('wallet_transactions', function (Blueprint $table) {
            $table->foreignId('annule_par_id')->nullable()->after('effectue_par')
                ->constrained('wallet_transactions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('wallet_transactions', function (Blueprint $table) {
            $table->dropForeign(['annule_par_id']);
            $table->dropColumn('annule_par_id');
        });
    }
};
