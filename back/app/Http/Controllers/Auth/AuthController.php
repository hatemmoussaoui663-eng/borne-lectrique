<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            // Les tentatives ratées sont le premier signal d'une attaque par
            // force brute : elles valent au moins autant que les réussites dans
            // un journal d'audit (Module 18). L'email tenté sert d'auteur,
            // puisqu'aucune session n'existe encore.
            AuditLog::enregistrer(
                AuditLog::ACTION_CONNEXION_ECHOUEE,
                'Échec de connexion : identifiants incorrects',
                auteur: $request->email,
            );

            throw ValidationException::withMessages([
                'message' => ['Identifiants incorrects.'],
            ]);
        }

        if (! $user->is_active) {
            AuditLog::enregistrer(
                AuditLog::ACTION_CONNEXION_ECHOUEE,
                'Échec de connexion : compte désactivé',
                utilisateur: $user,
            );

            throw ValidationException::withMessages([
                'message' => ['Votre compte est désactivé.'],
            ]);
        }

        $token = $user->createToken('auth-token')->plainTextToken;
        $user->load(['role', 'badge']);

        // `Auth::user()` n'est pas encore renseigné à ce stade de la requête :
        // on passe le compte explicitement, sans quoi la ligne perdrait son
        // rattachement et se lirait comme l'action d'un compte supprimé.
        AuditLog::enregistrer(
            AuditLog::ACTION_CONNEXION,
            'Connexion réussie',
            utilisateur: $user,
        );

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user),
            'permissions' => $user->permissions(),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        // Tracé avant la révocation du jeton : après, `Auth::user()` serait
        // encore renseigné pour cette requête, mais l'ordre reste plus sûr si
        // la suppression venait à échouer.
        AuditLog::enregistrer(AuditLog::ACTION_DECONNEXION, 'Déconnexion');

        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Déconnexion réussie.',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load(['role', 'badge']);

        return response()->json([
            'user' => new UserResource($user),
            'permissions' => $user->permissions(),
        ]);
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $status = Password::sendResetLink(
            $request->only('email')
        );

        if ($status === Password::RESET_LINK_SENT) {
            return response()->json([
                'message' => 'Un lien de réinitialisation a été envoyé à votre adresse email.',
            ]);
        }

        throw ValidationException::withMessages([
            'message' => ['Impossible d\'envoyer le lien de réinitialisation.'],
        ]);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json([
                'message' => 'Mot de passe réinitialisé avec succès.',
            ]);
        }

        throw ValidationException::withMessages([
            'message' => ['Le lien de réinitialisation est invalide ou a expiré.'],
        ]);
    }
}
