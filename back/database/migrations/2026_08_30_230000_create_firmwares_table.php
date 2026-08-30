<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Bibliothèque de firmwares (Module 13) : les binaires téléversés, prêts à
     * être déployés sur les bornes.
     */
    public function up(): void
    {
        Schema::create('firmwares', function (Blueprint $table) {
            $table->id();
            $table->string('version');
            // Compatibilité déclarée : nuls = firmware générique, applicable à
            // n'importe quelle borne.
            $table->string('fabricant')->nullable();
            $table->string('modele')->nullable();
            $table->text('notes')->nullable();

            $table->string('chemin');
            $table->string('nom_fichier');
            $table->unsignedBigInteger('taille');
            // SHA-256 du binaire : seul moyen de vérifier après coup que le
            // fichier servi à la borne est bien celui qui a été téléversé.
            $table->string('checksum', 64);

            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['fabricant', 'modele']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('firmwares');
    }
};
