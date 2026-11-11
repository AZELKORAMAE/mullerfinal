# Refonte de navigation

Le centre de l’application est `/operations` avec cinq vues : accueil et soldes, dépenses, messages, activités et notifications. La navigation fixe est adaptée aux écrans mobiles. Les actions de création restent réservées aux gestionnaires des résidences accessibles, selon les politiques existantes.

Les espaces résidents, incidents et gestion immobilière utilisent le même cadre visuel. Le pseudo est enregistré dans les métadonnées personnelles Auth et n’intervient jamais dans les autorisations. Les liens d’invitation reprennent la validation par adresse confirmée et l’expiration existantes ; un lien seul ne donne aucun accès aux données.

La refonte conserve le modèle financier actuel : appels de cotisations par lot et enregistrement manuel des règlements. Elle n’ajoute pas un transfert d’argent réel. Le rapprochement bancaire, l’équilibrage des avances entre habitants comme un compte partagé, les factures/justificatifs privés et la place de marché des prestataires restent des développements distincts. Aucun écran fictif de paiement ou de prestation n’est présenté comme opérationnel.
