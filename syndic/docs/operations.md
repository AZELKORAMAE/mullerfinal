# Gestion quotidienne

Le module `/operations` nécessite la migration `202611010003_operations.sql`. Elle ajoute six tables sans modifier les tables existantes.

Le syndic crée une dépense et sélectionne les lots de sa résidence concernés. La répartition est égale, calculée en centimes et conserve exactement le montant total. Les habitants consultent uniquement les cotisations des lots auxquels ils ont un accès actif. Les règlements manuels exigent une référence, une date et un montant inférieur ou égal au solde. Les écritures sont conservées ; leur correction comptable n’est pas encore exposée.

Les conversations sont privées par lot entre les habitants autorisés et les gestionnaires de la résidence. L’interface charge les 50 derniers messages ; une actualisation affiche les nouveaux messages. Aucun envoi e-mail ou WhatsApp n’est effectué.

Les réunions utilisent le fuseau `Africa/Casablanca`. Une notification est créée à la programmation. Le rappel des 24 heures est généré lors de la visite de l’utilisateur sur `/operations`. Le syndic peut également envoyer un rappel de cotisation dans le site, limité à un rappel par lot/cotisation et par jour. Aucun ordonnanceur autonome ni notification hors site n’est activé.

Avant commercialisation : recette complète avec syndic et habitants, correction/annulation traçable des écritures financières, gestion des pièces justificatives, sauvegarde/restauration testée, envoi des invitations par e-mail, facturation et restrictions d’abonnement, notifications programmées autonomes, revue juridique et sécurité. Cette version constitue un jalon fonctionnel et ne doit pas être présentée comme un produit commercial audité.
