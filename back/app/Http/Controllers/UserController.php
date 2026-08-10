<?php

namespace App\Http\Controllers;

use App\Http\Resources\UserResource;
use App\Models\Badge;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::with(['role', 'badge'])->orderBy('id')->get();

        return response()->json($users->map(fn (User $user) => new UserResource($user)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:30',
            'role_id' => ['required', 'integer', Rule::exists('roles', 'id')],
            'is_active' => 'required|boolean',
            'password' => 'required|string|min:8',
        ]);

        $data['password'] = Hash::make($data['password']);
        $user = User::create($data);
        $user->load(['role', 'badge']);

        return response()->json(new UserResource($user), 201);
    }

    public function show(User $user): JsonResponse
    {
        $user->load(['role', 'badge']);
        return response()->json(new UserResource($user));
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => ['sometimes', 'required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => 'nullable|string|max:30',
            'role_id' => ['sometimes', 'required', 'integer', Rule::exists('roles', 'id')],
            'is_active' => 'sometimes|required|boolean',
            'password' => 'nullable|string|min:8',
        ]);

        if (isset($data['password']) && $data['password'] !== '') {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        $user->update($data);
        $user->load(['role', 'badge']);

        return response()->json(new UserResource($user));
    }

    public function destroy(User $user): JsonResponse
    {
        $user->delete();

        return response()->json(['message' => 'Utilisateur supprimé.']);
    }

    /**
     * Associate, update, or detach the RFID badge for a user (Module 7).
     * An empty `code` detaches/deletes the user's current badge.
     */
    public function updateBadge(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'code' => ['nullable', 'string', 'max:100'],
            'status' => ['sometimes', Rule::in(['Actif', 'Bloqué', 'Expiré'])],
            'expires_at' => ['nullable', 'date'],
        ]);

        $user->load('badge');
        $code = trim($data['code'] ?? '');

        if ($code === '') {
            $user->badge?->delete();
            $user->load(['role', 'badge']);

            return response()->json(new UserResource($user));
        }

        $duplicate = Badge::where('code', $code)->where('user_id', '!=', $user->id)->exists();
        if ($duplicate) {
            return response()->json(['message' => 'Ce badge est déjà associé à un autre utilisateur.'], 422);
        }

        $badge = $user->badge ?? new Badge(['user_id' => $user->id]);
        $badge->fill([
            'code' => $code,
            'status' => $data['status'] ?? $badge->status ?? 'Actif',
            'expires_at' => $data['expires_at'] ?? $badge->expires_at,
        ]);
        $badge->save();

        $user->load(['role', 'badge']);

        return response()->json(new UserResource($user));
    }
}
