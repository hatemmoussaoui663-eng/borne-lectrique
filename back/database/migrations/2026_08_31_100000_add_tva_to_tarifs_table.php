<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Le taux de TVA relève du Module 17 (Paramétrage), mais une facture ne peut
     * pas s'en passer : sans lui, le Module 9 devrait coder le taux en dur.
     * Il rejoint donc la table de tarification, seul paramétrage existant.
     *
     * 19 % : taux normal en Tunisie, cohérent avec les prix en dinars du projet.
     */
    public function up(): void
    {
        Schema::table('tarifs', function (Blueprint $table) {
            $table->decimal('tva_taux', 5, 2)->default(19.00)->after('prix_kwh');
        });
    }

    public function down(): void
    {
        Schema::table('tarifs', function (Blueprint $table) {
            $table->dropColumn('tva_taux');
        });
    }
};
