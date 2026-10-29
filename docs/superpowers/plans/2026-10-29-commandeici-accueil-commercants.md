# CommandeIci — accueil des nouveaux commerçants : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (exécution native décidée par Augustin : « c'est parti », « au max »). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Que chaque nouveau commerçant et client se sente chez lui : textes français corrects, e-mails d'inscription en français, moyens de paiement respectés, parcours d'inscription vérifié, relances humaines prêtes, sans risque inutile.

**Architecture:** App web React/Vite (`commandez`, branche `claude/commandeici-onboarding-20261029` depuis `origin/main` bc7dc25 = production `f308ad80`). Modèles d'e-mails Supabase Auth versionnés dans le dépôt et appliqués par l'API Management après sauvegarde. Aucun changement de schéma, aucune RPC modifiée, aucun build iOS.

**Tech Stack:** React 18 + TypeScript, Vitest + Testing Library, Playwright, Supabase Auth (projet `tgtvkzmokypztdudwzne`), Resend SMTP, Cloudflare Pages `commandeici-app` (wrangler 4.147.0).

**Spec:** demande d'Augustin du 29/10/2026 (conversation) + constats du point CommandeIci du jour (`~/reports/commandeici-relances-2026-10-29/BROUILLONS.md`).

## Global Constraints

- Français parfaitement accentué dans tout texte visible ; slugs/clés restent ASCII.
- Aucun tiret cadratin ni demi-cadratin dans les textes ; zéro style « IA » (règles `CLAUDE.md`).
- Ne pas modifier la DA (couleurs, mise en page, composants visuels).
- Correction d'accents : seuls les diacritiques changent ; `fold(nouveau) == fold(ancien)` pour chaque chaîne.
- Paiement : la page commande ne propose que les moyens acceptés par le commerce (`payment_methods`), défaut = premier accepté ; liste vide ou absente = comportement actuel (carte + espèces).
- E-mails Auth : conserver exactement `{{ .ConfirmationURL }}` / `{{ .Token }}` et les redirections natives `commandeici://auth/...`.
- Aucun e-mail externe sans `GO ENVOI EXTERNE à <adresse>` par destinataire.
- Déploiement : arbre testé == arbre déployé ; retour arrière Pages `f308ad80-015d-4f88-a920-0d8781ff2f4f`.

## Review Focus

1. Commerce sans `payment_methods` (null / []) : les deux options restent proposées, la commande passe.
2. Commerce `['cash']` uniquement : seul « Espèces » s'affiche et la commande part en `cash`.
3. Mode borne (kiosk) avec `defaultPayment=counter` : ne doit pas régresser.
4. Lien de confirmation d'e-mail depuis l'app iOS (redirection `commandeici://auth/inscription`) : le modèle ne doit pas casser l'URL.
5. Textes à placeholders (`{count}`, `{minutes}`) : les accents ne doivent jamais toucher aux placeholders.

---

### Task 1: Moyens de paiement respectés sur la page commande

**Files:** Modify `src/pages/OrderPage.tsx` ; Create `src/lib/payment-options.ts` ; Test `src/test/payment-options.test.ts`

**Interfaces:** Produces `orderPaymentOptions(accepted: string[] | null | undefined): Array<'card' | 'cash'>` (ordre `card`, `cash`, filtré ; vide/absent ou aucun recoupement -> `['card','cash']`).

- [ ] Test : `['cash']` -> `['cash']` ; `null` -> `['card','cash']` ; `[]` -> `['card','cash']` ; `['ticket_restaurant']` -> `['card','cash']` ; `['cash','card']` -> `['card','cash']`. Lancer, voir l'échec.
- [ ] Implémenter, brancher dans `OrderPage` : options filtrées après `fetchRestaurantById`, sélection ramenée au premier choix si l'actuel n'est plus proposé ; kiosk `counter` conservé si `cash` est proposé.
- [ ] Tests + typecheck verts. Commit `fix(order): only offer payment methods the commerce accepts`.

### Task 2: Accents du français de l'app

**Files:** Modify `src/i18n/fr.json` (+ chaînes françaises codées en dur détectées dans `src/`) ; Create `src/test/fr-accents.test.ts`

- [ ] Test garde-fou : aucune chaîne fr ne contient les formes fautives connues (liste figée : Creer, Creez, Deja, Termine, Precedent, Recapitulatif, Numero, telephone, Quantite, caracteres, Especes, bientot, ajoutér, récupéréz, etc.) ; lancer, voir l'échec.
- [ ] Corriger les 270 chaînes signalées + sur-accents, en contexte (a/à, des/dès, ferme/fermé jugés à la lecture).
- [ ] Vérificateur : pour chaque clé, `fold(nouveau) == fold(ancien)` et placeholders identiques ; aucune clé ajoutée/retirée.
- [ ] Tests verts. Commit `fix(i18n): restore French accents`.

### Task 3: E-mails d'authentification en français

**Files:** Create `supabase/templates/auth/{confirmation,recovery,magic_link,email_change,reauthentication}.html`, `scripts/apply_auth_email_templates.py`

- [ ] Sauvegarde `auth-config-before.json` (fait, 0600). Rédiger les modèles : courts, chaleureux, signés CommandeIci, une ligne anglaise en bas, variables Supabase intactes.
- [ ] Script : `--dry-run` affiche le diff ; `--apply` PATCH uniquement les clés `mailer_subjects_*`/`mailer_templates_*_content` concernées puis relit et compare octet par octet.
- [ ] Appliquer, relire. Retour arrière = repatcher les valeurs de la sauvegarde.

### Task 4: Parcours d'inscription vérifié au premier plan

- [ ] Playwright (Chromium + WebKit mobile, premier plan) sur `/inscription` local : étape 1 visible < 2 s, aucune erreur console. Si lenteur réelle : diagnostiquer avant toute correction.

### Task 5: Vérification, déploiement, audit

- [ ] Suites complètes (vitest, typecheck, lint, build, Playwright ciblés) vs référence.
- [ ] PR GitHub, fusion `main`, build, déploiement Pages depuis l'arbre testé, vérification live (bundle servi, page commande Citrus « Espèces » seul, inscription accentuée).
- [ ] Revue indépendante (sous-agent) du diff complet ; superpowers:verification-before-completion.
- [ ] Journal : rapport `~/reports/commandeici-onboarding-2026-10-29/`, note Obsidian `Projets/Commande-Ici`, mémoire, message bus Codex.

### Task 6: Relances commerçants (bloquée sur GO par adresse)

- [ ] Envoyer uniquement aux adresses ayant reçu `GO ENVOI EXTERNE à <adresse>`, via Resend depuis `contact@commandeici.com`, puis relire le statut `delivered`.

### Task 7: Stripe Connect pour les commerçants (réflexion seulement, en dernier)

- [ ] Note de conception inspirée d'Entre Elles (Connect, le commerçant encaisse, CommandeIci ne touche rien) : options Standard/Express, flux, risques, coûts, questions pour Augustin. Aucun code, aucun compte Stripe créé.

## Hors périmètre (signalé)

- App iOS 1.0.2 publiée : mêmes défauts paiement/accents ; nécessite un build Apple distinct.
- E-mail de bienvenue transactionnel automatique : nouvelle automatisation d'envoi, à décider explicitement.
