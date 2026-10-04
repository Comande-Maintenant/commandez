"""Exercise readiness acceptance and rejection entirely offline."""
import contextlib
import io
import json
import os
from pathlib import Path
import runpy
import tempfile
from unittest.mock import patch
from urllib.error import HTTPError

script = Path(__file__).with_name('ci-public-ios-readiness.py').resolve()
row = {'id': '00000000-0000-0000-0000-000000000001', 'slug': 'antalya-kebab-moneteau', 'is_demo': True}
class Response(io.BytesIO):
    status = 200
    def __init__(self, data): super().__init__(json.dumps(data).encode())
cases = [([Response([row]), Response(row)], True), ([Response([]), Response({})], False), ([Response([None]), Response(row)], False), ([Response([row]), Response({})], False), ([Response([{**row, 'slug': 'unrelated'}]), Response(row)], False), ([Response([{**row, 'id': 'invalid'}]), Response(row)], False), ([HTTPError('https://example.supabase.co', 401, 'blocked', {}, None), Response(row)], False), ([TimeoutError(), Response(row)], False)]
for responses, allowed in cases:
    with tempfile.TemporaryDirectory() as folder:
        previous = Path.cwd()
        try:
            os.chdir(folder)
            with patch.dict(os.environ, {'VITE_SUPABASE_URL': 'https://example.supabase.co', 'VITE_SUPABASE_PUBLISHABLE_KEY': 'fake-public-key'}), patch('urllib.request.urlopen', side_effect=responses) as calls, contextlib.redirect_stdout(io.StringIO()):
                try:
                    runpy.run_path(str(script)); passed = True
                except AssertionError:
                    passed = False
                assert calls.call_count == 2
            assert passed == allowed
            checks = json.loads(Path('CIReport/public-readiness.json').read_text())
            assert len(checks) == 2 and all(c['anonymousReadOnly'] for c in checks)
            assert all(c['valid'] for c in checks) == allowed
        finally:
            os.chdir(previous)
print(f'{len(cases)} offline public readiness checks passed; zero network calls')
