# Migration du lien de récupération vers un code à 6 chiffres

Aucune migration SQL : les jetons de récupération sont générés, expirés et vérifiés par Supabase Auth. Ne pas créer de table de codes et ne pas modifier directement auth.users.

## Configuration obligatoire avant déploiement

Dans le Dashboard du projet Supabase cible :

1. Authentication → Email → Reset password : remplacer le corps du modèle par `supabase/templates/recovery.html`. Utiliser `{{ .Token }}`, sans `{{ .ConfirmationURL }}`.
2. Dans les paramètres du fournisseur Email, régler **Email OTP Length** à **6** et **Email OTP Expiration** à **600 secondes**.
3. Vérifier SMTP et les limites d’envoi/vérification Auth. La longueur et l’expiration sont partagées avec les autres parcours OTP du projet : vérifier leurs consommateurs avant application.

Ces paramètres Auth ne sont pas des objets PostgreSQL et ne sont pas appliqués par `supabase db push`. Aucun changement distant n’est effectué par ce dépôt.

## Parcours

Connexion → Mot de passe oublié → Envoyer le code → `/reinitialiser-mot-de-passe`. Saisir l’adresse, le code et deux fois le nouveau mot de passe (12 à 128 caractères). Le serveur vérifie un jeton de type `recovery` avant toute modification ; la session de récupération est ensuite fermée localement. Le message d’envoi reste identique pour une adresse inconnue ou une erreur d’envoi afin de ne pas révéler les comptes.

## Recette avec un compte de test

- Vérifier la réception d’un e-mail contenant six chiffres et aucun lien de récupération.
- Vérifier le refus des codes erronés, expirés et déjà consommés, sans changement du mot de passe.
- Vérifier qu’une confirmation différente ou un mot de passe trop court est refusé avant consommation du code.
- Vérifier qu’un code valide change le mot de passe, puis que la connexion fonctionne avec le nouveau mot de passe et échoue avec l’ancien.
- Vérifier le renvoi et les limites de fréquence Supabase.

Retour arrière : restaurer l’application et l’ancien modèle d’e-mail ensemble, puis les paramètres OTP précédents si nécessaire. Les anciens liens restent pris en charge par le callback existant durant la transition.
