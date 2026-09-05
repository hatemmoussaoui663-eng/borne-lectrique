<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Ciblage par role de la gestion documentaire (Module 16) : une piece envoyee
 * aux techniciens ne doit ni s'afficher, ni se compter, ni se telecharger
 * chez la finance.
 */
class DocumentCiblageRoleTest extends TestCase
{
    use RefreshDatabase;

    private function deposer(User $auteur, array $roleIds = [], string $titre = 'Piece'): array
    {
        $charge = [
            'type' => 'notice',
            'titre' => $titre,
            'fichier' => UploadedFile::fake()->create('notice.pdf', 12, 'application/pdf'),
        ];

        if ($roleIds !== []) {
            $charge['roles'] = $roleIds;
        }

        return $this->actingAs($auteur, 'sanctum')
            ->postJson('/api/documents', $charge)
            ->assertCreated()
            ->json();
    }

    public function test_un_document_cible_n_apparait_que_pour_le_role_vise(): void
    {
        Storage::fake('local');
        $admin = User::factory()->create();
        $technicien = User::factory()->asRole('technicien')->create();
        $finance = User::factory()->asRole('finance')->create();

        $this->deposer($admin, [$technicien->role_id], 'Procedure technicien');

        $vuTechnicien = $this->actingAs($technicien, 'sanctum')->getJson('/api/documents')->json();
        $this->assertCount(1, $vuTechnicien);

        $vuFinance = $this->actingAs($finance, 'sanctum')->getJson('/api/documents')->json();
        $this->assertCount(0, $vuFinance, 'La finance ne doit pas voir une piece adressee aux techniciens.');
    }

    public function test_un_document_sans_ciblage_reste_visible_de_tous(): void
    {
        Storage::fake('local');
        $admin = User::factory()->create();
        $technicien = User::factory()->asRole('technicien')->create();
        $finance = User::factory()->asRole('finance')->create();

        $this->deposer($admin, [], 'Note de service');

        $this->assertCount(1, $this->actingAs($technicien, 'sanctum')->getJson('/api/documents')->json());
        $this->assertCount(1, $this->actingAs($finance, 'sanctum')->getJson('/api/documents')->json());
    }

    public function test_un_document_peut_viser_plusieurs_roles(): void
    {
        Storage::fake('local');
        $admin = User::factory()->create();
        $technicien = User::factory()->asRole('technicien')->create();
        $finance = User::factory()->asRole('finance')->create();
        $exploitant = User::factory()->asRole('exploitant')->create();

        $this->deposer($admin, [$technicien->role_id, $finance->role_id], 'Contrat partage');

        $this->assertCount(1, $this->actingAs($technicien, 'sanctum')->getJson('/api/documents')->json());
        $this->assertCount(1, $this->actingAs($finance, 'sanctum')->getJson('/api/documents')->json());
        $this->assertCount(0, $this->actingAs($exploitant, 'sanctum')->getJson('/api/documents')->json());
    }

    public function test_le_telechargement_direct_est_refuse_hors_du_role_vise(): void
    {
        Storage::fake('local');
        $admin = User::factory()->create();
        $technicien = User::factory()->asRole('technicien')->create();
        $finance = User::factory()->asRole('finance')->create();

        $id = $this->deposer($admin, [$technicien->role_id])['id'];

        // Le filtrage de la liste ne suffit pas : l'identifiant est devinable.
        $this->actingAs($finance, 'sanctum')->get("/api/documents/{$id}/download")->assertForbidden();
        $this->actingAs($technicien, 'sanctum')->get("/api/documents/{$id}/download")->assertOk();
    }

    public function test_le_compteur_ignore_les_documents_d_un_autre_role(): void
    {
        Storage::fake('local');
        $admin = User::factory()->create();
        $technicien = User::factory()->asRole('technicien')->create();
        $finance = User::factory()->asRole('finance')->create();

        $this->deposer($admin, [$technicien->role_id], 'Pour les techniciens');
        $this->deposer($admin, [], 'Pour tout le monde');

        $this->actingAs($technicien, 'sanctum')->getJson('/api/documents/compteur-non-lus')
            ->assertOk()->assertJson(['total' => 2]);

        $this->actingAs($finance, 'sanctum')->getJson('/api/documents/compteur-non-lus')
            ->assertOk()->assertJson(['total' => 1]);
    }

    public function test_la_suppression_suit_la_meme_regle_que_l_affichage(): void
    {
        Storage::fake('local');
        $admin = User::factory()->create();
        $technicien = User::factory()->asRole('technicien')->create();
        $exploitant = User::factory()->asRole('exploitant')->create();

        $id = $this->deposer($admin, [$technicien->role_id])['id'];

        // L'exploitant a les droits d'ecriture sur le module, mais ce document
        // ne le concerne pas : il ne doit pas pouvoir le supprimer a l'aveugle.
        $this->actingAs($exploitant, 'sanctum')->deleteJson("/api/documents/{$id}")->assertForbidden();
        $this->assertDatabaseHas('documents', ['id' => $id]);

        $this->actingAs($admin, 'sanctum')->deleteJson("/api/documents/{$id}")->assertOk();
        $this->assertDatabaseMissing('documents', ['id' => $id]);
    }

    public function test_le_super_admin_voit_tout_pour_pouvoir_corriger_un_ciblage(): void
    {
        Storage::fake('local');
        $admin = User::factory()->create();
        $technicien = User::factory()->asRole('technicien')->create();

        $id = $this->deposer($admin, [$technicien->role_id])['id'];

        $this->assertCount(1, $this->actingAs($admin, 'sanctum')->getJson('/api/documents')->json());
        $this->actingAs($admin, 'sanctum')->get("/api/documents/{$id}/download")->assertOk();
    }

    public function test_les_destinataires_proposables_excluent_les_roles_sans_acces(): void
    {
        $admin = User::factory()->create();
        Role::firstOrCreate(['name' => 'client'], ['display_name' => 'Client']);

        $noms = collect($this->actingAs($admin, 'sanctum')
            ->getJson('/api/documents/destinataires')->assertOk()->json())
            ->pluck('nom')
            ->all();

        $this->assertNotContains('Client', $noms, "Le client n'a pas acces au module documents.");
        $this->assertNotContains('Super Administrateur', $noms, 'Le super admin voit deja tout.');
    }
}
