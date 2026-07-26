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
        Schema::table('bornes', function (Blueprint $table) {
            $table->string('charge_point_id')->nullable()->unique()->after('id');
            $table->timestamp('last_heartbeat_at')->nullable()->after('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bornes', function (Blueprint $table) {
            $table->dropColumn(['charge_point_id', 'last_heartbeat_at']);
        });
    }
};
