# Mission: reconnect the historical CommandeIci Stripe account

Date: 2026-07-19
Owner and production approver: Augustin
Environment: CommandeIci production recovery branch and Supabase project `tgtvkzmokypztdudwzne`

## Outcome

Reconnect billing only to the historical Stripe account that owns the existing CommandeIci live product, prices, coupon, and webhook. Restore checkout without mixing CommandeIci revenue or customers with another business.

## Scope and authority

In scope: read-only account identification, verification of the historical live resources, secure secret transfer to Supabase, webhook endpoint verification or replacement in the same account, one Stripe test-mode checkout, one signed test webhook, and post-deployment negative tests.

Out of scope: connecting L'Observatoire Stripe, creating resources in another account, charging a real card, refunding, deleting customers or subscriptions, rotating a live Stripe key without evidence that it is required, or enabling an annual plan in the user interface.

Augustin explicitly approved reconnecting the old CommandeIci account. A real charge, destructive resource change, or account substitution requires a separate gate.

## Historical identifiers to prove

- Account namespace visible in the historical publishable key and resource IDs: `1TFfTR1URUOTUP9a`.
- Product: `prod_UE7raaxKgRXA7v` (`CommandeIci Pro`).
- Monthly price: `price_1TFfc91URUOTUP9a1YsBjdJq`, 29.99 EUR per month.
- Deprecated annual price: `price_1TFfcA1URUOTUP9ae4sv6vMA`; retained only for backward compatibility.
- Three-month coupon: `kZdytKw3`, reducing the first three monthly invoices to 1 EUR.
- Historical webhook endpoint: `we_1TFfhX1URUOTUP9aWQ4yflpM`.

## Acceptance criteria

1. Stripe `/v1/account` proves the credential belongs to the historical account namespace and not L'Observatoire.
2. Product, monthly price, coupon, and webhook are retrieved from that account with the expected live/test status and configuration.
3. Stripe secrets and resource IDs exist only in Supabase secret storage or the macOS Keychain, never in Git or logs.
4. The production checkout function returns a Stripe-hosted test checkout URL for an authenticated disposable restaurant without charging a real card.
5. A Stripe-signed test webhook reaches the production endpoint and produces the expected idempotent database transition.
6. Invalid signatures fail, cross-tenant metadata cannot activate another restaurant, and repeated events do not duplicate state or email side effects.
7. Existing non-payment production paths remain green after deployment.

## Risk and rollback

Risk class: Critical because the work touches payment identity, live credentials, subscription state, and external webhooks.

The current rollback state is fail-closed: Stripe secrets are absent from the new Supabase project. Before any deployment, record the current Supabase function versions and Stripe webhook configuration. Rollback consists of removing the newly added Stripe secrets from Supabase and restoring the prior Edge Function version; no customer or subscription deletion is authorized.

## Current discovery result

The local master environment contains only L'Observatoire Stripe credentials, and the CommandeIci GitHub repository has no Stripe Actions secrets. Those credentials are excluded. Browser history proves prior Stripe dashboard use but does not yet prove an authenticated session for the historical CommandeIci account. The historical credential itself has not yet been recovered.

## Paused state

Paused by Augustin on 2026-07-19 for later resumption. No Stripe secret was added to Supabase and no Stripe product, price, coupon, webhook, customer, or subscription was created, changed, or deleted during discovery.

The historical account is identified as `acct_1TFfTR1URUOTUP9a`. Opening its historical product URL redirects to Stripe login, and Chrome has no saved value prefilled in the email or password fields. Resume only after Augustin authenticates that account in the already opened Stripe tab. The first resumed action is a read-only account and resource identity check; secret deployment remains gated on that proof.
