# Administration et résidents

## Installation

Appliquer `supabase/migrations/202611010002_admin_residents.sql` une seule fois après la migration initiale. Cette migration ajoute six tables et des fonctions dédiées. Les quatre tables SyndiConnect préexistantes, les autres tables applicatives et leurs politiques restent inchangées. Les références à ces tables sont uniquement lues.

## Premier administrateur

Le compte doit exister dans Supabase Auth avec une adresse confirmée. Aucun mot de passe ni compte administrateur n’est codé en dur. Aucun endpoint public ne permet de se promouvoir.

Après vérification de l’identité, un opérateur autorisé peut ajouter l’UUID Auth du compte dans `syndic_platform_admins.user_id` depuis Supabase. Cette opération accorde la consultation des noms d’organisations et la gestion des abonnements. Elle ne donne pas accès aux lots ni aux données privées des résidents. Ne pas créer de rôle administrateur à partir des métadonnées modifiables par l’utilisateur.

L’URL est `/admin`. Sans session, elle redirige vers `/connexion`. Sans rôle autorisé, elle redirige vers `/acces-refuse`. Les actions serveur et fonctions SQL vérifient également le rôle. L’entrée du rôle doit être supprimée par un opérateur autorisé pour révoquer cet accès.

## Abonnements

Offres : Essentiel, Pro et Business. Statuts : essai, actif, à régulariser, résilié, expiré et suspendu. La date de fin est interprétée en UTC. Chaque modification exige un motif et produit une ligne d’historique immuable pour les comptes applicatifs. Un statut actif/essai dont la date est dépassée s’affiche comme expiré.

Il s’agit d’un suivi commercial manuel : aucun paiement n’est encaissé et aucun reçu de règlement n’est fabriqué. Le statut actif doit être justifié par une validation vérifiée ou une décision commerciale. Le blocage automatique des écritures des syndics à expiration n’est pas inclus : il nécessiterait notamment une évolution des politiques existantes, exclue par la demande de préserver ces tables.

## Inviter des résidents

Le syndic ouvre `/app/communaute`, choisit un lot et saisit l’e-mail du résident. Il partage lui-même l’URL `/resident` : aucun envoi automatique n’est effectué. L’invitation expire après sept jours. Le destinataire crée son compte, confirme son e-mail et accepte l’invitation depuis `/resident`. L’acceptation utilise l’adresse confirmée conservée par Auth, jamais une valeur du formulaire ni des métadonnées utilisateur.

L’accès est limité au lot associé et aux annonces de sa résidence. Un résident ne devient pas membre de l’organisation du syndic. Le syndic peut révoquer une invitation et son accès associé. Les annonces sont publiées depuis le même écran. Les résidents consultent ces activités sans permission de publication.

## Tests

`npm test` vérifie les accès inter-organisations, la non-escalade de privilèges, l’administration des abonnements et leur historique, les invitations mal adressées/non confirmées/expirées, l’acceptation et la révocation. Aucun test n’écrit dans la base distante.
