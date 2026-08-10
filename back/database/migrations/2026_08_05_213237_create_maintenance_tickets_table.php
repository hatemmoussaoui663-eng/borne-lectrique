<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('maintenance_tickets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('borne_id')->constrained()->cascadeOnDelete();
            $table->string('titre');
            $table->string('priorite')->default('Moyenne');
            $table->string('statut')->default('Ouvert');
            $table->string('technicien')->nullable();
            $table->json('pieces_remplacees')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('maintenance_tickets');
    }
};
