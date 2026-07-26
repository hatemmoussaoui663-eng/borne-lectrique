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
        Schema::create('charge_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('borne_id')->constrained('bornes')->cascadeOnDelete();
            $table->unsignedInteger('connector_id');
            $table->string('id_tag')->nullable();
            $table->unsignedInteger('meter_start')->nullable();
            $table->unsignedInteger('meter_stop')->nullable();
            $table->decimal('energie_kwh', 10, 3)->default(0);
            $table->string('status')->default('En cours');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('stopped_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('charge_sessions');
    }
};
