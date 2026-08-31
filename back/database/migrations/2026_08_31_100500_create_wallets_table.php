<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Porte-monnaie client (Module 9 « Wallet ») et son journal de mouvements.
     *
     * Le solde est stocké plutôt que recalculé à chaque lecture : c'est lui que
     * le débit verrouille en base pour éviter qu'un client paie deux fois avec
     * le même argent (voir PaiementService).
     */
    public function up(): void
    {
        Schema::create('wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->decimal('solde', 10, 3)->default(0);
            $table->timestamps();
        });

        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('wallet_id')->constrained()->cascadeOnDelete();
            // credit (rechargement, remboursement) | debit (paiement)
            $table->string('type');
            $table->decimal('montant', 10, 3);
            // Solde après l'opération : rend le journal relisible sans avoir à
            // rejouer toute l'histoire du porte-monnaie.
            $table->decimal('solde_apres', 10, 3);
            $table->string('motif');
            $table->foreignId('facture_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('effectue_par')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wallet_transactions');
        Schema::dropIfExists('wallets');
    }
};
