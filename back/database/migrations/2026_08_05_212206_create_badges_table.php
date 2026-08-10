<?php

use App\Models\Badge;
use App\Models\User;
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
        Schema::create('badges', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->string('status')->default('Actif');
            $table->date('expires_at')->nullable();
            $table->timestamps();
        });

        // Carry forward badges assigned in Tier 2 (users.badge_rfid) before the column drops.
        if (Schema::hasColumn('users', 'badge_rfid')) {
            User::whereNotNull('badge_rfid')->get(['id', 'badge_rfid'])->each(function (User $user) {
                Badge::create([
                    'code' => $user->badge_rfid,
                    'user_id' => $user->id,
                    'status' => 'Actif',
                ]);
            });

            Schema::table('users', function (Blueprint $table) {
                $table->dropUnique(['badge_rfid']);
                $table->dropColumn('badge_rfid');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('badge_rfid')->nullable()->unique()->after('phone');
        });

        Badge::whereNotNull('user_id')->get(['code', 'user_id'])->each(function (Badge $badge) {
            User::whereKey($badge->user_id)->update(['badge_rfid' => $badge->code]);
        });

        Schema::dropIfExists('badges');
    }
};
