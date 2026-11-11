# État de la version — 8 novembre 2026

Disponible dans le code : administration des abonnements, comptes syndics créés par l’administrateur, accès habitants par syndic et lot, résidences et lots, annonces, cotisations réparties entre lots sélectionnés, règlements manuels, conversations par lot, réunions et notifications internes, export CSV des cotisations et suivi des incidents.

La création des comptes nécessite `SUPABASE_SECRET_KEY` côté serveur Vercel. La clé n’est jamais incluse dans le bundle navigateur. Les mots de passe sont transmis à Supabase Auth, jamais stockés dans les tables applicatives. Les réglages Auth partagés avec l’autre application restent inchangés.

Les migrations `202611020001_private_registration.sql` et `202611080001_support_and_accounts.sql` ont été appliquées sur le projet prévu. L’association d’un habitant est atomique ; la création du compte Auth et l’association restent deux opérations distinctes. Si Auth réussit mais que la base est indisponible, une intervention opérateur peut être nécessaire pour reprendre l’association sans recréer le compte.

Limites avant commercialisation : pas de prestataire de paiement intégré, pas de facturation automatique ni blocage des opérations à expiration, pas de notification hors site/ordonnanceur, pas de pièces jointes privées, pas d’annulation comptable traçable, pas de gestion des prestataires. Les réunions ne disposent pas encore d’annulation/reprogrammation. Les messages se chargent après actualisation. Les documents juridiques, la restauration de sauvegarde et les parcours complets avec comptes réels doivent être validés. Cette version ne constitue pas une certification de préparation commerciale.
