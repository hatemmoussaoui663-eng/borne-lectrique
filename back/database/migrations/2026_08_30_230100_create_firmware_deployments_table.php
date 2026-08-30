<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Déploiements de firmware (Module 13) : à la fois l'ordre envoyé à la
     * borne, le suivi de son avancement via FirmwareStatusNotification, et
     * l'historique qui en reste.
     */
    public function up(): void
    {
        Schema::create('firmware_deployments', function (Blueprint $table) {
            $table->id();

            // Le firmware peut être retiré de la bibliothèque plus tard ; la
            // version est recopiée pour que l'historique reste lisible, comme
            // pour le journal d'audit.
            // Table nommée explicitement : Laravel considère « firmware » comme
            // déjà pluriel et infère `firmware`, pas `firmwares`.
            $table->foreignId('firmware_id')->nullable()->constrained('firmwares')->nullOnDelete();
            $table->string('firmware_version');

            $table->foreignId('borne_id')->constrained()->cascadeOnDelete();
            // Version portée par la borne avant l'ordre : c'est elle qui rend le
            // rollback possible, il n'y a pas d'autre source pour la retrouver
            // une fois la nouvelle installée.
            $table->string('version_precedente')->nullable();

            $table->string('statut');
            // Statut OCPP brut (Downloading, Installed, InstallationFailed…),
            // conservé tel quel : le diagnostic d'un échec en dépend.
            $table->string('ocpp_status')->nullable();
            $table->text('message')->nullable();
            $table->boolean('est_rollback')->default(false);

            $table->foreignId('demande_par')->nullable()->constrained('users')->nullOnDelete();
            $table->string('demande_par_nom')->nullable();

            $table->timestamps();

            $table->index(['borne_id', 'statut']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('firmware_deployments');
    }
};
