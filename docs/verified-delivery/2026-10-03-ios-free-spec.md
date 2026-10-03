# CommandeIci iOS gratuit et TestFlight, 3 octobre 2026

Owner: fil 01a0ff48-e5fc-79a1-88a1-b200624d19cf, branche codex/commandeici-ios-free-20261003, base c5c0279.

Mission autorisée: auditer/corriger iOS, intégrer RevenueCat sans achat actif et livrer TestFlight pour essai Augustin. App gratuite pour tous actuellement. Texte bref « Gratuit jusqu'en 2027 », sans date de bascule automatique, sans tarif futur choisi, sans achat à 0 EUR. Un futur abonnement exige une nouvelle décision et une souscription volontaire. Pas de limite des 100 comptes, ni collecte de carte.

Sources: dépôt app Comande-Maintenant/commandez; backend tgtvkzmokypztdudwzne; bundle com.commandeici.app. Autres propriétaires: fonctionnel 01a0ff35-918f-7aa1-8eb6-bf8a8c2f11c8 pour commandes/QR/native/SQL/web/backend, historique 01a0fd7f-32a5-7202-8888-d7b0ad52345a pour auth client et SEO site. Messages de coordination envoyés. Aucun worktree concurrent modifié. Aucun déploiement web/SQL concurrent.

Architecture: SDK officiel purchases-capacitor, projet RevenueCat CommandeIci dédié; UUID Supabase comme App User ID, pas d'email/nom transmis; synchronisation sérialisée, déconnexion isolée; absence/indisponibilité SDK ne bloque jamais auth ni fonctions gratuites. Pas de méthode d'achat exposée, pas d'offering payant activé. Clé publique Apple au build local, aucune clé privée dans l'app.

Acceptation: inscription/publication gratuite sans essai30j dans iOS; route abonnement gratuite sans CTA Stripe; comptes reconnectables sans fuite d'identité RevenueCat; offline et redémarrage éprouvés; suite app et XCTest, archive signée, IPA vérifié, upload unique et état Apple/TestFlight relu. Test iPhone physique réalisé ensuite par Augustin. Pas de promesse d'absence universelle de bug.

Plan exécutable:
1. Reproduction baseline: npm ci, npm test (64 tests), npm run typecheck, npm audit; état Apple et RevenueCat lecture seule avant créations. Consigner limites et artefacts.
2. Tests RED src/test/native-billing.test.ts et native-free-ui.test.tsx: SDK auth, concurrence, déconnexion, erreurs, achat impossible; UI gratuite sélection/publiée. GREEN nouveau src/services/native-billing.ts et src/components/NativeBillingLifecycle.tsx, branche native des composants PricingCards/NativeSubscription/OnboardingSuccess et clés i18n14langues. Tests ciblés, typecheck, suite.
3. Intégrer commits terminés auth/commandes, préserver tous les travaux. Vérifier diff global, données/invariants de paiement. Adapter dépendances vulnérables uniquement si vérifiable sans refonte.
4. npm run ios:sync; XCTest simulateur avec lancement, inscription, démo, session/réseau; archive Release appareil avec signature équipe connue; vérifier bundle/backend/SDK/privacy/version/empreinte.
5. Contrôle Apple doublon build, export IPA puis upload altool autorisé; attendre processing valide, rattacher au groupe interne existant ou dédié incluant Augustin; relire statut et groupe. Aucune soumission publique App Review dans cette mission.

Risques et retour: auth et identité élevés, checkout volontairement inexistant; ancien iOS build1 non signé sauvegardé le02octobre; retour local git restore des seuls fichiers du lot/reconstruction commit base; TestFlight expirer uniquement le nouveau build en cas de régression démontrée, ne pas supprimer groupes/versions externes. Aucun secret privé, migration destructrice, paiement ou mail de campagne. Critères d'arrêt: absence de credential/profil Apple, identité croisées, signature invalide, app grisée/offline non récupérable. Documenter le blocage précis sans annoncer TestFlight livré.


## Notifications iOS — extension coordonnée du 03/10

Le propriétaire fonctionnel demande la réception des commandes écran verrouillé.
Notre périmètre : SDK Capacitor officiel, consentement explicite sur dashboard
marchand réel, callbacks APNs, entitlements/signature, stockage token Keychain,
révocation avant logout/suppression, navigation validée par propriété actuelle.
Le propriétaire fonctionnel garde migration, RLS, outbox idempotente et worker APNs.
RPC confirmés : register_order_push_device(p_token,p_environment,p_platform) et
unregister_order_push_device(p_token), identité issue auth.uid() côté serveur.
Payload : aps alerte générique sans nom/commande détaillée, type=new_order et
restaurant_slug à la racine. Le foreground présente uniquement badge pour éviter
le double son du realtime. Production uniquement dans TestFlight ; aucune clé
sandbox créée. La clé privée dédiée reste hors dépôt/rapport, permissions 0600.
TestFlight ne vaut pas preuve de réception APNs sur appareil physique : ce test
reste à observer sur l’iPhone. Ne pas déclarer APNs live avant preuve serveur.

Preuves intermédiaires : 10 tests service push, 2 tests suppression ; race logout
pendant dialogue OS, permission refusée, web/guest sans effet, token invalide,
échec RPC et timeout token. Guide mobile : cible visible (pas sidebar cachée),
tooltip borné au viewport et bouton fermeture accessible, 2 E2E avant/après.
La validation IAP RevenueCat production reste à contrôler ; authentification
Apple sandbox de la clé active acceptée. Aucun produit/achat/offering payant.


### Contrat final push et revue

La migration backend 180 nécessite initialize_order_push_installation(id,secret)
authentifié commerçant AVANT register OS ; identité UUID + secret HEX64 de 256 bits
conservés dans Keychain. register_order_push_device reçoit aussi installation_id
et installation_secret. revoke_order_push_installation(id,secret) permet la
révocation de la seule installation par preuve de possession, même après perte de
session, sans création de ligne anonyme inconnue. Révocation = tombstone immutable ;
après confirmation de cleanup, supprimer la paire locale et générer une nouvelle
paire à la prochaine activation. Aucun transfert de propriétaire par register.
RPC client abortés à 10 secondes, timeout DB 5 secondes ; le garde de génération
bloque un token tardif après initialisation échouée ou déconnexion. Cleanup tente
serveur et OS indépendamment. La reprise après cleanup hors réseau est vérifiée.
Le widget revalide l'ID de session courant au montage et à la demande, y compris
pour le premier restaurant créé sans nouvel événement auth.

Revue indépendante par fils auth/SEO et fonctionnel/orders : signOut directs sous
responsabilité fonctionnelle (hooks à intégrer dans leur snapshot), cleanup SDK,
reprise cold start, tokens différents A/B et deadline RPC corrigés. Preuves finales
à relancer sur l'assemblage core b9d943c + notre native avant archive.
Native exports : UIImage PNG (8 ko) réellement présent dans share sheet et action
Enregistrer dans Fichiers vérifiés via XCTest signé (xctest-qr-isolated.log).
La première erreur Keychain provenait de CODE_SIGNING_ALLOWED=NO sur simulateur.
Les tests natifs finaux doivent être signés ad hoc, sans remplacer Keychain.
RevenueCat 04:20 : deux clés validées format/permissions, aucune offre créée.
