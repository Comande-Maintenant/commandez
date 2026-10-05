# CommandeIci iOS : découverte, commande et accompagnement

Autorisation Augustin, 04/10/2026 : optimiser l'UX avec les références publiques Uber puis la démo et son onboarding. Livraison iOS/TestFlight autorisée dans la session. Base main 9b94382, runtime précédent 125e18f, version 1.0(5). Worktree ios-free réutilisé, propre ; branche isolée codex/commandeici-ios-journey-20261004. Fils backend/site consultés, aucune mutation SQL/Edge/APNs/facturation ni site Astro prévue.

## Direction de design

Identité CommandeIci affinée selon la planche et le logo transmis pendant cette passe : vert lime décoratif #77D52B, vert #187A26 pour les actions à texte blanc, vert profond #002D19, blanc #FFFFFF, texte #111827, gris #64748B. Les couleurs des restaurateurs sont conservées. Typographie système existante, titres 28–36 px, texte 14–16 px, prix lisibles. Accueil aligné à gauche avec une grande photo de plat et une action de démo. Carte structurée par catégories, recherche visible ; aucune popularité inventée. Panier avec photos et commandes tactiles 44 px. Mouvement limité aux réponses à une action et respect des préférences de mouvement.

Références publiques : https://github.com/uber/baseweb ; https://base.uber.com/ ; https://www.uber.com/us/en/blog/introducing-menu-maker/ . Inspiration pour hiérarchie d'actions, progrès, sélection et lisibilité ; aucun code source privé Uber ni import d'un framework UI supplémentaire.

## Résultats observables et tâches

1. Accueil : « Tester sans créer de compte » est l'action principale pour un nouveau visiteur ; création gratuite et connexion restent accessibles ; propriétaire connecté redirigé comme avant. Index.tsx, test journey-home.test.tsx. RED vérifie hiérarchie/lien demo, absence de promesse de paiement ; GREEN avec accueil visuel et routes inchangées.
2. Carte : recherche par plat/catégorie/description traduits, accents/casse normalisés, résultat vide utile et réinitialisable ; aucune modification des prix/disponibilités ou du catalogue backend. menu-search.ts, MenuSearch.tsx, RestaurantPage.tsx et tests menu-search/journey e2e. Maintenir navigation sticky et garde-fous kiosque.
3. Personnalisation et panier : indicateur obligatoire/facultatif, aide lorsque choix requis absent, progression accessible ; photos panier et contrôles quantité/suppression 44 px, total et CTA préservés. ProductCustomizer.tsx, CartSheet.tsx, tests customer-meat-selection et journey-cart. Pas de changement de calcul/quantité/checkout.
4. Démo : guide par actions réception → préparation → prêt → encaissement. État dérivé des commandes locales persistées ; navigation cuisine/caisse et carte client ; lien de création gratuit après démonstration. DemoOrderControls.tsx, demo-journey.ts, tests demo-journey et e2e. Pas de tutoriel automatique bloquant pour la démo. Le bouton notification native garde son action explicite, délai 10 secondes et permission au clic ; texte clair sur la différence avec l'alerte interne.
5. Nouveau restaurateur : accompagnement contextualisé vers carte, aperçu, notifications et QR, sans déclarer une tâche accomplie sur simple ouverture si elle implique une validation. MerchantSetup.tsx, AdminPage.tsx, tests merchant-setup. Données réelles chargées avec contrôles d'identité existants ; stockage seulement de préférences par restaurant, erreurs non bloquantes. Aucun compte/commande/client réel créé par les tests.
6. Inscription : entrée démo visible et promesse gratuite cohérente, aide de reprise après confirmation ; six étapes, contrôle de confirmation et atomicité préservés. InscriptionPage.tsx/i18n et tests existants.

## Plan de vérification et livraison

Pour chaque comportement : RED test minimal, implémentation, GREEN ciblé. Prévoir typecheck, lint sans nouvelles erreurs, suite unitaire complète, Chromium desktop/mobile et WebKit iPhone ; nouvelle revue indépendante du diff assemblé. Vérifier 320/390/430 px, paysage, RTL, clavier, reduced motion, premier lancement sans préférences de tour. Pas de mutation serveur dans les tests de démo locale ; faux appels pour checkout/inscription.

Construire/synchroniser puis tester nativement les nouveaux parcours et les régressions version5. Gel du SHA, archive signée version1.0(6), parity des assets dist/IPA et mêmes classes/plugins RevenueCat/notifications. Upload une seule fois après revue, groupe interne 6 seulement après VALID ; invitation existante conservée. Installation directe du même runtime sans effacer les données. Déployer app.commandeici.com depuis le même SHA après coordination et vérifier les parcours publics.

Risque moyen, rollback : artefacts5 conservés ; groupe TestFlight précédent 16a5da4b-6143-4ac7-8b48-b74d42aada37, Cloudflare précédent df9ce434-94c1-4fd9-8520-b3e808e16a86. Revenir si contrôles propriétaires/gratuité échouent, prix/cart incorrect, débordement/bouton inaccessible ou erreurs runtime. Pas de certification APNs réel sans compte restaurateur confirmé et canari autorisé. Pas de nouvelle invitation/case Apple. Preuves dans reports/commandeici-ios-journey-2026-10-04.

## Complément autorisé : logo et favicon

Augustin fournit la planche Downloads/board commandeici.png et le symbole Documents/logo commade ici.png ; il demande explicitement leur utilisation et une reprise pour un favicon nickel. Extraction fidèle via imagegen en transparence, exports Sharp PNG 16/32/48/64/180/192/512, ICO multitailles et icône iOS opaque 1024. Pas de coins arrondis ni ombre incrustés dans le carré iOS. Original utilisateur et master conservés, provenance et hashes dans public/images/brand/sources.json. Contrôles visuels en petite taille et format/alpha/dimensions avant signature. Le site Astro reste coordonné avec son propriétaire et hors déploiement de ce fil.

## Complément autorisé : ouverture et autres commerces

Augustin demande pendant les essais natifs une ouverture subtile avec logo visible pendant deux secondes pleines, même si le contenu charge plus vite, puis des démonstrations épicerie et fleuriste. Le SHA f33082c est conservé, relu, non diffusé ; la version6 sera signée depuis le nouveau SHA assemblé.

Ouverture : écran natif UIKit placé devant le bridge, sans retarder sa création, logo fidèle et fond blanc cohérents avec LaunchScreen. Une seule respiration légère puis fondu, minimum2s à partir de la présentation ; préférence Réduire les animations respectée. Seulement au lancement, pas à chaque retour en premier plan. KVO du chargement WK sans remplacer son navigationDelegate ; attente bornée si chargement reste bloqué. Image locale compilée en assetcatalog. Essai natif de durée/transition et preuve vidéo, régressions puis Release sans hooks QA.

Démonstrations : sélecteur de commerce accessible depuis l’action principale de découverte. Restauration vers démo existante ; épicerie et fleuriste vers pages dédiées. Chaque page propose un catalogue illustré, recherche, panier propre à cette démo et acteurs client/commerçant ; simulation locale puis étapes reçue, préparation, prête, retirée. Catalogues/prix/visuels explicitement fictifs, aucun établissement réel créé, aucun RPC d’écriture ou APNs réel. Persistance session scindée par commerce, validée et bornée ; panier client réel/global conservé. Erreurs de stockage non bloquantes, impossible de faire payer ou commander réellement à partir de ces pages.

Nouveaux fichiers : src/lib/demo-commerce.ts et tests de données/persistance ; src/pages/DemoDiscoveryPage.tsx, CommerceDemoPage.tsx ; routes App.tsx, entrée Index/Inscription et i18n14langues. Assets d’illustration via imagegen emballés WebP ; pas d’images externes au rendu. Native CommandeIciViewController et LaunchScreen, image LaunchMark. Tests RED puis GREEN selector/localorders/tenantisolation, responsive320/390/RTL et clavier ; ouvrir/découvrir/clientpanier/commerçantstatuts sur WK natif. Revue complémentaire sur le SHA final avant signature et upload unique6.
