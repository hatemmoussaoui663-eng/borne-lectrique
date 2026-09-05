<?php

namespace App\Http\Requests\Auth;

use App\Notifications\ReinitialisationMotDePasse;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Le compte peut etre designe par son email ou par son numero de telephone ;
 * le canal d'envoi du lien decoule de ce choix.
 */
class ForgotPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required_without:phone', 'prohibits:phone', 'email'],
            'phone' => ['required_without:email', 'string', 'min:8', 'max:30', 'regex:/^[0-9+ ().-]+$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required_without' => 'Indiquez une adresse email ou un numero de telephone.',
            'email.prohibits' => 'Indiquez une adresse email ou un numero de telephone, pas les deux.',
            'email.email' => 'L\'adresse email est invalide.',
            'phone.required_without' => 'Indiquez une adresse email ou un numero de telephone.',
            'phone.min' => 'Le numero de telephone est trop court.',
            'phone.regex' => 'Le numero de telephone est invalide.',
        ];
    }

    /**
     * Canal de notification correspondant a l'identifiant saisi.
     */
    public function canal(): string
    {
        return $this->filled('phone')
            ? ReinitialisationMotDePasse::CANAL_SMS
            : ReinitialisationMotDePasse::CANAL_MAIL;
    }
}
