# Relance CommandeIci, 2 octobre 2026

Autorisation : relancer de façon fiable, conserver tous les parcours utilisateurs et construire iOS. La soumission aux stores aura lieu ensuite. Aucun envoi de prospection, achat, suppression de données existantes ou changement de compte Stripe.

Source : app Cloudflare Pages, backend tgtvkzmokypztdudwzne. Branche de reprise c81344b fusionnée avec origin/main dans un worktree isolé. Site isolé depuis 8fe6033 ; les worktrees précédents sont conservés.

Invariants : six étapes restaurateur, recherche Google ou saisie manuelle, import et édition du menu, couleurs, essai 30 jours sans carte, tableau de bord, commandes et personnalisation client, 14 langues et RTL. Les pages restaurant doivent exposer les mêmes informations publiques aux visiteurs et aux moteurs, sans faux avis ni données propriétaire.

## Livrables et validation

1. Inscription : confirmation explicite si aucune session ; profil créé seulement après authentification. Reprise après retour e-mail, erreurs visibles, aucune conservation du mot de passe. Tests Vitest avec session absente/présente, profil existant et erreur backend ; parcours navigateur sur backend simulé.
2. Publication : un RPC transactionnel lie profil, restaurant, menu, options, horaires et essai. Clé de création stable pour les reprises et contrôle du propriétaire côté serveur. Tests SQL transactionnels : session requise, rollback des erreurs, répétition sans doublon, isolation entre propriétaires.
3. SEO : HTML public restaurant/menu, canonical et données structurées ; démonstrations exclues de l'indexation. Worker conserve les scripts et l'application pour chaque visiteur. Sitemap des vrais restaurants actifs uniquement. Tests injection et panne backend. Le site conserve ses URL et corrige les affirmations non justifiées.
4. iOS : Capacitor, ressources embarquées, stockage de session Keychain, liens entrants filtrés, partage natif et reprise réseau. Compilation simulateur et archive iOS sans signature si l'identité/profil CommandeIci ne sont pas disponibles. Pas de soumission, ni promesse de push APNs avant configuration et essai réels.

## Risques et retour arrière

Auth, RPC et SEO sont sensibles : migration additive, aucune purge. Rollback web : redéployer l'artefact c81344b ; garder le RPC et les colonnes additives, puis désactiver les nouvelles routes si nécessaire. Restaurer l'ancien worker si l'HTML ou la disponibilité régressent. Le backend public ne doit jamais exposer l'e-mail, l'owner_id ou Stripe. Le code iOS n'affecte pas les parcours web.

Baseline : 52 tests passent et TypeScript passe. Dépendances : 17 vulnérabilités à examiner. Base locale historique en redémarrage (verrou PostgreSQL vide), ne pas la réinitialiser. Production : deux démos, zéro utilisateur réel, zéro abonnement ; confirmation e-mail activée, pas de secret Stripe. La reconnexion de l'ancien compte Stripe reste une dépendance distincte.

Critères de clôture : résultats frais du build, tests, lint, SQL et simulateur ; preuves séparées entre local, preview et production. Les conversions SEO seront mesurées dans GSC et le funnel, elles ne sont pas promises. Base GSC : 79 clics / 25 009 impressions sur les 28 jours complets précédents.
