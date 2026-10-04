"""Validate existing public client configuration before a simulator-only build."""
import base64
import hashlib
import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse

NAMES = ("VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_REVENUECAT_IOS_API_KEY")
values = {name: os.environ.get(name, "") for name in NAMES}
assert all(value and len(value) <= 2048 and "\n" not in value and "\r" not in value for value in values.values()), "Missing or invalid public configuration"
url = values["VITE_SUPABASE_URL"]
assert re.fullmatch(r"https://[a-z0-9]+\.supabase\.co", url), "Invalid public backend origin"
project = urlparse(url).hostname.split(".")[0]
key = values["VITE_SUPABASE_PUBLISHABLE_KEY"]
assert re.fullmatch(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", key), "Expected a published anonymous JWT"
try:
    encoded = key.split(".")[1]
    payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
except (ValueError, UnicodeDecodeError) as error:
    raise AssertionError("Invalid anonymous JWT payload") from None
assert isinstance(payload, dict) and payload.get("role") == "anon" and payload.get("ref") == project and payload.get("iss") == "supabase", "Anonymous key must match the public project"
assert re.fullmatch(r"appl_[A-Za-z0-9]{12,}", values["VITE_REVENUECAT_IOS_API_KEY"]), "Expected a published iOS SDK public key"
values.update({"VITE_SUPABASE_ANON_KEY": key, "VITE_GOOGLE_AUTH_ENABLED": "false", "VITE_APNS_ENVIRONMENT": "production"})
# Only write after every value passes; never fall back to elevated credentials.
with Path(os.environ["GITHUB_ENV"]).open("a") as output:
    for name, value in values.items():
        if os.environ.get("GITHUB_ACTIONS") == "true" and name.endswith("KEY"):
            print(f"::add-mask::{value}")
        output.write(f"{name}={value}\n")
report = Path("CIReport")
report.mkdir(exist_ok=True)
(report / "public-config.json").write_text(json.dumps({"source": "existing published client via repository public variables", "anonymousOnly": True, "fingerprints": {name: hashlib.sha256(values[name].encode()).hexdigest() for name in NAMES}}, indent=2))
print("Validated published public client configuration; anonymous access only")
