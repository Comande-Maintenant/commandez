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
