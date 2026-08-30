<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Gestion documentaire (Module 16) : notices, photos, contrats, plans et
     * garanties. Un document est normalement rattaché à une borne ; `borne_id`
     * reste nullable pour les pièces valables sur tout le réseau (un contrat
     * cadre, par exemple), affichées comme « document général ».
     */
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('borne_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->string('titre');
            // Chemin relatif sur le disque `local` (storage/app/private) : les
            // documents ne sont jamais servis en statique, toujours via
            // /api/documents/{id}/download qui repasse par l'authentification.
            $table->string('chemin');
            $table->string('nom_fichier');
            $table->string('mime');
            $table->unsignedBigInteger('taille');
            // Pertinent pour les contrats et garanties ; nul pour une notice.
            $table->date('date_expiration')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['borne_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
