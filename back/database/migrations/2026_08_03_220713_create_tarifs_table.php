<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('tarifs', function (Blueprint $table) {
            $table->id();
            $table->decimal('prix_kwh', 8, 3)->default(0.35);
            $table->timestamps();
        });

        // Single settings-style row: the "current" tariff applied to every
        // session at StopTransaction. See App\Models\Tarif::current().
        DB::table('tarifs')->insert([
            'id' => 1,
            'prix_kwh' => 0.35,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tarifs');
    }
};
