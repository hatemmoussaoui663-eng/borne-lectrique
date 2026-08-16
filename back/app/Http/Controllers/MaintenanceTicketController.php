<?php

namespace App\Http\Controllers;

use App\Events\AlerteUpdated;
use App\Events\BorneUpdated;
use App\Events\MaintenanceTicketUpdated;
use App\Models\Alerte;
use App\Models\MaintenanceTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * A "technicien" here is a real assignment (technicien_id -> users), not free
 * text: a user with that role can only touch the status of tickets assigned
 * to them, while anyone else with full Maintenance access (Exploitant,
 * Opérateur is read-only, Super Admin) can create/assign/edit any ticket.
 */
class MaintenanceTicketController extends Controller
{
    public function index(): JsonResponse
    {
        $tickets = MaintenanceTicket::with(['borne', 'technicien'])->latest()->get();

        return response()->json($tickets->map->toFrontendArray());
    }

    public function store(Request $request): JsonResponse
    {
        $isTechnicien = $this->isTechnicien($request);

        $data = $request->validate([
            'borne_id' => ['required', 'integer', Rule::exists('bornes', 'id')],
            'titre' => 'required|string|max:255',
            'priorite' => ['required', Rule::in(['Basse', 'Moyenne', 'Haute', 'Critique'])],
            'statut' => ['sometimes', Rule::in(['Ouvert', 'Planifié', 'En cours', 'Résolu'])],
            'technicien_id' => ['sometimes', 'nullable', 'integer', Rule::exists('users', 'id')],
            'pieces_remplacees' => 'nullable|array',
            'pieces_remplacees.*' => 'string|max:100',
        ]);

        // A Technicien reporting a breakdown is always assigned to themself —
        // reassigning to someone else is an Exploitant/Admin decision.
        $data['technicien_id'] = $isTechnicien ? $request->user()->id : ($data['technicien_id'] ?? null);
        $data['statut'] ??= 'Ouvert';

        $ticket = MaintenanceTicket::create($data);
        $ticket->load(['borne', 'technicien']);

        $this->syncBorneStatus($ticket);
        MaintenanceTicketUpdated::dispatch($ticket);

        return response()->json($ticket->toFrontendArray(), 201);
    }

    public function update(Request $request, MaintenanceTicket $maintenanceTicket): JsonResponse
    {
        $isTechnicien = $this->isTechnicien($request);

        if ($isTechnicien && $maintenanceTicket->technicien_id !== $request->user()->id) {
            abort(403, "Ce ticket n'est pas assigné à votre compte.");
        }

        $rules = [
            'statut' => ['sometimes', Rule::in(['Ouvert', 'Planifié', 'En cours', 'Résolu'])],
        ];

        // A Technicien may only close out their own ticket's status — retitling,
        // reprioritizing or reassigning it stays an Exploitant/Admin action.
        if (! $isTechnicien) {
            $rules += [
                'titre' => 'sometimes|required|string|max:255',
                'priorite' => ['sometimes', Rule::in(['Basse', 'Moyenne', 'Haute', 'Critique'])],
                'technicien_id' => ['sometimes', 'nullable', 'integer', Rule::exists('users', 'id')],
                'pieces_remplacees' => 'nullable|array',
                'pieces_remplacees.*' => 'string|max:100',
            ];
        }

        $data = $request->validate($rules);

        $maintenanceTicket->update($data);
        $maintenanceTicket->load(['borne', 'technicien']);

        $this->syncBorneStatus($maintenanceTicket);
        MaintenanceTicketUpdated::dispatch($maintenanceTicket);

        return response()->json($maintenanceTicket->toFrontendArray());
    }

    public function destroy(MaintenanceTicket $maintenanceTicket): JsonResponse
    {
        $maintenanceTicket->delete();

        return response()->json(['message' => 'Ticket supprimé.']);
    }

    private function isTechnicien(Request $request): bool
    {
        return $request->user()?->role?->name === 'technicien';
    }

    /**
     * Keeps the borne's live état honest with respect to open critical
     * breakdowns reported through Maintenance, so every role watching the
     * bornes map (admin *and* the Espace Client) sees the same "en panne"
     * signal — not just staff who happen to have the Maintenance page open.
     */
    private function syncBorneStatus(MaintenanceTicket $ticket): void
    {
        if ($ticket->priorite !== 'Critique') {
            return;
        }

        $borne = $ticket->borne;
        if ($borne === null) {
            return;
        }

        if ($ticket->statut !== 'Résolu') {
            if ($borne->status === 'Défaut') {
                return;
            }

            $borne->status = 'Défaut';
            $borne->save();
            BorneUpdated::dispatch($borne);
            $this->raiseBreakdownAlert($borne);

            return;
        }

        // Ticket just resolved: only clear the fault if no other open
        // critical ticket still claims this borne is broken.
        $stillBroken = MaintenanceTicket::where('borne_id', $borne->id)
            ->where('priorite', 'Critique')
            ->where('statut', '!=', 'Résolu')
            ->where('id', '!=', $ticket->id)
            ->exists();

        if ($stillBroken || $borne->status !== 'Défaut') {
            return;
        }

        $borne->status = 'Disponible';
        $borne->save();
        BorneUpdated::dispatch($borne);
    }

    private function raiseBreakdownAlert(mixed $borne): void
    {
        $hasUnread = Alerte::where('borne_id', $borne->id)
            ->where('connector_id', 0)
            ->where('type', 'defaut_materiel')
            ->whereNull('read_at')
            ->exists();

        if ($hasUnread) {
            return;
        }

        $alerte = Alerte::create([
            'borne_id' => $borne->id,
            'connector_id' => 0,
            'type' => 'defaut_materiel',
            'severite' => 'critical',
            'message' => "Panne signalée sur {$borne->name} (ticket de maintenance critique)",
        ]);

        AlerteUpdated::dispatch($alerte);
    }
}
