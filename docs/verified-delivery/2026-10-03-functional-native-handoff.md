# CommandeIci functional and native handoff, 3 October 2026

## Ownership and release boundary

Functional source: branch `codex/commandeici-functional-20261003`, based on `origin/main` c5c0279. The functional coordinator owns backend, order reliability, Google/menu import and QR integration. The separate iOS branch `codex/commandeici-ios-free-20261003` owns Apple signing, archive and TestFlight. Each owner edits only its own worktree. Shared client deltas are exchanged by commit after review.

Current business rule: access is free without a card, trial expiry or automatic billing transition. iOS wording is “gratuit jusqu’en 2027”, with no programmed cutoff. RevenueCat is integrated for future use; purchases remain disabled. Backend migration 120 removes application expiry without contacting Stripe or deleting billing history. Native/client source remains `32ad9ccc13aeb2fa0e5b4e876f3b5bacc1ee656d`. The subsequent server-only delta protects legacy Stripe/Shopify callbacks, prospect conversion, promotions and financial email templates. It does not alter the archived native application. No backend/web deployment has occurred at this preparation checkpoint; the exact native checkout auth redirect was appended separately and verified.

## Backend integration order

Apply the tracked migrations in timestamp order, preserving already applied migration history. Important interfaces:

- 110: real orders require confirmed authentication; `place_order_once(UUID, JSONB)` implements request idempotency and prices are recalculated server side.
- 120: current free access, null trial end dates, free onboarding; matching Edge handlers short circuit checkout, portal and trial reminders before external calls.
- 130: collision-safe name/city slug publication, including overlapping candidates under concurrency.
- 140–150: POS owner authorization, canonical configurable pricing and normalization independent of option order.
- 160: durable UID bans without assigning a ban to another observed account; historical contact restrictions remain. Account deletion permits FK anonymization without restoring the deleted UID.
- 170: restaurant time zone, overnight hours and DST; direct legacy order RPC permission is revoked in favor of the idempotent wrapper.
- 180: private capability-based device installation and APNs outbox; repeated owner sync renews the device lease without cancelling pending or processing notifications.

Push install bootstrap must precede token registration. Logout and account deletion must await device revocation before clearing authentication. The native factory must ignore late callbacks from an earlier account. Private device and outbox tables are not readable through anonymous/customer REST.

## Deployment conditions

No production deployment is performed by this handoff. Before deploying, capture current app version, migration ledger and a verified backend backup. Deploy compatible schema/functions before distributing a native build using the new RPCs. Migration 170 revokes the legacy direct order RPC: coordinate web rollout and old-client refresh before that revocation, or old cached clients will receive a permission error. Do not claim zero-downtime rollout without verifying this transition. Coordinate the free app production signal with the separate website publisher.

APNs additionally requires the minimal private provider configuration and Vault worker configuration, `pg_net`/`pg_cron` availability, Edge worker deployment and a real authorized device canary. The worker uses a separate constant-time cron secret check; JWT gateway verification is disabled only for this worker. An empty worker configuration remains inert. Never commit provider keys, runtime credentials or Vault values.

Recovery is coordinated through the private release driver. A pre-publication SQL recovery was rehearsed against a local copy: 26 original functions and ACLs, 26 table owners/ACLs/RLS flags, and both complete demo records matched the captured live state. The SQL acquires locks and refuses any current account, owner, order, subscription or restaurant customer, or any restaurant outside the two exact demos. A negative local test preserved its account and refused recovery before mutations. Private new tables and order data are never dropped. The driver persistently closes this recovery window before public web/TestFlight distribution; that closure was tested without external calls. After publication, keep the compatible client/RPC contracts and use targeted forward fixes or disable APNs dispatch. Never restore the old web artifact alone after migration170, delete received orders, or re-enable trial billing.

## Verification boundaries

Reproducible load scripts are in `scripts/qa/`. They use fictitious owners/customers and an isolated local PostgreSQL instance. HTTP and Realtime scripts target fixed localhost addresses. No public merchant, production slug, real order or indexable test page is created.

The local PostgreSQL test produced 100 unique slugs and 100 orders for 100 concurrent merchants with zero failed transactions; replay did not create orders or increment totals twice. HTTP additionally passed 100 requests and their retries. These results prove those local paths. They do not certify production throughput or 100 simultaneous websocket deliveries.

The local Realtime reception experiment did not pass: the shared Docker VM exhausted memory. A separate isolated runner choice was requested; no other project containers were stopped and global Docker resources were not changed. Do not describe subscriptions alone as delivery success.

Google Places lookup/import is distinct from linking a merchant’s Google Business account. OAuth account linking is not verified/configured. Actual Google/OCR provider success, merchant email confirmation and physical-device APNs reception still require explicit canaries. QR links and local exports can be verified without writing production.

Native simulator/XCTest archive evidence belongs to the iOS owner. Local React/browser tests must not be presented as a signed iOS build or a delivered TestFlight release. TestFlight distribution waits for compatible production backend readiness.

## Final assembled evidence

Native history integrated through `f3caf41` (Apple Release signing configuration and identical opaque icon pixels). Functional core is present via iOS integration `56700c3`; root original core `b9d943c` has equivalent functional changes. No duplicated native import commit is required.

Fresh local checks at 04:54–04:55 Europe/Paris on the assembled client:

- `npm test -- --reporter=dot`: 305 tests in 48 files passed.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, 294 warnings, no errors.
- `npm run build`: exit 0; large bundle warnings remain.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4282 npm run test:e2e`: 42 desktop/mobile cases passed. Auth/REST writes are intercepted in browser tests.
- Three affected SQL suites independently rerun on the isolated container: customer account bans, account deletion and APNs outbox passed. The earlier core run covered all 12 SQL suites; no production fixtures were written.
- Push factory/lifecycle regression set: 33 tests passed, including A→B→A while cleanup is pending and A→B→C while bootstrap is pending.

Production auth configuration originally read at 04:48:52 allowed inscription/profil/reset callbacks but omitted checkout. The coordinator subsequently appended the exact `commandeici://auth/order` callback and reread the live configuration: every previous allowlist entry and site URL was preserved. Signup is enabled, email confirmation required, Google OAuth disabled. Custom SMTP is configured at smtp.resend.com:465, with the CommandeIci sender and a configured password; its value was not exposed. Configuration is not a successful email/physical-device authentication canary. Endpoint reference: https://supabase.com/docs/reference/api/v1-get-auth-service-config.

Detailed logs and independent reviews are retained outside Git in `~/reports/commandeici-functional-2026-10-03/`; reports contain no provider private keys or authentication tokens. Signed native build and TestFlight evidence are owned and delivered by the iOS thread.

Navigation regression review reproduced subscription recreation under a real MemoryRouter. Both native lifecycles now keep their OS/auth listeners stable and use the current router callback through a ref. Ordinary page navigation no longer revokes the current push installation or replays the launch URL.

Independent review closed all identified Critical/Important findings at 04:55: native callback/resume/SDK/factory/lifecycle/widget set 43/43 passed, including a real router navigation reproduction. Minor remaining findings are 294 lint warnings and large generated web chunks. None was hidden by disabling a check. The checkout native redirect configuration prerequisite is now satisfied; actual device/email canaries remain separate.

Server-only final checks: 335 tests in 50 files passed, typecheck passed, lint reported zero errors and the existing294warnings, and all five changed Edge handlers passed Deno check. An independent server review found no new Critical/Important findings. Auth, HMAC and service-role checks remain enforced on mutation paths; Stripe free-mode acknowledgement is intentionally public and has no DB/provider/email side effects. No production fixtures were created.

## Production checkpoint and final demo correction

Backend/web production is now deployed and verified. PR3 merged as488aaa52, server guards436e2dd, client JavaScript32ad9cc. Cloudflare production5e281cac-559d-4d16-89d5-78882620cf1a serves a root HTML checksum identical to the reviewed dist. Six public HTTP checks and16 desktop/mobile browser paths passed with mutation requests blocked. Demo pages are noindex; missing merchants return404; the sitemap contains no real merchants because none exist in this environment.

Migrations110–180 and all eight ledger entries were applied in one transaction after checking the exact predecessor and26 function definitions. Both existing demos are free with NULL trial end dates. Legacy direct ordering is unavailable to anon/authenticated; idempotency and device/outbox tables are private. Eleven selected Edge handlers were deployed; server secret propagation subsequently updated function runtime versions.

APNs server configuration is active. Private key validation passed. The actual worker rejected an invalid secret401 and signed its provider token before claiming0 jobs200. Five secret hashes match, Vault authorization is present and the one-minute cron has succeeded. No physical-device reception is claimed. Fresh counts remain0 accounts/owners/orders/real restaurants/devices/outbox, with only the two existing demos.

SMTP authentication using the existing validated credential passed235/NOOP250, and Resend reported commandeici.com verified. A targeted password configuration PATCH200 preserved all other auth/SMTP fields. The configuration read returns an opaque password representation, so this is not an end-to-end email delivery proof. No email or production signup was created. Auth currently permits60 emails per hour; do not claim100 simultaneous production signups from the local SQL load test.

The persistent recovery driver was closed before public web publication. Its pre-publication recovery must no longer be used. Keep compatible RPC/client contracts and preserve received data when applying forward fixes or stopping push dispatch.

Independent live review identified a minor demo mismatch: server HTML for /demo used the legacy Paris demo, while the client uses Antalya Kebab in Monéteau. This follow-up changes only the server lookup to match the existing client demo constant, preserving the canonical helper and all real merchant lookups. Its regression failed for the expected identity mismatch before the fix; both focused tests then passed. Full suite337 tests/51 files, TypeScript, Deno and affected-file lint passed. No client JavaScript/iOS update or production fixture is needed for this correction.

The separate website publisher reports its free site release verified. Native build2 remains with the iOS owner for branded launch-screen/signing/TestFlight checks; simulator WebKit system crashes are being investigated independently. Real signup/email, Google/OCR provider success, Google Business account linking, physical APNs reception and100 concurrent Realtime delivery remain outside these production checks.

## Follow-up: native handoff and dependency audit

Main8307d0ddcc8ab4f93e5235b0700062e943695770 integrates the native owner's final launch branding and clipboard tests. Apple build1.0(2) is VALID/IN_BETA_TESTING, the internal group contains only build2, and Augustin is INVITED. The IPA uses native sourcef639960 and unchanged JavaScript32ad9cc. No physical signup/email, RevenueCat authenticated session or locked-screen push reception is claimed. Simulator WebKit SIGBUS failures remain documented alongside the three passing native paths. Final native evidence: reports/commandeici-ios-free-2026-10-03/LIVRAISON.md outside Git.

The native publication callback supplies `none` to `completeOnboarding`. The server creates `free` status and NULL trial deadlines irrespective of the requested plan; its historical `monthly` plan label does not initiate payment. Signup publication text is already free in all14 locales. No edit of NativeSubscription, PricingCards or OnboardingSuccess is required.

Shared tooling follow-up pins typescript-eslint8.48.0, the first stable release that replaces fast-glob with tinyglobby. Only the direct lint dependency and its lockfile subtree changed; Tailwind3, design, runtime SDKs and application source are unchanged. Locked npm ci succeeded, all337 unit tests passed, TypeScript/build passed, and lint retained0 errors/294 existing warnings. All100 generated dist files match the prior artifact byte for byte. No web/backend deploy or TestFlight rebuild is needed. Independent read-only review found no blocking issue.

The audit decreased from12 to6 high findings, with0 critical; omit=dev still reports5 high through the Tailwind peer chain. The remaining alerts originate from braces3.0.3, for which no patched version is published. They are retained and reported; no forced Tailwind4 migration, advisory suppression or manual third-party patch was used. Primary sources: [typescript-eslint8.48.0 release](https://github.com/typescript-eslint/typescript-eslint/releases/tag/v8.48.0), [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Restore the preceding package manifest/lock and run npm ci to reverse this tooling-only change; preserve the delivered application and all production data.
