# commandeici - SaaS Menu Restaurant

## Architecture
- **Site vitrine** : commandeici.com (Shopify, theme custom)
- **App SaaS** : app.commandeici.com (React, ce repo)
- Les deux partagent l'etat auth via un cookie cross-subdomain sur `.commandeici.com`

## Stack technique
- React 18.3 + TypeScript + Vite
- Tailwind CSS + shadcn-ui (composants dans `src/components/ui/`)
- Supabase : DB + Auth + Storage + Realtime + Edge Functions
- Framer Motion (animations), React Query (data fetching), Stripe (paiements)
- React Router (routing)

## Backend Supabase
- **Project** : rbqgsxhkccbhqdmdtxwr
- **URL** : https://rbqgsxhkccbhqdmdtxwr.supabase.co
- **Management API token** : voir .env ou CLAUDE.md local (pas dans le repo)
- **Edge functions deployees** : send-email, send-welcome-email, trial-reminders
- **Cron** : pg_cron + pg_net, trial-reminders daily a 3h UTC

## Theme Shopify (commandeici.com)
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
- `src/pages/AbonnementPage.tsx` : page post-trial expiration

### Data / Auth
- `src/lib/api.ts` : fonctions Supabase CRUD
- `src/integrations/supabase/client.ts` : client avec cookieStorage cross-domain
- `src/integrations/supabase/types.ts` : types auto-generes Supabase
- `src/types/database.ts` : interfaces TypeScript
- `src/hooks/useCrossDomainAuth.ts` : gestion cookie `commandeici_user`

### Fonctionnalites
- `src/components/auth/SubscriptionGate.tsx` : gate abonnement
- `src/services/referral.ts` : logique parrainage
- `src/components/dashboard/referral/ReferralSection.tsx` : UI parrainage
- `src/components/CustomOrderBuilder.tsx` : configurateur multi-etapes
- `src/context/CartContext.tsx` : panier (localStorage)
- `src/context/LanguageContext.tsx` : i18n 12 langues

## i18n
- 12 langues : fr/en/es/de/it/pt/nl/ar/zh/ja/ko/ru
- Fichiers : `src/i18n/*.json`
- **Format category_translations DB** : `{ lang: { catName: translation } }` (PAS l'inverse)

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

## Abonnement
- Plan : 19 euros/mois, essai 4 semaines (8 avec parrainage)
- SubscriptionGate wrappe le dashboard (check status + trial_end_date + bonus_weeks)
- Cron trial-reminders : emails J-7/J-3/J-1 + expire trials + desactive commandes

## Tables Supabase principales
- **restaurants** : slug, name, categories, primary_color, customization_config, referral_code, referred_by, bonus_weeks, trial_end_date, subscription_status, owner_id, stripe_*
- **menu_items** : restaurant_id, name, price, category, supplements, sauces, translations, variants
- **orders** : restaurant_id, order_number, customer_*, status, items, total, source, covers
- **restaurant_hours** : day_of_week, is_open, open_time, close_time
- **owners** : id (= auth.uid), email, phone
- **referrals** : referrer_id, referee_id, status, bonus_weeks_granted

## Demo
- **Antalya Kebab** : slug `moneteau-antalya-kebab`, id `c236aa92-cab3-4aa1-a337-7767770cb764`, referral `58379E`
- 10 categories, 35 items, CustomOrderBuilder 5 etapes

## Regles
- Ne JAMAIS modifier la DA sans demander
- PULL BEFORE PUSH sur theme Shopify (live gagne toujours)
- git pull avant modifications app
- Francais pour les interfaces, anglais pour le code
- Lovable : commit+push GitHub, sync manuellement dans Lovable
- Ne JAMAIS utiliser le tiret cadratin dans les textes
