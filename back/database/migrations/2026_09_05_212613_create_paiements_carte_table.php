<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Paiements par carte simulés (Module 9).
     *
     * Aucun prestataire n'est branché : l'autorisation est jouée localement.
     * La table garde de quoi retrouver et justifier une opération, jamais de
     * quoi la rejouer — pas de numéro complet, pas de cryptogramme. C'est la
     * regle PCI-DSS, et elle vaut aussi ici : rien n'empeche un utilisateur de
     * saisir une vraie carte dans une demonstration.
     */
    public function up(): void
    {
        Schema::create('paiements_carte', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('reference')->unique();
            $table->decimal('montant', 10, 3);

            // Empreinte non rejouable de la carte.
            $table->string('titulaire');
            $table->string('marque', 20);
            $table->string('banque')->nullable();
            $table->string('bin', 6);
            $table->string('dernier4', 4);
            $table->string('numero_masque', 25);
            $table->unsignedTinyInteger('mois_expiration');
            $table->unsignedSmallInteger('annee_expiration');

            $table->string('statut', 20);
            $table->string('motif_refus')->nullable();

            // Ecriture de porte-monnaie produite en cas d'acceptation : le lien
            // rend le rapprochement solde <-> paiement verifiable.
            $table->foreignId('wallet_transaction_id')->nullable()
                ->constrained('wallet_transactions')->nullOnDelete();

            $table->timestamps();

            $table->index(['user_id', 'statut']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('paiements_carte');
    }
};
