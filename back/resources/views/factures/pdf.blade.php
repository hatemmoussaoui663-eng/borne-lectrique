{{-- Facture PDF (Module 9). Rendue par dompdf : styles en ligne et tables,
     pas de flexbox ni de grid, que dompdf ne sait pas mettre en page. --}}
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>{{ $facture->numero }}</title>
    <style>
        @page { margin: 30px 40px; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #1a1a1a; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .muted { color: #666; }
        .entete { width: 100%; margin-bottom: 28px; }
        .entete td { vertical-align: top; }
        .bloc { background: #f6f7f9; padding: 12px 14px; border-radius: 6px; }
        table.lignes { width: 100%; border-collapse: collapse; margin-top: 18px; }
        table.lignes th { text-align: left; border-bottom: 2px solid #1a1a1a; padding: 8px 6px; font-size: 11px; text-transform: uppercase; }
        table.lignes td { padding: 8px 6px; border-bottom: 1px solid #e3e5e9; }
        .droite { text-align: right; }
        table.totaux { width: 46%; margin-left: 54%; margin-top: 16px; border-collapse: collapse; }
        table.totaux td { padding: 6px; }
        table.totaux tr.ttc td { border-top: 2px solid #1a1a1a; font-weight: bold; font-size: 14px; }
        .statut { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: bold; }
        .statut--payee { background: #e2f5e8; color: #14683a; }
        .statut--impayee { background: #fdecec; color: #9b1c1c; }
        .statut--remboursee { background: #eee9fb; color: #4c2f96; }
        .statut--annulee { background: #eceef1; color: #4a5059; }
        footer { position: fixed; bottom: -10px; left: 0; right: 0; text-align: center; font-size: 10px; color: #888; }
    </style>
</head>
<body>
    <table class="entete">
        <tr>
            <td style="width: 55%;">
                <h1>BornElect</h1>
                <div class="muted">
                    Réseau de bornes de recharge électrique<br>
                    Tunis, Tunisie
                </div>
            </td>
            <td class="droite">
                <div style="font-size: 16px; font-weight: bold;">Facture {{ $facture->numero }}</div>
                <div class="muted">Émise le {{ $facture->emise_le?->format('d/m/Y à H:i') }}</div>
                @if ($facture->echeance)
                    <div class="muted">Échéance : {{ $facture->echeance->format('d/m/Y') }}</div>
                @endif
                <div style="margin-top: 8px;">
                    <span class="statut statut--{{ $facture->statut }}">
                        {{ ['impayee' => 'Impayée', 'payee' => 'Payée', 'remboursee' => 'Remboursée', 'annulee' => 'Annulée'][$facture->statut] ?? $facture->statut }}
                    </span>
                </div>
            </td>
        </tr>
    </table>

    <div class="bloc">
        <strong>Client</strong><br>
        {{ $facture->user_nom }}
        @if ($facture->user?->email)
            <br><span class="muted">{{ $facture->user->email }}</span>
        @endif
    </div>

    <table class="lignes">
        <thead>
            <tr>
                <th>Prestation</th>
                <th class="droite">Énergie</th>
                <th class="droite">Montant HT</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>
                    Session de recharge
                    @if ($facture->chargeSession?->borne)
                        <br><span class="muted">Borne {{ $facture->chargeSession->borne->name }}</span>
                    @endif
                    @if ($facture->chargeSession?->started_at)
                        <br><span class="muted">
                            Du {{ $facture->chargeSession->started_at->format('d/m/Y H:i') }}
                            @if ($facture->chargeSession->stopped_at)
                                au {{ $facture->chargeSession->stopped_at->format('d/m/Y H:i') }}
                            @endif
                        </span>
                    @endif
                </td>
                <td class="droite">
                    {{ number_format((float) ($facture->chargeSession->energie_kwh ?? 0), 3, ',', ' ') }} kWh
                </td>
                <td class="droite">{{ number_format($facture->montant_ht, 3, ',', ' ') }} DT</td>
            </tr>
        </tbody>
    </table>

    <table class="totaux">
        <tr>
            <td>Total HT</td>
            <td class="droite">{{ number_format($facture->montant_ht, 3, ',', ' ') }} DT</td>
        </tr>
        @if ($facture->montant_remise > 0)
            <tr>
                <td>Remise abonnement ({{ number_format($facture->remise_pourcent, 2, ',', ' ') }} %)</td>
                <td class="droite">− {{ number_format($facture->montant_remise, 3, ',', ' ') }} DT</td>
            </tr>
        @endif
        <tr>
            <td>TVA ({{ number_format($facture->tva_taux, 2, ',', ' ') }} %)</td>
            <td class="droite">{{ number_format($facture->montant_tva, 3, ',', ' ') }} DT</td>
        </tr>
        <tr class="ttc">
            <td>Total TTC</td>
            <td class="droite">{{ number_format($facture->montant_ttc, 3, ',', ' ') }} DT</td>
        </tr>
    </table>

    @if ($facture->paiements->isNotEmpty())
        <table class="lignes">
            <thead>
                <tr>
                    <th>Règlement</th>
                    <th>Référence</th>
                    <th>Date</th>
                    <th class="droite">Montant</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($facture->paiements as $paiement)
                    <tr>
                        <td>
                            {{ ['carte' => 'Carte bancaire', 'wallet' => 'Porte-monnaie', 'abonnement' => 'Abonnement', 'differe' => 'Paiement différé'][$paiement->moyen] ?? $paiement->moyen }}
                            @if ($paiement->statut === 'rembourse')
                                <br><span class="muted">Remboursé le {{ $paiement->rembourse_le?->format('d/m/Y') }}</span>
                            @endif
                        </td>
                        <td class="muted">{{ $paiement->reference ?? '—' }}</td>
                        <td class="muted">{{ $paiement->paye_le?->format('d/m/Y H:i') ?? 'En attente' }}</td>
                        <td class="droite">{{ number_format($paiement->montant, 3, ',', ' ') }} DT</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    <footer>
        {{ $facture->numero }} — document généré par la plateforme BornElect
    </footer>
</body>
</html>
