#!/usr/bin/env python3
"""Reproduce overlapping slug bases on the isolated CommandeIci database only.

A scoped BEFORE INSERT pause forces both transactions past the old existence
check. Existing scale fixtures are never deleted. Fails before migration 130.
"""
import json
import subprocess
import time
import uuid

CONTAINER = 'commandeici-functional-db-20261003'
COMMAND = ['docker', 'exec', '-i', CONTAINER, 'psql', '-X', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At']
IDS = [str(uuid.uuid5(uuid.NAMESPACE_DNS, f'qa-overlap-user-{index}.example.test')) for index in range(3)]
KEYS = [str(uuid.uuid5(uuid.NAMESPACE_DNS, f'qa-overlap-key-{index}.example.test')) for index in range(2)]


def sql(query):
    result = subprocess.run(COMMAND, input=query, capture_output=True, text=True, timeout=20)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def cleanup():
    sql("""
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
 WHERE application_name IN ('qa-overlap-0','qa-overlap-1') AND pid<>pg_backend_pid();
DROP TRIGGER IF EXISTS qa_overlap_pause ON public.restaurants;
DROP FUNCTION IF EXISTS public.qa_overlap_pause();
DELETE FROM public.restaurants WHERE slug LIKE 'qa-overlap-%';
""" + f"DELETE FROM public.owners WHERE id IN ({','.join(repr(value) for value in IDS)});\n"
        + f"DELETE FROM auth.users WHERE id IN ({','.join(repr(value) for value in IDS)}) AND email LIKE 'qa-overlap-%@example.test';")


def start(index, base):
    claims = json.dumps({'sub': IDS[index], 'role': 'authenticated'})
    payload = json.dumps({'name': 'QA Overlap', 'city': 'Paris', 'slug': base})
    query = f"""
BEGIN;
SET LOCAL application_name='qa-overlap-{index}';
SELECT set_config('request.jwt.claim.sub','{IDS[index]}',true);
SELECT set_config('request.jwt.claims','{claims}',true);
SET LOCAL ROLE authenticated;
SELECT complete_onboarding('{KEYS[index]}','{payload}',
 '[{{"name":"Pizza","category":"Plats","price":12,"product_type":"simple"}}]','{{}}');
COMMIT;
"""
    process = subprocess.Popen(COMMAND, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    process.stdin.write(query)
    process.stdin.close()
    process.stdin = None
    return process


def main():
    existing = set(sql("SELECT id FROM restaurants WHERE slug NOT LIKE 'qa-overlap-%' ORDER BY id").splitlines())
    processes = []
    cleanup()
    try:
        values = ','.join(f"('{value}','qa-overlap-{index}@example.test',now())" for index, value in enumerate(IDS))
        sql(f"""
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES {values};
INSERT INTO owners(id,email,phone) VALUES ('{IDS[2]}','qa-overlap-2@example.test','');
INSERT INTO restaurants(name,slug,owner_id,is_open,is_accepting_orders)
 VALUES('QA Overlap Seed','qa-overlap-cafe','{IDS[2]}',true,true);
CREATE FUNCTION public.qa_overlap_pause() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.slug='qa-overlap-cafe-2' THEN PERFORM pg_sleep(1.5); END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER qa_overlap_pause BEFORE INSERT ON public.restaurants
 FOR EACH ROW EXECUTE FUNCTION public.qa_overlap_pause();
""")
        first = start(0, 'qa-overlap-cafe')
        processes.append(first)
        deadline = time.monotonic() + 6
        paused = False
        while time.monotonic() < deadline:
            if sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='qa-overlap-0' AND wait_event='PgSleep'") == '1':
                paused = True
                break
            if first.poll() is not None:
                break
            time.sleep(0.02)
        assert paused, 'first transaction must reach the scoped insert pause'
        second = start(1, 'qa-overlap-cafe-2')
        processes.append(second)
        outputs = [process.communicate(timeout=15) for process in processes]
        for index, (process, (out, err)) in enumerate(zip(processes, outputs)):
            print(json.dumps({'transaction': index, 'exit': process.returncode, 'stdout': out.strip(), 'stderr': err.strip()}))
        assert all(process.returncode == 0 for process in processes), 'both overlapping creations must succeed'
        slugs = sql("SELECT slug FROM restaurants WHERE slug LIKE 'qa-overlap-%' ORDER BY slug").splitlines()
        assert slugs == ['qa-overlap-cafe', 'qa-overlap-cafe-2', 'qa-overlap-cafe-2-2'], slugs
        counts = sql("""SELECT count(*)||':'||count(DISTINCT owner_id)||':'||count(DISTINCT onboarding_key)
 FROM restaurants WHERE slug LIKE 'qa-overlap-%' AND onboarding_key IS NOT NULL;
SELECT count(*) FROM menu_items WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'qa-overlap-%');
SELECT count(*) FROM subscriptions WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'qa-overlap-%') AND status='free';
""").splitlines()
        assert counts == ['2:2:2', '2', '2'], counts
        print(json.dumps({'overlap': 'PASS', 'slugs': slugs, 'created_restaurants': 2, 'menu_items': 2, 'free_subscriptions': 2}))
    finally:
        for process in processes:
            if process.poll() is None:
                process.kill()
                process.communicate()
        cleanup()
        after = set(sql("SELECT id FROM restaurants WHERE slug NOT LIKE 'qa-overlap-%' ORDER BY id").splitlines())
        assert existing <= after, 'preexisting restaurant fixtures must remain'
        assert sql("SELECT count(*) FROM restaurants WHERE slug LIKE 'qa-overlap-%'") == '0'
        print(json.dumps({'scoped_cleanup': 'PASS', 'preserved_restaurants': len(existing)}))


if __name__ == '__main__':
    main()
