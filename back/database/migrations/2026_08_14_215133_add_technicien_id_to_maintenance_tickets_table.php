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
        Schema::table('maintenance_tickets', function (Blueprint $table) {
            $table->foreignId('technicien_id')->nullable()->after('borne_id')->constrained('users')->nullOnDelete();
        });

        Schema::table('maintenance_tickets', function (Blueprint $table) {
            $table->dropColumn('technicien');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('maintenance_tickets', function (Blueprint $table) {
            $table->string('technicien')->nullable();
        });

        Schema::table('maintenance_tickets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('technicien_id');
        });
    }
};
