# Analyse du besoin — le projet est-il 100% administratif ?

## Réponse directe

**Non.** Le cahier des charges décrit un projet à **deux publics** dans **une seule
plateforme** :

1. **Le back-office métier** (6 rôles : Super Administrateur, Exploitant, Opérateur,
   Technicien, Service Client, Finance) — c'est la majorité du cahier des charges (14
   des 18 modules lui sont dédiés).
2. **Un espace "Client"** (le conducteur propriétaire du véhicule) — un 7ᵉ rôle, avec un
   accès **restreint** mais **réel**, intégré au **même** site, pas une application à part.

Une application mobile "conducteur" est mentionnée, mais seulement comme **objectif
d'intégration future** — ce n'est pas un livrable de cette plateforme web.

---

## Les preuves, section par section

| Section du PDF | Ce qu'elle dit | Ce que ça implique |
|---|---|---|
| 1.1 Contexte | "plateforme … permettant la **supervision, l'administration et la gestion**" | Vocabulaire d'exploitant de réseau, pas d'appli grand public |
| 2. Objectifs, point 6 | "Permettre une intégration avec **une application mobile**" | L'appli conducteur est une intégration **séparée et future**, pas ce projet |
| Module 1 — Authentification | Liste 7 rôles : Super Admin, Exploitant, Opérateur, Technicien, Service Client, Finance, **Client** | Le rôle Client existe dès la conception du système d'auth |
| **Section 7 — Gestion des droits** | Matrice de permissions **par module et par rôle**, avec granularité Lecture / Écriture / Non | C'est la preuve la plus forte : chaque rôle doit voir une interface différente, pas juste "admin ou rien" |
| Plateformes de référence citées | ChargeLab, AMPECO, Driivz, ChargePoint, EVBox/Everon — toutes des plateformes **CPO** (Charge Point Operator, B2B) | Confirme l'ADN "exploitant" du projet. Monta (UX conducteur) n'est cité qu'à titre d'inspiration ergonomique, pas comme modèle fonctionnel principal |

### La matrice de permissions donnée en exemple (Section 7)

> Le PDF dit explicitement "Matrice des permissions **complète**" mais ne donne que 3
> lignes en exemple — le reste (Sessions, Tarification, RFID, Rapports, Firmware…)
> n'est **pas spécifié**, à définir par nous.

| Module | Admin | Exploitant | Technicien | Client |
|---|---|---|---|---|
| Bornes | ✔ (tout) | ✔ (tout) | Lecture seule | Lecture seule |
| Maintenance | ✔ (tout) | ✔ (tout) | ✔ (tout) | Non (aucun accès) |
| Paiement | ✔ (tout) | ✔ (tout) | Non (aucun accès) | Lecture seule |

Le principe à retenir : **ce n'est pas un simple interrupteur "admin / client"**. Chaque
rôle staff a lui-même des droits différents selon le module (un Technicien peut tout
faire sur Maintenance mais seulement lire les Bornes, par exemple).

---

## Les 7 rôles et le besoin front/back attendu pour chacun

| Rôle | Besoin métier (déduit du contexte) | Ce qu'il doit voir côté front | Ce que ça implique côté back |
|---|---|---|---|
| **Super Administrateur** | Contrôle total, configuration système | Tout : les 18 modules, y compris Paramétrage et Journal d'audit | Aucune restriction API |
| **Exploitant** | Gère le réseau au quotidien (bornes, tarifs, sessions) | Bornes, Sessions, Maintenance, Rapports, Tarification — probablement pas Paramétrage système ni gestion des comptes Admin | Accès large, sauf endpoints "système" sensibles |
| **Opérateur** | Rôle intermédiaire, non détaillé dans le PDF | Non spécifié — probablement un sous-ensemble d'Exploitant | Non spécifié |
| **Technicien** | Intervient sur le terrain | Maintenance (complet), Bornes (**lecture seule**) | API bornes en `GET` uniquement pour ce rôle ; Maintenance en écriture |
| **Service Client** | Support aux utilisateurs finaux | Utilisateurs, Sessions (probablement en lecture), pas Paramétrage ni Firmware | Accès ciblé "support" |
| **Finance** | Suivi financier | Paiement (Module 9, pas encore construit), Rapports, Tarification | Accès aux endpoints paiement/facturation |
| **Client** (le conducteur) | Trouver une borne libre, suivre sa recharge, gérer son véhicule/badge | Carte des bornes (**lecture seule**), Mes véhicules, Mon historique, Mon badge RFID, Paiement (**lecture seule**, factures) | Endpoints **scopés à lui-même uniquement** (jamais les données d'un autre utilisateur), pas d'accès aux routes d'administration même avec un token valide |

---

## État actuel de l'implémentation face à ce besoin

Ce qui a déjà été construit (Tiers 1 à 3 + Espace Client) :

- ✅ 7 rôles créés en base (`roles` table), rattachés à chaque utilisateur.
- ✅ Séparation **binaire** : `RequireAuth` (front) + middleware `staff` (back) — un
  utilisateur est soit "Client" (→ `/client`, accès restreint), soit un des 6 rôles
  "staff" (→ `/dashboard`, accès complet).
- ✅ Espace Client réel : carte des bornes en lecture seule, mes véhicules (CRUD scopé à
  soi-même), historique de mes sessions, mon badge RFID (lecture seule).
- ✅ Sécurité vérifiée : un token "Client" reçoit un `403` sur les routes admin même en
  les appelant directement (pas seulement caché par le routeur React).

**Ce qui manque par rapport à la matrice de la Section 7** (l'écart honnête) :

- ❌ **Pas de granularité entre les 6 rôles staff.** Aujourd'hui, Exploitant, Opérateur,
  Technicien, Service Client et Finance ont *tous* un accès strictement identique et
  complet au back-office. Le PDF veut qu'un Technicien, par exemple, ne puisse **pas**
  créer/modifier une borne (lecture seule), alors qu'aujourd'hui il le peut.
- ❌ **Module 9 (Paiement) non construit** — donc la ligne "Paiement" de la matrice
  (Finance ✔, Technicien Non, Client Lecture) ne peut pas encore être appliquée, il n'y
  a rien à protéger.
- ❌ Modules 13 (Firmware), 16 (Documentaire), 18 (Journal d'audit) non construits.
- ⚠️ Authentification : le PDF suggère JWT/OAuth2 ; le projet utilise Laravel Sanctum
  (tokens), une alternative standard et raisonnable pour ce contexte — écart assumé, pas
  un manque.

---

## Conclusion

Le projet n'est pas un pur outil d'administration : c'est une **plateforme d'exploitant**
(le cœur du cahier des charges) **avec un espace client intégré**, et le PDF va même plus
loin en attendant des **permissions différenciées entre les rôles internes eux-mêmes**
(pas seulement staff vs client). L'espace Client existe déjà et fonctionne ; le prochain
écart à combler, s'il faut coller précisément à la Section 7, est la granularité
**intra-staff** (Technicien ≠ Exploitant ≠ Finance) plutôt qu'un simple bloc "staff"
uniforme.
