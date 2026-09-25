# CommandeIci recovery evidence

Date: 2026-07-19
Branch: `codex/commandeici-recovery-v2`
Production application: `https://app.commandeici.com`
Production Supabase project: `tgtvkzmokypztdudwzne`

## Delivered production surface

- Restored the full versioned database contract into a new Supabase project in Paris.
- Applied 50 migrations and deployed 15 Edge Functions.
- Restored authentication, custom SMTP, Resend delivery webhooks, Google Places, Anthropic validation, scheduled cleanup, and trial reminders.
- Moved the existing application artifact to Cloudflare Pages without changing the public application domain.
- Preserved all historical client-side routes with an SPA fallback.
- Added a fail-open Cloudflare metadata adapter because Supabase intentionally rewrites HTML Edge Function responses to plain text; normal browser traffic still goes directly to the same SPA assets.
- Kept the marketing site at `https://commandeici.com` in its separate repository and deployment.

## URL compatibility

The following production paths returned HTTP 200 after the DNS cutover:

`/`, `/inscription`, `/connexion`, `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe`, `/order`, `/suivi/:id`, `/admin/demo`, `/abonnement`, `/choisir-plan`, `/abonnement-confirme`, `/super-admin`, `/unsubscribe`, `/upload/:token`, `/profil`, `/signup`, `/demo`, and `/antalya-kebab-moneteau`.

The live JavaScript bundle references the new Supabase project and no longer references the deleted historical project. The previous DNS target is recorded in the Cloudflare DNS record comment for rollback.

## Verification evidence

- Clean local database reset: pass with all 50 migrations.
- Local RLS pgTAP suite: pass.
- Remote database lint at warning level: pass at deployment time.
- Remote RLS pgTAP suite: pass after migration deployment.
- Unit and contract tests: 52 passed across 5 files.
- TypeScript compilation: pass.
- Deno type-check: all 15 Edge Functions pass.
- ESLint: zero errors; 292 pre-existing warnings remain tracked as non-blocking technical debt.
- Dependency audit: zero known vulnerabilities.
- Production build: pass using the new Supabase endpoint.
- Browser verification: 8 desktop/mobile flows passed on `https://app.commandeici.com`, including catalogue, Arabic RTL, configurable kebab order, and dashboard.
- Auth email canary: delivered through the verified `commandeici.com` Resend domain; temporary user removed.
- Transactional email canary: delivered through `send-email`.
- Resend signed webhook: event persisted in `prospection_events`.
- Google Places canary: authenticated request returned a result; temporary admin user removed.
- Scheduled function canary: authorized invocation passed; unauthorized invocation returned 403; no subscription was mutated.
- Public restaurant API: demo restaurant readable through the intended RPC; direct anonymous access to private restaurant rows denied.

## Security controls

- Secrets are stored in Supabase secret storage, Supabase Vault, or the macOS Keychain and are not committed.
- Tenant policies were exercised against the remote database.
- Scheduled functions use a Vault-backed authorization secret.
- Resend webhooks require signed Svix payloads.
- Restaurant Open Graph output escapes untrusted text and permits only HTTP(S) image URLs.
- Social crawlers receive that metadata as HTML on the existing restaurant URL through a fail-open Cloudflare adapter; reserved application routes and normal browser traffic are not intercepted.
- Stripe webhook price mapping uses environment-managed price identifiers rather than assuming the historical hard-coded identifiers.
- A Supabase CLI telemetry trace was found to contain a server key during the final scan. The key was revoked as compromised, a replacement was created and stored in the macOS Keychain, the trace was removed, and the revoked key is absent from the active key inventory.

## Explicit blocker

Stripe checkout is intentionally not declared operational. No CommandeIci Stripe secret or webhook signing secret could be recovered, and the available local Stripe account belongs to another product. The historical CommandeIci price identifiers are absent from that account. Connecting it silently would risk mixing revenue, customers, and webhook state between products.

Completion of billing requires one explicit account decision, followed by creation or verification of the monthly and annual prices, webhook registration, secret deployment, a test-mode checkout, and a signed webhook canary. Every other restored production surface above has current verification evidence.
