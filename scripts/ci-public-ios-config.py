"""Load only configuration already published in the public web client."""
import base64
import json
import os
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ORIGIN = "https://app.commandeici.com"

def read_public(url):
    assert urlparse(url).scheme == "https" and urlparse(url).netloc == "app.commandeici.com"
    with urlopen(Request(url, headers={"User-Agent": "curl/8.7.1"}), timeout=30) as response:
        assert urlparse(response.url).netloc == "app.commandeici.com"
        data = response.read(4_000_001)
        assert len(data) <= 4_000_000
        return data.decode("utf-8")

class EntryParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.entries = []
    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "script" and attributes.get("type") == "module" and attributes.get("src"):
            self.entries.append(urljoin(ORIGIN, attributes["src"]))

parser = EntryParser()
parser.feed(read_public(ORIGIN))
assert len(parser.entries) == 1, "Public app entry is ambiguous"
client = read_public(parser.entries[0])
urls = set(re.findall(r"https://[a-z0-9]+\.supabase\.co", client))
assert len(urls) == 1, "Public backend project is ambiguous"
url = urls.pop()
project = urlparse(url).hostname.split(".")[0]
anonymous = set()
for token in re.findall(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", client):
    try:
        encoded = token.split(".")[1]
        payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        if payload.get("role") == "anon" and payload.get("ref") == project and payload.get("iss") == "supabase":
            anonymous.add(token)
    except (ValueError, UnicodeDecodeError):
        continue
assert len(anonymous) == 1, "Expected exactly one published anonymous project key"
revenuecat = set(re.findall(r"appl_[A-Za-z0-9]{12,}", client))
assert len(revenuecat) == 1, "Expected one published iOS public SDK key"
anonymous_key = anonymous.pop()
values = {
    "VITE_SUPABASE_URL": url,
    "VITE_SUPABASE_PUBLISHABLE_KEY": anonymous_key,
    "VITE_SUPABASE_ANON_KEY": anonymous_key,
    "VITE_REVENUECAT_IOS_API_KEY": revenuecat.pop(),
    "VITE_GOOGLE_AUTH_ENABLED": "false",
    "VITE_APNS_ENVIRONMENT": "production",
}
with Path(os.environ["GITHUB_ENV"]).open("a") as output:
    for name, value in values.items():
        assert "\n" not in value and "\r" not in value
        if os.environ.get("GITHUB_ACTIONS") == "true" and name.endswith("KEY"):
            print(f"::add-mask::{value}")
        output.write(f"{name}={value}\n")
print("Loaded public client configuration; anonymous access only; no private keys or accounts")
