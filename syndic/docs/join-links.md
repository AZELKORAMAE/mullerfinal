# Invitation avec création de compte

Le syndic ouvre Habitants, choisit un appartement et crée un lien. Le lien est valable sept jours, pour une seule création de compte. Il se copie depuis cet écran. Le formulaire public affiche uniquement la résidence et le nom de son organisation gestionnaire, puis demande prénom, nom, pseudo, téléphone, e-mail et mot de passe.

La création du compte intervient à la soumission, jamais lors d’une simple ouverture de lien. Aucun e-mail de confirmation n’est envoyé. Le possesseur du lien reçoit uniquement l’accès au lot prévu ; il ne devient pas membre de l’organisation. Les champs personnels sont enregistrés dans les métadonnées Auth et ne sont pas utilisés pour décider des droits. Le téléphone et l’e-mail ainsi déclarés ne constituent pas des coordonnées vérifiées par SMS/e-mail.

Une réservation SQL de cinq minutes évite la double utilisation simultanée. L’association au lot et la consommation du lien sont atomiques. La création Auth reste extérieure à la transaction SQL : en cas d’échec réseau entre les deux étapes, un opérateur doit reprendre l’association. Aucun compte existant n’est modifié ni son mot de passe remplacé si une adresse est déjà utilisée. Le syndic peut utiliser le parcours d’invitation d’un compte existant dans ce cas.

Les gestionnaires voient uniquement les liens des résidences qu’ils gèrent. Les utilisateurs anonymes n’ont aucun accès direct à la table ; le serveur vérifie le lien avant d’afficher le formulaire. Le rôle serveur est seul autorisé à réserver et consommer le lien. La révocation d’un lien utilisé révoque aussi l’accès résident associé.

Vérifications : tests PostgreSQL embarqués de réservation concurrente, consommation unique, refus des appels directs non autorisés et retrait d’accès après révocation ; compilation Next.js. La création complète d’un compte réel n’est pas exécutée par les tests de base.
