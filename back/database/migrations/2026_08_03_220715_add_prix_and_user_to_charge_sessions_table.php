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
        Schema::table('charge_sessions', function (Blueprint $table) {
            $table->decimal('prix', 10, 3)->nullable()->after('energie_kwh');
            $table->foreignId('user_id')->nullable()->after('id_tag')->constrained()->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('charge_sessions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn('prix');
        });
    }
};
