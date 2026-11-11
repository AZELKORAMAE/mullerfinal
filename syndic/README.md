# SyndiConnect

Socle de gestion des copropriétés au Maroc : Next.js, React, TypeScript strict, Tailwind, composants compatibles shadcn/ui et Supabase Auth/PostgreSQL avec RLS.

## Démarrage

Node.js 22 LTS recommandé. Exécuter `npm ci`, copier `.env.example` vers `.env.local`, renseigner la clé **publishable** puis lancer `npm run dev`.

Projet Supabase : `https://ujcfsuvpuaremtvcqjnm.supabase.co`. Aucune clé secrète serveur n’est nécessaire et aucune clé secrète ne doit être committée.

## Base et sécurité

La migration `supabase/migrations/202611010001_syndic_foundations.sql` crée quatre nouvelles tables `syndic_*` et une fonction dédiée. Elle ne modifie aucune table existante ni aucun trigger Auth. Elle s’exécute en transaction et échoue en cas de collision de noms sans remplacer d’objets. Ne jamais lancer `db reset` sur le projet partagé.

La session utilise les cookies SSR, renouvelés par le Proxy. Les pages et mutations vérifient l’utilisateur via `getUser()`. PostgreSQL contrôle les accès aux lignes. La création d’organisation et l’ajout du premier administrateur sont atomiques. Les rôles `admin` et `manager` créent résidences et lots ; `viewer` dispose d’une lecture seule. Les membres ne peuvent pas s’accorder de droits.

## Authentification et déploiement

Autoriser `http://localhost:3000/auth/callback` et le callback du domaine final dans Supabase Auth. Définir `NEXT_PUBLIC_SITE_URL` pour chaque environnement. Conserver la confirmation d’e-mail et configurer SMTP avant ouverture publique. Auth étant partagé, analyser l’impact avant tout changement de ses paramètres globaux. Aucun accès aux organisations SyndiConnect n’est accordé automatiquement aux utilisateurs existants.

Pour déployer, importer ce dépôt dans Vercel ou un hébergeur Next.js, choisir Node.js 22 et configurer les trois variables de `.env.example`. Appliquer la migration une seule fois après inspection/sauvegarde du schéma, puis tester le parcours avec deux comptes. Configurer sauvegardes, restauration, supervision et documents juridiques avant commercialisation.

## Périmètre disponible

- Site public responsive avec périmètre pilote explicite.
- Inscription, connexion, confirmation e-mail, réinitialisation et déconnexion.
- Création d’organisations, de résidences et de lots avec quotes-parts.
- Tableau de bord calculé à partir des données accessibles.
- Isolation RLS entre organisations et validation serveur.

Nouveau jalon : `/admin` pour le suivi manuel des abonnements avec historique, `/app/communaute` pour les invitations de résidents et la publication d’annonces, `/resident` pour accepter une invitation et consulter les activités de sa résidence. Voir [le guide d’installation et d’accès](docs/admin-residents.md). La seconde migration ajoute exclusivement de nouveaux objets ; aucun compte administrateur n’est préconfiguré.

Restent à développer : administration générale des membres, bâtiments/étages, modifications avec historique, finances, incidents, documents, paiements et restrictions automatiques d’abonnement, arabe/RTL, intégrations. Aucun paiement fictif n’est activé.

## Vérification

Jalon du 1 novembre 2026 : migration appliquée au projet Supabase indiqué ; quatre tables créées avec RLS activé. Vérifications effectuées : 12 tests réussis, TypeScript et build de production réussis, API Supabase Auth HTTP 200, affichage des pages publiques et redirection de `/app` vers la connexion sans session. Aucun compte ni donnée métier de test n’a été créé dans la base distante. Le parcours complet avec réception d’e-mail et utilisateur connecté reste à vérifier.

`npm run typecheck`, `npm test`, `npm run build`.

Les tests PostgreSQL embarqués PGlite vérifient RLS et les contraintes avec des identités simulées, sans toucher la base distante. La CI utilise les mêmes commandes. Le parcours e-mail réel nécessite des comptes et la configuration SMTP/redirections de l’environnement cible.

## Structure

`src/app` : routes et actions serveur ; `src/components` : interface ; `src/lib` : données, Supabase, validations ; `supabase/migrations` : SQL versionné ; `tests` : validation et sécurité ; `.github/workflows` : CI.

Réinitialisation par code à six chiffres : voir [la configuration et la recette Supabase Auth](docs/password-recovery.md). Appliquer le modèle d’e-mail et les paramètres OTP avant de déployer cette version ; aucune migration SQL n’est requise.

Inscription publique, approbation des comptes syndic, plans (essai 1 mois, Standard 30 DH/mois, Entreprise sur devis), paiement par virement avec validation dans `/admin`, demandes d’adhésion et blocage/suppression des habitants : voir [docs/inscription-abonnements.md](docs/inscription-abonnements.md).
