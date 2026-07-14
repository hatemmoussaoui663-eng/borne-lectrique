<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bornes', function (Blueprint $table) {
            $table->string('reference')->nullable();
            $table->string('numero_serie')->nullable();
            $table->string('modele')->nullable();
            $table->string('fabricant')->nullable();
            $table->string('adresse')->nullable();
            $table->string('ville')->nullable();
            $table->string('ocpp')->nullable();
            $table->integer('puissance')->nullable()->default(22);
            $table->string('firmware')->nullable();
            $table->json('connecteurs')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('bornes', function (Blueprint $table) {
            $table->dropColumn([
                'reference',
                'numero_serie',
                'modele',
                'fabricant',
                'adresse',
                'ville',
                'puissance',
                'firmware',
                'ocpp',
                'connecteurs',
            ]);
        });
    }
};
