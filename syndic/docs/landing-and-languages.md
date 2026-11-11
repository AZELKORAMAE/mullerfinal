# Accueil et langues

L’accueil public présente le service avant la connexion. Le sélecteur global conserve la langue en cookie (français, arabe RTL ou anglais). Les libellés applicatifs et dates suivent ce choix ; les noms et messages saisis par les utilisateurs restent dans leur langue originale. Le catalogue est contrôlé par tests/locales.test.ts et scripts/check-translations.cjs.

Dans Résidence → Communauté, le syndic sans résidence ni appartement dispose désormais de formulaires de création guidés avant l’invitation. Les écritures passent par les règles RLS existantes. Un administrateur de plateforme sans appartenance à une organisation ne reçoit pas les droits du syndic. Aucune migration ni modification des tables existantes.

## Image

Fichier : public/images/residence-hero.png. Image générée par le mode builtin image_gen, sans référence.

Prompt : Use case: ads-marketing. Asset type: full-width website hero background for SyndiConnect, a modern Moroccan residential community app. Create a polished wide architectural editorial photograph of a contemporary Moroccan apartment residence, elegant cream stone facades with deep green palms and landscaped courtyard, subtle geometric Moroccan details, warm late afternoon sunlight, realistic premium property photography, quiet inviting community atmosphere, strong cinematic composition with open darker garden space on the left suitable for white headline overlay and architecture on the right. No text, no logos, no watermarks, no UI. Landscape 16:9.

## Vérification

24 tests automatisés (incluant isolation des accès, cotisations et invitations) ; compilation Next de production ; vérification navigateur des versions française, arabe et anglaise de l’accueil. La création d’un nouvel habitant réel doit être vérifiée avec le compte syndic concerné : aucun compte de production fictif n’a été créé.
