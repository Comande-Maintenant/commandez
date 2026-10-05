"""Offline rejection checks; no network, real credentials or repository mutations."""
import base64
import json
import os
from pathlib import Path
import subprocess
import tempfile

script = Path(__file__).with_name("ci-public-ios-config.py").resolve()
def token(**patch):
    payload = {"role": "anon", "ref": "exampleproject", "iss": "supabase", **patch}
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    return "eyJhbGciOiJIUzI1NiJ9." + encoded + ".fakesignature"
base = {"VITE_SUPABASE_URL": "https://exampleproject.supabase.co", "VITE_SUPABASE_PUBLISHABLE_KEY": token(), "VITE_REVENUECAT_IOS_API_KEY": "appl_fakePublicSdk123"}
cases = [({}, True), ({"VITE_SUPABASE_PUBLISHABLE_KEY": token(role="service_role")}, False), ({"VITE_SUPABASE_PUBLISHABLE_KEY": token(ref="otherproject")}, False), ({"VITE_SUPABASE_PUBLISHABLE_KEY": token(iss="otherissuer")}, False), ({"VITE_SUPABASE_URL": "http://exampleproject.supabase.co"}, False), ({"VITE_SUPABASE_URL": "https://external.example"}, False), ({"VITE_SUPABASE_PUBLISHABLE_KEY": "not-a-jwt"}, False), ({"VITE_REVENUECAT_IOS_API_KEY": "secret_otherPlatform123"}, False), ({"VITE_REVENUECAT_IOS_API_KEY": "appl_fakePublicSdk123\nVITE_OTHER=bad"}, False), ({"VITE_SUPABASE_PUBLISHABLE_KEY": ""}, False), ({"VITE_REVENUECAT_IOS_API_KEY": "appl_" + "a" * 2048}, False)]
for patch, allowed in cases:
    with tempfile.TemporaryDirectory() as folder:
        output = Path(folder) / "env"
        result = subprocess.run(["python3", str(script)], cwd=folder, env={**os.environ, **base, **patch, "GITHUB_ENV": str(output), "GITHUB_ACTIONS": "false"}, capture_output=True, text=True)
        assert (result.returncode == 0) == allowed, "Unexpected configuration decision"
        assert output.exists() == allowed, "Rejected input must not write build configuration"
        if allowed:
            parsed = dict(line.split("=", 1) for line in output.read_text().splitlines())
            assert parsed["VITE_SUPABASE_ANON_KEY"] == base["VITE_SUPABASE_PUBLISHABLE_KEY"]
            assert parsed["VITE_GOOGLE_AUTH_ENABLED"] == "false" and parsed["VITE_APNS_ENVIRONMENT"] == "production"
            assert json.loads((Path(folder) / "CIReport/public-config.json").read_text())["anonymousOnly"]
print(f"{len(cases)} offline configuration checks passed")
