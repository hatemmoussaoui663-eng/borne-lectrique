<?php

namespace App\Http\Controllers;

use App\Models\MaintenanceTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MaintenanceTicketController extends Controller
{
    public function index(): JsonResponse
    {
        $tickets = MaintenanceTicket::with('borne')->latest()->get();

        return response()->json($tickets->map->toFrontendArray());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'borne_id' => ['required', 'integer', Rule::exists('bornes', 'id')],
            'titre' => 'required|string|max:255',
            'priorite' => ['required', Rule::in(['Basse', 'Moyenne', 'Haute', 'Critique'])],
            'statut' => ['sometimes', Rule::in(['Ouvert', 'Planifié', 'En cours', 'Résolu'])],
            'technicien' => 'nullable|string|max:255',
            'pieces_remplacees' => 'nullable|array',
            'pieces_remplacees.*' => 'string|max:100',
        ]);

        $data['statut'] ??= 'Ouvert';
        $ticket = MaintenanceTicket::create($data);
        $ticket->load('borne');

        return response()->json($ticket->toFrontendArray(), 201);
    }

    public function update(Request $request, MaintenanceTicket $maintenanceTicket): JsonResponse
    {
        $data = $request->validate([
            'titre' => 'sometimes|required|string|max:255',
            'priorite' => ['sometimes', Rule::in(['Basse', 'Moyenne', 'Haute', 'Critique'])],
            'statut' => ['sometimes', Rule::in(['Ouvert', 'Planifié', 'En cours', 'Résolu'])],
            'technicien' => 'nullable|string|max:255',
            'pieces_remplacees' => 'nullable|array',
            'pieces_remplacees.*' => 'string|max:100',
        ]);

        $maintenanceTicket->update($data);
        $maintenanceTicket->load('borne');

        return response()->json($maintenanceTicket->toFrontendArray());
    }

    public function destroy(MaintenanceTicket $maintenanceTicket): JsonResponse
    {
        $maintenanceTicket->delete();

        return response()->json(['message' => 'Ticket supprimé.']);
    }
}
