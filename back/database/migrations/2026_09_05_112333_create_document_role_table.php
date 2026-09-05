<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ciblage par rôle des documents (Module 16) : une notice destinée aux
     * techniciens ne doit pas remonter au service finance.
     *
     * Table de liaison plutôt qu'une colonne `role_id` : une même pièce peut
     * concerner plusieurs métiers (un contrat lu par l'exploitant *et* la
     * finance). L'absence de ligne vaut « tout le monde », ce qui laisse les
     * documents déjà déposés visibles comme avant.
     */
    public function up(): void
    {
        Schema::create('document_role', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();

            $table->unique(['document_id', 'role_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_role');
    }
};
