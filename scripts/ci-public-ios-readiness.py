"""Read two anonymous public demo endpoints; never place or change an order."""
import json
import os
import re
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

origin = os.environ['VITE_SUPABASE_URL']
key = os.environ['VITE_SUPABASE_PUBLISHABLE_KEY']
checks = []
for endpoint, payload, expected in [('get_demo_restaurant', {'p_slug': 'demo'}, 'list'), ('get_public_restaurant_by_slug', {'p_slug': 'antalya-kebab-moneteau'}, 'dict')]:
    request = Request(origin + '/rest/v1/rpc/' + endpoint, data=json.dumps(payload).encode(), headers={'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Origin': 'capacitor://localhost'}, method='POST')
    check = {'endpoint': endpoint, 'anonymousReadOnly': True, 'origin': 'capacitor://localhost'}
    try:
        with urlopen(request, timeout=25) as response:
            data = json.loads(response.read(100_001))
            check.update({'httpStatus': response.status, 'shape': type(data).__name__, 'rowCount': len(data) if isinstance(data, list) else 1 if isinstance(data, dict) else 0})
            row = data[0] if isinstance(data, list) and len(data) == 1 else data if isinstance(data, dict) else None
            allowed_slugs = {'demo', 'antalya-kebab-moneteau'} if expected == 'list' else {'antalya-kebab-moneteau'}
            check['valid'] = response.status == 200 and check['shape'] == expected and isinstance(row, dict) and isinstance(row.get('id'), str) and bool(re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', row['id'])) and row.get('slug') in allowed_slugs and row.get('is_demo') is True
    except HTTPError as error:
        check.update({'httpStatus': error.code, 'valid': False})
    except (URLError, TimeoutError, ValueError):
        check.update({'transportOrParsingError': True, 'valid': False})
    checks.append(check)
Path('CIReport').mkdir(exist_ok=True)
Path('CIReport/public-readiness.json').write_text(json.dumps(checks, indent=2))
assert all(check['valid'] for check in checks), 'Anonymous public demo readiness failed; inspect status-only report'
print('Two anonymous public demo reads passed; no account, order or auth mutation')
