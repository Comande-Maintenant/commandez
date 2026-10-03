# Local functional verification

These scripts write **test fixtures only**. Never point them at production. The SQL load test uses the dedicated Docker container `commandeici-functional-db-20261003`; HTTP targets are fixed to `127.0.0.1:55361`, and Realtime to `127.0.0.1:55362`.

Use the project lockfile (`npm ci`). Restore the declared PostgreSQL/Supabase schema into an isolated database, retaining ACLs and RLS. A dump restored without ACLs can silently inherit Supabase's broad default grants; compare with the least-privilege grants in `20260719153000_restore_backend_contract.sql`. Apply migrations in order, with **one migration/test operator at a time**. Fixtures in different suites may share identifiers and DDL locks.

Run each `supabase/tests/*.sql` with `psql -v ON_ERROR_STOP=1`. Check both exit status and TAP output: `not ok` and `Looks like` are failures even when psql exits zero. Every suite rolls back. Run `scripts/qa/order-push.sql` separately; it checks the APNs database contract without configuring a provider or sending notifications.

`scripts/tests/canonical_demo.sql` verifies the canonical owner/public demo alias and ordinary tenant lookups in a rollback transaction. `scripts/qa/order-push-continuation.sql` verifies initial dispatch coalescing, immediate worker continuation, roles and durable retries with a fake HTTP function. That test requires the isolated container, no installed `net.http_post`, and `PGOPTIONS='-c commandeici.qa_isolated=true'`; its temporary Vault/view/table replacements roll back. It neither inserts orders/devices nor sends an external request. Apply migrations 190 and 200 locally before the GREEN run.

Load sequence:

1. Apply `scale-seed.sql` to the isolated container.
2. Run pgbench in that container with `-c 100 -j 8 -t 1 -f scale-onboarding.sql` (copy the script first).
3. Apply `scale-catalog.sql`.
4. Run pgbench with the same concurrency and `scale-orders.sql`, then replay it. Verify 100 unique restaurant slugs, 100 orders for these first request keys, and unchanged customer totals on replay.
5. Export the catalogue with `SELECT jsonb_agg(jsonb_build_object('restaurant_id',r.id,'client_id',r.client_id,'menu_id',m.id,'name',m.name)) FROM qa_scale_catalog r JOIN menu_items m ON m.restaurant_id=r.id` to a JSON file.
6. Run `node scripts/qa/scale-http.mjs /path/to/local-catalog.json`. It submits 100 HTTP requests and 100 identical retries and compares order identifiers and restaurant ownership.
7. `scale-realtime.mjs` subscribes 100 distinct merchant identities, then submits fresh local orders. It requires a self-hosted Supabase Realtime tenant `realtime-dev`, the local test JWT secret, published orders, and sufficient Docker memory. Success must be observed before claiming delivery to 100 subscribers. A successful SQL or HTTP test alone does not prove this.

The test JWT secret and database password used by this harness are deliberately local fixtures. Do not reuse them in deployed services. Local latency numbers are not a production performance guarantee. Do not create real merchant accounts, slugs, orders, emails or APNs messages to execute this harness.
