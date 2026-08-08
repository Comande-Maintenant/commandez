# commandeici - SaaS Menu Restaurant

## Architecture
- **Site vitrine** : commandeici.com (Cloudflare Pages, depot separe `August1nnnn/commandeici-site`)
- **App SaaS** : app.commandeici.com (React, ce repo, Cloudflare Pages `commandeici-app`)
- Les deux partagent l'etat auth via un cookie cross-subdomain sur `.commandeici.com`

## Stack technique
- React 18.3 + TypeScript + Vite
- Tailwind CSS + shadcn-ui (composants dans `src/components/ui/`)
- Supabase : DB + Auth + Storage + Realtime + Edge Functions
- Framer Motion (animations), React Query (data fetching)
- React Router (routing)
- Stripe Billing (paiements recurrents via Edge Functions)

## Backend Supabase
- **Projet actif** : `tgtvkzmokypztdudwzne` (`CommandeIci`, region Paris `eu-west-3`)
- **Projet historique** : supprime ; ne plus utiliser son identifiant ni son URL
- **Configuration active** : variables d'environnement locales/de déploiement, jamais dans le repo
- **Secrets** : gestionnaire de secrets Supabase et environnement CI uniquement
- **Edge functions deployees** : 15 fonctions dans `supabase/functions/`, inventaire pilote par `supabase/config.toml`
- **Cron** : nettoyage demo toutes les 4h et trial-reminders chaque jour a 3h UTC, secrets chiffres dans Vault
- **Secrets** : gestionnaire Supabase + trousseau macOS ; aucun secret dans Git

## Theme Shopify historique (ne plus deployer sur commandeici.com)
- **Store** : idwzsh-11.myshopify.com
- **Theme ID** : 196602659155
- **API** : Shopify Admin API 2025-01, OAuth Client Credentials
- **Dossier local** : `/Users/lestoilettesdeminette/Commande ICI ALL/theme shopify live Commande ici/theme_live_pull/`
- **Credentials** : voir .env ou CLAUDE.md local (pas dans le repo)
- **PULL BEFORE PUSH** : toujours telecharger l'asset live AVANT de modifier

### Sections homepage (ordre)
1. hero (publique)
2. proof-visual (publique)
3. problem (publique)
4. solution (publique)
5. how-it-works (publique)
6. benefits (publique)
7. comparison (publique)
8. **gate** (masque si connecte)
9. dashboard-preview (`.ci-gated`)
10. client-database (`.ci-gated`)
11. advanced-features (`.ci-gated`)
12. testimonials-detailed (`.ci-gated`)
13. pricing
14. testimonials
15. faq
16. cta-final

### Design system CSS
- Palette : `--primary:#10B981`, `--dark:#111827`, `--muted:#6B7280`
- Classes : `.ci-w` (container), `.ci-sec` (section), `.ci-h2`, `.ci-g3`, `.ci-card`, `.ci-btn-primary`
- Mobile-first : breakpoint 767px

## Fichiers cles app

### Pages
- `src/pages/RestaurantPage.tsx` : menu publique (`/:slug`)
- `src/pages/AdminPage.tsx` : dashboard admin (`/admin/:slug`)
- `src/pages/InscriptionPage.tsx` : onboarding + capture `?ref=CODE`
- `src/pages/ChoisirPlanPage.tsx` : selection plan + redirect checkout Stripe (`/choisir-plan`)
- `src/pages/AbonnementConfirmePage.tsx` : polling post-checkout (`/abonnement-confirme`)
- `src/pages/AbonnementPage.tsx` : page reactivation post-expiration (`/abonnement`)

### Data / Auth
- `src/lib/api.ts` : fonctions Supabase CRUD
- `src/integrations/supabase/client.ts` : client avec cookieStorage cross-domain
- `src/integrations/supabase/types.ts` : types auto-generes Supabase
- `src/types/database.ts` : interfaces TypeScript
- `src/hooks/useCrossDomainAuth.ts` : gestion cookie `commandeici_user`

### Fonctionnalites
- `src/components/auth/SubscriptionGate.tsx` : gate abonnement (dual table: subscriptions + legacy restaurants)
- `src/services/shopify-checkout.ts` : integration Shopify historique, non utilisee par le parcours actif
- `src/services/referral.ts` : logique parrainage
- `src/components/dashboard/referral/ReferralSection.tsx` : UI parrainage
- `src/components/CustomOrderBuilder.tsx` : configurateur multi-etapes
- `src/context/CartContext.tsx` : panier (localStorage)
- `src/context/LanguageContext.tsx` : i18n 14 langues

## i18n
- 14 langues : fr/en/es/de/it/pt/nl/ar/zh/ja/ko/ru/tr/vi
- **1399 cles** par fichier, parite parfaite entre les 14 langues (mars 2026)
- Fichiers : `src/i18n/*.json`
- Hook : `useLanguage()` -> `t("key")`, `tMenu(item)`, `tCategory(cat)`, `language`, `isRTL`
- Placeholders : `{value}`, `{count}`, `{date}` etc. remplaces via `.replace("{key}", val)`
- Lazy import : seul fr.json charge statiquement, autres langues en dynamic import
- Fallback : cle absente -> retour au francais
- **Format category_translations DB** : `{ lang: { catName: translation } }` (PAS l'inverse)
- **Theme Shopify** : liens internes avec `{{ routes.root_url }}` pour persistance langue entre pages

## Cross-domain Auth
- Cookie `commandeici_user=1` set sur `domain=.commandeici.com` quand connecte
- Seulement si consent RGPD accepte (`commandeici_consent=accepted`)
- Theme Shopify check ce cookie dans `initGate()` pour toggle sections gatees
- Client Supabase utilise un cookie storage adapter custom (storageKey: `commandeici_auth`)

## Parrainage
- Colonnes restaurants : referral_code (unique, auto-gen 6 chars), referred_by, bonus_weeks, trial_end_date, subscription_status
- Table referrals : referrer_id, referee_id, status (pending/completed/expired), bonus_weeks_granted
- Inscription avec `?ref=CODE` : filleul 8 semaines, parrain +4 semaines
- Trigger DB : auto-genere code + set trial 4 semaines a l'INSERT

## Abonnement (paywall Stripe)
- **Plan vendu dans l'interface** : mensuel 29.99 EUR/mois
- **Offre de lancement** : 1 EUR/mois pendant 3 mois via coupon Stripe
- **Trial applicatif** : 30 jours sans CB avant passage au checkout
- **Checkout** : Stripe Checkout cree par `stripe-checkout`, metadata restaurant et plan cote serveur
- **Lifecycle** : pending_payment -> trial -> active -> past_due/cancelled/expired
- **Webhooks actifs** : checkout, abonnement et factures traites par `stripe-webhooks`
- **Shopify** : colonnes et fonction webhook conservees uniquement pour compatibilite historique
- **Codes promo** : LANCEMENT (30j gratuits), BIENVENUE (+14j trial), MOITIE (50% 1er cycle)
- **SubscriptionGate** : check table subscriptions, fallback restaurants (legacy), banniere trial, ecran past_due
- **Cron trial-reminders** : daily 3AM UTC, J+7, J+21, J+28, expiration J+30 et relances post-expiration

## Tables Supabase principales
- **restaurants** : slug, name, categories, primary_color, customization_config, referral_code, referred_by, bonus_weeks, trial_end_date, subscription_status, owner_id
- **subscriptions** : restaurant_id (UNIQUE), status, plan, trial_start/end, stripe_customer/subscription/session_id, current_period_start/end, bonus_days, promo_code_used ; colonnes Shopify legacy conservees
- **promo_codes** : code (UNIQUE), type, value, max_uses, current_uses, valid_from/until, active
- **promo_code_uses** : promo_code_id, restaurant_id, UNIQUE(promo_code_id, restaurant_id)
- **menu_items** : restaurant_id, name, price, category, supplements, sauces, translations, variants
- **orders** : restaurant_id, order_number, customer_*, status, items, total, source, covers
- **restaurant_hours** : day_of_week, is_open, open_time, close_time
- **owners** : id (= auth.uid), email, phone
- **referrals** : referrer_id, referee_id, status, bonus_weeks_granted

## Demo
- **Antalya Kebab** : slug `moneteau-antalya-kebab`, id `c236aa92-cab3-4aa1-a337-7767770cb764`, referral `58379E`
- 10 categories, 35 items, CustomOrderBuilder 5 etapes

## Migrations Supabase (CLI)

### Setup (deja fait)
Le remote a une table `supabase_migrations.schema_migrations` qui track les migrations appliquees.
Lier explicitement le nouveau projet avec `npx supabase link --project-ref "$SUPABASE_PROJECT_REF"` après validation du gate de déploiement.

### Deployer une nouvelle migration
1. Creer le fichier : `supabase/migrations/NNN_description.sql`
2. Dry-run : `npx supabase db push --dry-run`
3. Push : `npx supabase db push`

### Executer du SQL ad-hoc sur le remote (sans migration)
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT 1"}'
```

### Notes
- Les fichiers de migration doivent utiliser `IF NOT EXISTS` / `IF EXISTS` pour etre idempotents
- La table de suivi est `supabase_migrations.schema_migrations` (version + name)
- 50 migrations enregistrees et appliquees au projet actif au 19 juillet 2026

## Regles
- Ne JAMAIS modifier la DA sans demander
- PULL BEFORE PUSH sur theme Shopify (live gagne toujours)
- git pull avant modifications app
- Francais pour les interfaces, anglais pour le code
- App : build Vite puis deploiement Cloudflare Pages `commandeici-app`; conserver `app.commandeici.com`
- Ne JAMAIS utiliser le tiret cadratin (em dash, en dash) dans les textes

## REGLE COPYWRITING - ZERO STYLE "IA"

Tout texte visible par un utilisateur (titres, boutons, descriptions, emails,
notifications, pages, blog, SEO, etc.) doit etre ecrit comme un humain parle.

INTERDITS : "innovant", "solution", "optimisez", "boostez", "transformez",
"plateforme", "digital", "revolutionnaire", "excellence", "potentiel",
"tout-en-un", "au coeur de", "des aujourd'hui", "n'attendez plus",
"passez a la vitesse superieure", "incontournable", "game-changer",
"disruptif", "levier de croissance", "synergie", "ecosysteme", "holistique",
"seamless", "sans couture", "state-of-the-art", "cutting-edge", "best-in-class",
"scalable", "robust" (dans du texte public), et tout buzzword corporate/IA.

TEST : si un restaurateur de kebab trouverait la phrase bizarre dite a l'oral,
c'est que c'est mal ecrit. Reecrire.

Style : concret, court, specifique, terre-a-terre, honnete.
"Moins de telephone. Plus de cuisine." > "Optimisez la gestion de vos commandes."
