<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Marqueur « nouveau document » de la gestion documentaire (Module 16) : un
 * document deposé est neuf pour tout le monde sauf son auteur, et cesse de
 * l'etre pour chacun des qu'il l'ouvre.
 */
class DocumentLectureTest extends TestCase
{
    use RefreshDatabase;

    private function deposer(User $auteur, string $titre = 'Notice X200'): array
    {
        return $this->actingAs($auteur, 'sanctum')
            ->postJson('/api/documents', [
                'type' => 'notice',
                'titre' => $titre,
                'fichier' => UploadedFile::fake()->create('notice.pdf', 12, 'application/pdf'),
            ])
            ->assertCreated()
            ->json();
    }

    public function test_un_document_est_neuf_pour_les_autres_utilisateurs(): void
    {
        Storage::fake('local');
        $auteur = User::factory()->create();
        $autre = User::factory()->create();

        $this->deposer($auteur);

        $documents = $this->actingAs($autre, 'sanctum')->getJson('/api/documents')->assertOk()->json();

        $this->assertCount(1, $documents);
        $this->assertTrue($documents[0]['nonLu']);
    }

    public function test_son_auteur_ne_voit_pas_son_propre_depot_comme_neuf(): void
    {
        Storage::fake('local');
        $auteur = User::factory()->create();

        $reponse = $this->deposer($auteur);
        $this->assertFalse($reponse['nonLu']);

        $documents = $this->actingAs($auteur, 'sanctum')->getJson('/api/documents')->assertOk()->json();
        $this->assertFalse($documents[0]['nonLu']);
    }

    public function test_consulter_le_document_eteint_le_marqueur(): void
    {
        Storage::fake('local');
        $auteur = User::factory()->create();
        $autre = User::factory()->create();
        $id = $this->deposer($auteur)['id'];

        $this->actingAs($autre, 'sanctum')->get("/api/documents/{$id}/download")->assertOk();

        $documents = $this->actingAs($autre, 'sanctum')->getJson('/api/documents')->assertOk()->json();
        $this->assertFalse($documents[0]['nonLu']);
    }

    public function test_le_marqueur_est_propre_a_chaque_utilisateur(): void
    {
        Storage::fake('local');
        $auteur = User::factory()->create();
        $lecteur = User::factory()->create();
        $absent = User::factory()->create();
        $id = $this->deposer($auteur)['id'];

        $this->actingAs($lecteur, 'sanctum')->get("/api/documents/{$id}/download")->assertOk();

        $vuParAbsent = $this->actingAs($absent, 'sanctum')->getJson('/api/documents')->json();
        $this->assertTrue($vuParAbsent[0]['nonLu'], "La lecture d'un tiers ne doit pas eteindre le marqueur.");
    }

    public function test_relire_un_document_n_empile_pas_les_accuses(): void
    {
        Storage::fake('local');
        $auteur = User::factory()->create();
        $lecteur = User::factory()->create();
        $id = $this->deposer($auteur)['id'];

        $this->actingAs($lecteur, 'sanctum')->get("/api/documents/{$id}/download")->assertOk();
        $this->actingAs($lecteur, 'sanctum')->get("/api/documents/{$id}/download")->assertOk();

        $this->assertDatabaseCount('document_lectures', 2); // l'auteur + le lecteur
    }

    public function test_le_compteur_du_menu_suit_les_documents_non_ouverts(): void
    {
        Storage::fake('local');
        $auteur = User::factory()->create();
        $autre = User::factory()->create();

        $premier = $this->deposer($auteur, 'A')['id'];
        $this->deposer($auteur, 'B');

        // L'auteur est marque lecteur a chaque depot : rien de neuf pour lui.
        $this->actingAs($auteur, 'sanctum')->getJson('/api/documents/compteur-non-lus')
            ->assertOk()->assertJson(['total' => 0]);

        $this->actingAs($autre, 'sanctum')->getJson('/api/documents/compteur-non-lus')
            ->assertOk()->assertJson(['total' => 2]);

        $this->actingAs($autre, 'sanctum')->get("/api/documents/{$premier}/download")->assertOk();

        $this->actingAs($autre, 'sanctum')->getJson('/api/documents/compteur-non-lus')
            ->assertOk()->assertJson(['total' => 1]);
    }

    public function test_la_liste_ne_declenche_pas_de_requete_par_document(): void
    {
        Storage::fake('local');
        $auteur = User::factory()->create();
        $autre = User::factory()->create();

        foreach (['A', 'B', 'C'] as $titre) {
            $this->deposer($auteur, $titre);
        }

        $this->actingAs($autre, 'sanctum');
        DB::enableQueryLog();
        $this->getJson('/api/documents')->assertOk();
        $requetes = count(DB::getQueryLog());
        DB::disableQueryLog();

        // Le marqueur passe par une sous-requete d'existence : le nombre de
        // requetes ne doit pas croitre avec le nombre de documents.
        $this->assertLessThan(8, $requetes, "Suspicion de N+1 : {$requetes} requetes.");
    }
}
