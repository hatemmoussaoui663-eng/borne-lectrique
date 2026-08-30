<?php

/**
 * Intra-staff permission matrix (Cahier des charges §7 "Gestion des droits").
 * The PDF gives 3 example rows (Bornes, Maintenance, Paiement) across
 * Admin/Exploitant/Technicien/Client and says "matrice complète" without
 * providing the rest — the values below extend that example to every module
 * this platform actually implements, following the same logic (e.g. Finance
 * mirrors the PDF's Paiement row: full where Admin/Exploitant are full,
 * "Non" for Technicien).
 *
 * Levels: 'full' (read + write), 'read' (read-only), 'none' (no access).
 * The "Client" role is intentionally absent here — it never reaches these
 * modules at all (see EnsureStaffRole + the separate /api/me/* endpoints).
 */
return [
    'roles' => [
        'super_admin' => [
            '*' => 'full',
        ],

        'exploitant' => [
            'bornes' => 'full',
            'sessions' => 'read',
            'utilisateurs' => 'full',
            'vehicules' => 'full',
            'maintenance' => 'full',
            'alertes' => 'full',
            'audit' => 'read',
            'firmware' => 'full',
            'documents' => 'full',
            'rapports' => 'full',
            'tarif' => 'full',
            'dashboard' => 'read',
            'commandes_ocpp' => 'full',
            'simulateur' => 'none',
        ],

        'operateur' => [
            'bornes' => 'full',
            'sessions' => 'read',
            'utilisateurs' => 'read',
            'vehicules' => 'read',
            'maintenance' => 'read',
            'alertes' => 'full',
            'audit' => 'none',
            'firmware' => 'read',
            'documents' => 'read',
            'rapports' => 'read',
            'tarif' => 'read',
            'dashboard' => 'read',
            'commandes_ocpp' => 'full',
            'simulateur' => 'none',
        ],

        'technicien' => [
            'bornes' => 'read',
            'sessions' => 'read',
            'utilisateurs' => 'none',
            'vehicules' => 'none',
            'maintenance' => 'full',
            'alertes' => 'read',
            'audit' => 'none',
            'firmware' => 'read',
            'documents' => 'read',
            'rapports' => 'none',
            'tarif' => 'none',
            'dashboard' => 'read',
            'commandes_ocpp' => 'full',
            'simulateur' => 'none',
        ],

        'service_client' => [
            'bornes' => 'read',
            'sessions' => 'read',
            'utilisateurs' => 'full',
            'vehicules' => 'read',
            'maintenance' => 'none',
            'alertes' => 'read',
            'audit' => 'none',
            'firmware' => 'none',
            'documents' => 'read',
            'rapports' => 'none',
            'tarif' => 'none',
            'dashboard' => 'read',
            'commandes_ocpp' => 'none',
            'simulateur' => 'none',
        ],

        'finance' => [
            'bornes' => 'read',
            'sessions' => 'read',
            'utilisateurs' => 'none',
            'vehicules' => 'none',
            'maintenance' => 'none',
            'alertes' => 'none',
            'audit' => 'none',
            'firmware' => 'none',
            'documents' => 'read',
            'rapports' => 'full',
            'tarif' => 'full',
            'dashboard' => 'read',
            'commandes_ocpp' => 'none',
            'simulateur' => 'none',
        ],
    ],
];
