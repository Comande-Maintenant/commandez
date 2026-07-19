# CommandeIci verified recovery

Date: 2026-07-19
Owner: Augustin
Implementation branch: `codex/commandeici-recovery-v2`
Working environment: isolated worktree `/Users/lestoilettesdeminette/commandez-codex-recovery`

## Mission

Restore the current CommandeIci product, including its existing restaurant workflows and 14 application locales, to an evidence-backed releasable state without deleting user data, sending bulk communication, or making an unverified production change.

## Business outcome

The application must be safe to demonstrate and operate across the existing public restaurant page, menu customization, order placement and tracking, restaurant dashboard, onboarding, subscriptions, and localization surfaces. Delivery means verified behavior against a finite checklist, not a claim of absolute defect freedom.

## Sources of truth

| Surface | Source of truth | Evidence on 2026-07-19 | Excluded legacy path |
|---|---|---|---|
| Application code | GitHub `Comande-Maintenant/commandez`, `origin/main` | fetched commit `38d7f48` | dirty older checkout at `/Users/lestoilettesdeminette/commandez` |
| Marketing and SEO | `August1nnnn/commandeici-site` and live `commandeici.com` | separate Astro repository and public HTTP response | retired Shopify theme |
| Database contract | versioned files in `supabase/migrations` plus generated TypeScript types | 48 local migration files at initial audit | prose migration counts in stale `CLAUDE.md` |
| Live data and deployed functions | remote Supabase project | must be inspected without printing credentials before deployment | local assumptions and historical notes |
| App deployment | Lovable custom domain and GitHub repository | live shell at `app.commandeici.com`; runtime health not yet proven | local `dist` directory |

The original checkout contains unrelated tracked and untracked prospecting data. It is preserved and will not be copied into, edited from, or committed by this recovery worktree.

## Scope

### Included

- authentication and owner authorization;
- tenant isolation for restaurants, menus, customization, orders, customers, images, and subscriptions;
- onboarding and menu import;
- restaurant public page and product customization;
- cart, order creation, order tracking, and order state transitions;
- dashboard views currently reachable in the product;
- notification and realtime behavior where testable;
- subscription checkout and webhook contract without charging a real customer during automated tests;
- all 14 application locales, RTL behavior, fallback behavior, interpolation, and key parity;
- responsive build, accessibility smoke checks, dependency audit, secret scan, and production configuration review;
- marketing/application contract mismatches that could materially misrepresent live behavior.

### Excluded unless separately gated

- sending prospecting or customer email;
- processing a real payment or refund;
- deleting or rewriting production customer data;
- destructive database migrations;
- credential rotation;
- changing brand design;
- resuming bulk prospecting workflows;
- claiming SEO or revenue impact before it can be measured.

## Non-negotiable invariants

1. A user cannot read or mutate another restaurant's private data.
2. Public restaurant and menu reads expose only data required to order.
3. An anonymous customer cannot alter prices, order totals, order status, or another customer's data.
4. A menu or customization edit affects only the intended restaurant and record.
5. Order totals are validated server-side and malformed or replayed requests fail safely.
6. Subscription and webhook state changes are authenticated, idempotent, and tenant-bound.
7. Every supported locale has the same required key set, valid interpolation, and a usable fallback; Arabic renders RTL.
8. No secret, prospect list, generated build noise, or unrelated local file enters the diff.
9. Production deployment requires a rollback artifact, fresh pre-deploy evidence, and a public-path canary.

## Observable acceptance criteria

- clean install succeeds from the lockfile;
- lint, unit/integration tests, TypeScript compilation, and production build exit zero;
- automated localization audit passes for all 14 locale files;
- automated tenant-isolation checks cover reads and mutations for the principal restaurant-scoped tables and storage paths;
- automated core-flow tests cover onboarding contract, menu CRUD isolation, configurable kebab item pricing, cart/order submission, server-side total rejection, dashboard order transitions, and subscription webhook idempotency;
- desktop and mobile browser smoke tests cover public menu, checkout/order, tracking, login, and dashboard navigation in French plus representative LTR and RTL locales;
- dependency and repository secret scans have no unresolved Critical or Important findings;
- the final diff receives separate specification and code-quality reviews with no unresolved Critical or Important findings;
- if production is deployed, the exact artifact is verified through public user paths and can be rolled back to the recorded previous version.

## Risk and rollback

Risk class: High.

Primary risks are cross-tenant data exposure, lost or duplicated orders, incorrect totals, broken auth/session cookies, invalid subscription state, localization regressions, and production drift between GitHub, Lovable, and Supabase.

Local rollback is branch deletion only after user confirmation. Application rollback is redeployment of the recorded previous commit/artifact. Database changes require an additive migration and a separately tested compensating migration; no destructive migration is permitted without a verified remote backup and explicit gate.

## Design approach

1. Preserve the existing product surface and first make its contracts observable with tests.
2. Reproduce defects before changing behavior.
3. Prefer tenant-bound APIs and server-side invariants over UI-only safeguards.
4. Fix one failure domain at a time with RED, GREEN, and focused review.
5. Use local fakes for email and payments, then one explicitly gated canary if production deployment is reached.
6. Keep the marketing site separate, but record and correct material contract mismatches before declaring the product releasable.

## Open decisions

None for baseline and local remediation. Production data mutation, real payment, credential rotation, and bulk communication remain separately gated by the exclusions above.
