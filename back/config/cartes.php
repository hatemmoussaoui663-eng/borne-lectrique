<?php

return [

    /*
    |--------------------------------------------------------------------------
    | BIN des cartes tunisiennes
    |--------------------------------------------------------------------------
    |
    | Le BIN (Bank Identification Number) est le préfixe d'un numéro de carte ;
    | il identifie la banque émettrice. Seules les cartes dont le préfixe figure
    | ici sont acceptées, ce qui réalise la règle « cartes tunisiennes
    | uniquement ».
    |
    | ATTENTION : cette table est le SEUL endroit à modifier pour ouvrir ou
    | fermer l'acceptation d'une banque. Les préfixes ci-dessous sont des
    | valeurs de DÉMONSTRATION, choisies pour faire tourner la simulation ;
    | ils ne proviennent pas d'une source officielle. Avant toute mise en
    | production, remplacez-les par les BIN réels communiqués par la Société
    | Monétique Tunisie ou par chaque banque.
    |
    */

    'bins' => [
        '400000' => 'BIAT',
        '404040' => 'Banque de Tunisie',
        '450000' => 'Attijari Bank',
        '457100' => 'UIB',
        '510000' => 'STB',
        '521000' => 'BNA',
        '535000' => 'Amen Bank',
        '540000' => 'Banque Zitouna',
        '550000' => 'BH Bank',
        '588000' => 'ATB',
    ],

    /*
    | Plafond d'un rechargement en dinars. Garde-fou de simulation : évite
    | qu'une faute de frappe crédite un porte-monnaie de plusieurs millions.
    */
    'plafond_rechargement' => env('CARTE_PLAFOND_RECHARGEMENT', 5000),

    /*
    | Carte de test refusée par l'autorisation, pour pouvoir démontrer le
    | chemin d'échec sans dépendre du hasard.
    */
    'carte_refusee' => env('CARTE_TEST_REFUSEE', '4000000000000002'),

];
