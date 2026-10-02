# CommandeIci — dossier iOS avant soumission

État du 2 octobre 2026 : application compilée pour simulateur et appareil iOS. Aucune soumission à Apple ou Google. La relance web et la préparation iOS sont autorisées ; la soumission intervient ensuite, sur demande.

## Artefact et reproduction

- Identifiant : `com.commandeici.app`, nom : CommandeIci, version 1.0, build 1.
- Projet Xcode : `ios/App/App.xcodeproj`, schéma partagé `App`.
- Capacitor 8.5.2, ressources web embarquées ; aucun serveur web distant utilisé comme écran principal.
- Session et vérificateur PKCE dans le Keychain iOS, partage natif, clavier adapté, liens de confirmation filtrés et état réseau visible. Les commandes nécessitent une connexion ; aucune commande différée n'est annoncée.
- Archive locale : `ios/output/CommandeIci-unsigned.xcarchive`. Cette archive n'est pas signée et ne constitue pas un IPA distribuable.

```sh
npm ci
npm run ios:sync
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath ios/output/CommandeIci-unsigned.xcarchive \
  CODE_SIGNING_ALLOWED=NO archive
```

Avant compilation, configurer les variables publiques Vite de l'environnement actif dans un fichier local ignoré par Git. Aucun PAT ni secret Supabase/Stripe ne doit être embarqué. Pour une archive signée, connecter le compte Apple dans Xcode, vérifier l'identifiant dans Developer/App Store Connect, choisir l'équipe et utiliser un profil de distribution valide.

La tentative de signature du 2 octobre échoue avec « No Accounts » et « No profiles for com.commandeici.app ». Des certificats présents sur le Mac ne suffisent pas à établir un accès App Store Connect ni à provisionner cet identifiant.

## Proposition de fiche française

Nom : CommandeIci

Sous-titre : Votre restaurant, vos commandes

Description : Créez la page de commande de votre restaurant et gérez vos commandes depuis votre téléphone. Retrouvez votre établissement, importez ou saisissez votre menu, personnalisez votre page et partagez son lien ou son QR code. Vos clients consultent votre carte, choisissent leurs options et suivent leur commande. Le règlement client se fait au restaurant.

La fiche doit préciser le public restaurateur et montrer l'inscription, la carte et le tableau de bord. Les captures de simulateur conservées dans le rapport sont des preuves de test ; elles ne couvrent pas encore tous les formats exigés par App Store Connect. L'application n'affiche pas de statistiques de clients inventées.

URLs proposées : assistance `https://commandeici.com/contact`, confidentialité `https://commandeici.com/confidentialite`. Vérifier ces pages et leur contact effectif avant soumission.

## Compte de revue et achats

L'application iOS permet l'inscription et l'accès au service. Les écrans de souscription Stripe et les invitations à ajouter une carte sont remplacés dans iOS par une information de compte ; les parcours web sont conservés. Le paiement d'une commande de nourriture reste au restaurant. Aucune implémentation IAP ni notification APNs n'est déclarée livrée.

Créer plus tard un compte de revue dédié et confirmé, avec restaurant de test, menu et commandes identifiables, sans données client réelles. Ne pas envoyer les identifiants dans Git. Fournir à Apple le parcours d'accès et les limites de la démonstration. La conformité aux règles Apple reste soumise à leur revue ; ce dossier ne garantit pas l'acceptation.

## Confidentialité et suppression

Le manifeste `PrivacyInfo.xcprivacy` est présent. La session native reste dans le Keychain ; les logs de bridge sont désactivés. Les URL entrantes acceptent uniquement le domaine public de l'application ou les trois routes d'authentification du schéma `commandeici://auth`.

La suppression accessible dans les paramètres et le profil supprime l'utilisateur d'authentification, ferme ses pages restaurant et anonymise les commandes liées au compte. Les autres commandes et pièces commerciales sont conservées. Une souscription Stripe active doit être résiliée avant suppression. Les tests de suppression utilisent uniquement une base isolée avec rollback.

Les déclarations App Store Connect doivent être vérifiées séparément : identité/contact, identifiant utilisateur, commandes, contenus et photos de menus ; mesures de fréquentation et identifiant de session anonyme. Vérifier les données effectivement reçues par les services Google/Supabase et leur politique de conservation, ainsi que l'usage de localisation et caméra sur appareil réel. Le manifeste local ne remplace pas ces déclarations.

## Vérifications restant avant TestFlight puis soumission

1. Compte Apple connecté, accord développeur actif, identifiant et profils disponibles ; archive signée puis export et validation Apple.
2. Sur un vrai iPhone : inscription avec réception du lien, PKCE, reconnexion après arrêt/redémarrage, mot de passe oublié et suppression sur compte dédié.
3. Menu par photo/fichier, localisation si utilisée, partage, passage hors ligne/en ligne, commande et tableau de bord avec données de test.
4. Captures aux dimensions App Store, déclaration de confidentialité, classification d'âge et coordonnées d'assistance vérifiées.
5. TestFlight avec essai du parcours complet. Ajouter les notifications APNs seulement après configuration et essai sur appareil si elles deviennent une exigence du lancement.
6. Reconnecter le compte Stripe historique pour la monétisation web ; ne pas remplacer par le compte d'un autre projet.

Sources officielles consultées le 2 octobre 2026 : [Capacitor iOS](https://capacitorjs.com/docs/ios), [règles de revue Apple](https://developer.apple.com/app-store/review/guidelines/), [confidentialité App Store](https://developer.apple.com/app-store/app-privacy-details/), [suppression de compte](https://developer.apple.com/support/offering-account-deletion-in-your-app/).
