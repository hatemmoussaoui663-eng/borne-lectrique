<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Accusés de lecture de la gestion documentaire (Module 16).
     *
     * On enregistre les documents *consultés* plutôt qu'un compteur de
     * non-lus : l'absence de ligne vaut « jamais ouvert », si bien qu'un
     * document déposé est automatiquement neuf pour tout le monde, y compris
     * pour les comptes créés après coup, sans aucune écriture au dépôt.
     */
    public function up(): void
    {
        Schema::create('document_lectures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('lu_le');

            // Un utilisateur ne consulte un document qu'une première fois :
            // la contrainte rend la relecture idempotente au lieu d'empiler
            // une ligne par ouverture.
            $table->unique(['document_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_lectures');
    }
};
