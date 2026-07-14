<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['name' => 'super_admin', 'display_name' => 'Super Administrateur'],
            ['name' => 'exploitant', 'display_name' => 'Exploitant'],
            ['name' => 'operateur', 'display_name' => 'Opérateur'],
            ['name' => 'technicien', 'display_name' => 'Technicien'],
            ['name' => 'service_client', 'display_name' => 'Service Client'],
            ['name' => 'finance', 'display_name' => 'Finance'],
            ['name' => 'client', 'display_name' => 'Client'],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(['name' => $role['name']], $role);
        }
    }
}
