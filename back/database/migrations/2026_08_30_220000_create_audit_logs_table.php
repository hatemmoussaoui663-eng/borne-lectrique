<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Journal d'audit (Module 18) : connexions, modifications, suppressions.
     *
     * Table en ajout seul — aucune route ne la modifie ni ne la vide, sinon la
     * « traçabilité complète » attendue par le cahier des charges ne vaudrait
     * rien. D'où l'absence d'`updated_at` : une ligne d'audit ne se corrige pas.
     */
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();

            // Le lien vers le compte se coupe si celui-ci est supprimé, mais le
            // nom et le rôle sont recopiés ici : un journal qui perdrait l'auteur
            // de ses écritures dès la suppression du compte serait inutilisable
            // — c'est précisément là qu'on a besoin de lui.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('user_nom');
            $table->string('user_role')->nullable();

            $table->string('action');
            // Libellé métier français ('Borne', 'Utilisateur'…), stocké tel quel
            // pour que l'export CSV se lise sans table de correspondance.
            $table->string('entite')->nullable();
            $table->string('entite_id')->nullable();
            $table->string('libelle');
            // { champ: { avant: …, apres: … } } — nul pour une connexion.
            $table->json('changements')->nullable();

            $table->string('ip')->nullable();
            $table->string('user_agent', 512)->nullable();

            $table->timestamp('created_at')->useCurrent();

            $table->index('action');
            $table->index('user_id');
            $table->index('created_at');
            $table->index(['entite', 'entite_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
