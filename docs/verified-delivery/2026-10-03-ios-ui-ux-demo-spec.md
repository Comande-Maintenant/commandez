# CommandeIci iOS : démo, notifications et menu visuel

Autorisation : demande explicite d'Augustin du 3 octobre 2026. Priorité UI/UX, correction de la démo, images de plats et marques, nouvelle livraison iOS. Gratuit jusqu'en 2027, RevenueCat connecté sans achat. Pas de facturation, pas de suppression de compte/données.

Base : 49f09cc (merge main 6fc44c4). Worktree isolé commandez-ios-free-20261003. L'agent fonctionnel conserve les migrations, Edge, catalogue serveur et APNs. Cette branche possède les composants mobile, médias embarqués, démo locale et intégration native.

## Résultats attendus

1. Carte lisible immédiatement, sans cartes rendues invisibles par une animation au défilement. Ajout visible au toucher. Images propres au restaurateur prioritaires ; média cassé remplacé ; préférence masquer photos respectée. Photos d'illustration indiquées comme telles. Aucun logo généré.
2. Visuels officiels de boissons reconnus par nom normalisé, sans confondre variantes Coca-Cola (original, zero, cherry). Catalogue embarqué sans dépendance réseau pour ces illustrations.
3. Caisse et boutons de validation accessibles à 320, 390 et 430 pixels, portrait/paysage, sans recouvrement par navigation ou zone de sécurité iOS. Listes internes défilantes.
4. Démo : action explicite de réception d'une commande fictive, alerte complète et parcours préparation/encaissement. État local conservé au rafraîchissement, isolé par établissement, aucune écriture serveur pour une commande locale.
5. Notifications : distinction claire entre simulation locale et véritable APNs du restaurant connecté. Permission demandée au clic. Alerte iOS de démo vérifiable même après verrouillage. Permission refusée expliquée. Identité propriétaire et installation sécurisée inchangées.
6. Tests des parcours client et restaurateur, vérification visuelle sur navigateur mobile puis iOS. Une nouvelle archive signée contient exactement les assets et sources vérifiés. Upload TestFlight autorisé, disponibilité Apple constatée séparément. Installation directe de la même version possible sans supprimer les données.

## Plan et vérifications

- Capturer l'état initial : screenshots menu/cuisine/caisse, tests existants (337 tests réussis).
- Écrire tests qui reproduisent visibilité, couverture images, persistance démo et absence de mutation serveur. Constater RED puis implémenter et confirmer GREEN.
- Ajouter catalogue local et photographies, puis vérifier les sources et budgets d'assets (images 480px, WebP, pas de hotlink).
- Corriger géométrie et notifications, vérifier Chromium et WebKit mobile, documenter les limites des simulés.
- Revue indépendante du diff et des invariants auth/gratuité ; corriger findings importants.
- Typecheck, lint, tests, build, sync iOS et archive. Vérifier bundle, signature et version. Upload une fois et relire Apple ; coordonner le device partagé avant installation.

Rollback : conserver archive 1.0(3) et profil Ad Hoc existant. Rétablir le bundle précédent sans effacer compte/Keychain si nécessaire. Aucun changement de facturation ni migration serveur dans cette branche.

Preuves : reports/commandeici-ios-ux-2026-10-03. Les tests simulés ne prouvent pas la réception APNs sur appareil verrouillé. La présence d'un build VALID ne prouve pas son installation TestFlight ; le dossier Apple 102984946627 reste suivi séparément.
