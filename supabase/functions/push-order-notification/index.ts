import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createPushHandler, type PushJob, type PushStore } from './delivery.ts';

const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }) },
});
const store: PushStore = {
  async claim(limit) {
    const { data, error } = await client.rpc('claim_order_push', { p_limit: limit });
    if (error) throw new Error('claim_failed');
    return (data ?? []) as PushJob[];
  },
  async authorize(job) {
    const { data, error } = await client.rpc('authorize_order_push', { p_id: job.id, p_lease: job.lease });
    if (error) throw new Error('authorization_failed'); return data === true;
  },
  async finish(job, result, reason, retrySeconds) {
    const { data, error } = await client.rpc('finish_order_push', { p_id: job.id, p_lease: job.lease,
      p_result: result, p_reason: reason, p_retry_seconds: retrySeconds });
    if (error) throw new Error('receipt_failed'); return data === true;
  },
  async wake() {
    const { error } = await client.rpc('dispatch_order_push', { p_continue: true });
    if (error) throw new Error('dispatch_failed');
  },
};
serve(createPushHandler({
  cronSecret: Deno.env.get('COMMANDEICI_ORDER_PUSH_CRON_SECRET') ?? '',
  privateKey: Deno.env.get('APNS_PRIVATE_KEY') ?? '',
  keyId: Deno.env.get('APNS_KEY_ID') ?? '', teamId: Deno.env.get('APNS_TEAM_ID') ?? '',
  topic: Deno.env.get('APNS_TOPIC') ?? '',
}, { store }));
