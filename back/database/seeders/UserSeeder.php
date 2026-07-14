<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $superAdminRole = Role::where('name', 'super_admin')->first();

        User::updateOrCreate(
            ['email' => 'admin@borne-electrique.com'],
            [
                'name' => 'Admin',
                'phone' => null,
                'role_id' => $superAdminRole->id,
                'is_active' => true,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        $clientRole = Role::where('name', 'client')->first();

        User::updateOrCreate(
            ['email' => 'client@borne-electrique.com'],
            [
                'name' => 'Client Test',
                'phone' => '+216 00 000 000',
                'role_id' => $clientRole->id,
                'is_active' => true,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );
    }
}
