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

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()->id === $user->id) {
            abort(422, 'Vous ne pouvez pas supprimer votre propre compte.');
        }

        $user->delete();

        return response()->json(['message' => 'Utilisateur supprimé.']);
    }

    /**
     * Associate, update, or detach the RFID badge for a user (Module 7).
     * An empty `code` auto-generates a fresh one (Badge::nextCode()) when the
     * user has none yet, or detaches the current badge when they do. Once a
     * badge has authorized at least one charge session (Badge::isUsed()),
     * its code can no longer be changed or detached — only status/expiry
     * stay editable, e.g. to block a lost card.
     */
    public function updateBadge(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'code' => ['nullable', 'string', 'max:100'],
            'status' => ['sometimes', Rule::in(['Actif', 'Bloqué', 'Expiré'])],
            'expires_at' => ['nullable', 'date'],
        ]);

        $user->load('badge');
        $existing = $user->badge;
        $code = trim($data['code'] ?? '');

        if ($existing !== null && $existing->isUsed() && $code !== $existing->code) {
            return response()->json([
                'message' => 'Ce badge a déjà servi à une session de recharge : son numéro ne peut plus être modifié ni détaché.',
            ], 422);
        }

        if ($code === '') {
            if ($existing === null) {
                $code = Badge::nextCode();
            } else {
                $existing->delete();
                $user->load(['role', 'badge']);

                return response()->json(new UserResource($user));
            }
        }

        $duplicate = Badge::where('code', $code)->where('user_id', '!=', $user->id)->exists();
        if ($duplicate) {
            return response()->json(['message' => 'Ce badge est déjà associé à un autre utilisateur.'], 422);
        }

        $badge = $existing ?? new Badge(['user_id' => $user->id]);
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
