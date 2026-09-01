<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Dernière position connue d'un véhicule (suivi GPS temps réel).
     *
     * Hors cahier des charges : le module 8 décrit le véhicule (marque, modèle,
     * immatriculation…) sans géolocalisation. Ajout demandé en complément.
     *
     * Une seule position est conservée, pas un historique : l'écran de suivi
     * montre « où est ma voiture maintenant », et garder la trace complète des
     * déplacements d'un client poserait une question de vie privée qui n'a pas
     * été tranchée. Un historique se rajouterait dans une table dédiée.
     */
    public function up(): void
    {
        Schema::table('vehicules', function (Blueprint $table) {
            // 7 décimales : ~1 cm de résolution, largement au-delà de la
            // précision d'un GPS de téléphone (quelques mètres).
            $table->decimal('latitude', 10, 7)->nullable()->after('capacite_kwh');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            // Précision annoncée par la source, en mètres : sans elle on ne peut
            // pas distinguer un point fiable d'une estimation réseau à 2 km.
            $table->unsignedInteger('position_precision_m')->nullable()->after('longitude');
            $table->timestamp('position_maj_le')->nullable()->after('position_precision_m');
        });
    }

    public function down(): void
    {
        Schema::table('vehicules', function (Blueprint $table) {
            $table->dropColumn([
                'latitude',
                'longitude',
                'position_precision_m',
                'position_maj_le',
            ]);
        });
    }
};
