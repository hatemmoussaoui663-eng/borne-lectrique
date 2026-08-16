<?php

namespace App\Http\Controllers;

use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        $roles = Role::orderBy('display_name')->get(['id', 'name', 'display_name']);

        return response()->json($roles->map(fn (Role $role) => [
            'id' => $role->id,
            'name' => $role->name,
            'displayName' => $role->display_name,
        ]));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:50', 'regex:/^[a-z_]+$/', 'unique:roles,name'],
            'display_name' => ['required', 'string', 'max:100'],
        ]);

        $role = Role::create($data);

        return response()->json([
            'id' => $role->id,
            'name' => $role->name,
            'displayName' => $role->display_name,
        ], 201);
    }
}
