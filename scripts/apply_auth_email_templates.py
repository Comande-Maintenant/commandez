#!/usr/bin/env python3
"""Apply the French Supabase Auth e-mail templates stored in supabase/templates/auth.

Usage:
  SUPABASE_ACCESS_TOKEN=... python3 scripts/apply_auth_email_templates.py --save-backup <file>
  SUPABASE_ACCESS_TOKEN=... python3 scripts/apply_auth_email_templates.py --dry-run
  SUPABASE_ACCESS_TOKEN=... python3 scripts/apply_auth_email_templates.py --apply --backup <file>
  SUPABASE_ACCESS_TOKEN=... python3 scripts/apply_auth_email_templates.py --restore <backup-file>

Only mailer_subjects_<kind> and mailer_templates_<kind>_content are written, then read back.
"""
import argparse
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "tgtvkzmokypztdudwzne")
API = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/config/auth"
TEMPLATES = Path(__file__).resolve().parent.parent / "supabase/templates/auth"
KINDS = ["confirmation", "recovery", "magic_link", "email_change", "reauthentication"]
# Variables each template must keep so links and codes keep working.
REQUIRED = {"reauthentication": ["{{ .Token }}"], "email_change": ["{{ .ConfirmationURL }}", "{{ .NewEmail }}"]}
ALLOWED_VARIABLES = {"{{ .ConfirmationURL }}", "{{ .Token }}", "{{ .NewEmail }}"}
MANAGED_KEYS = [key for kind in KINDS for key in (f"mailer_subjects_{kind}", f"mailer_templates_{kind}_content")]


def call(method, payload=None):
    request = urllib.request.Request(
        API,
        data=json.dumps(payload).encode() if payload is not None else None,
        method=method,
        headers={"Authorization": "Bearer " + os.environ["SUPABASE_ACCESS_TOKEN"], "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def desired():
    subjects = json.loads((TEMPLATES / "subjects.json").read_text())
    values = {}
    for kind in KINDS:
        body = (TEMPLATES / f"{kind}.html").read_text()
        for variable in REQUIRED.get(kind, ["{{ .ConfirmationURL }}"]):
            if variable not in body:
                sys.exit(f"{kind}: missing {variable}")
        unknown = set(re.findall(r"\{\{[^}]*\}\}", body + subjects[kind])) - ALLOWED_VARIABLES
        if unknown:
            sys.exit(f"{kind}: unexpected template syntax {sorted(unknown)}")
        if "—" in body + subjects[kind] or "–" in body + subjects[kind]:
            sys.exit(f"{kind}: dash characters are forbidden in copy")
        values[f"mailer_subjects_{kind}"] = subjects[kind]
        values[f"mailer_templates_{kind}_content"] = body
    return values


def main():
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--restore")
    mode.add_argument("--save-backup")
    parser.add_argument("--backup")
    args = parser.parse_args()

    current = call("GET")
    if args.save_backup:
        path = Path(args.save_backup)
        if path.exists():
            sys.exit("Backup file already exists; choose a new path")
        path.write_text(json.dumps({key: current.get(key) for key in MANAGED_KEYS}, ensure_ascii=False, indent=2))
        path.chmod(0o600)
        print(json.dumps({"saved_keys": len(MANAGED_KEYS), "path": str(path)}))
        return
    if args.restore:
        backup = json.loads(Path(args.restore).read_text())
        missing = [key for key in MANAGED_KEYS if key not in backup]
        if missing:
            sys.exit(f"Backup is missing {missing}")
        target = {key: backup[key] for key in MANAGED_KEYS}
    else:
        target = desired()
    changes = {key: value for key, value in target.items() if current.get(key) != value}
    print(json.dumps({"changed_keys": sorted(changes)}, indent=2))
    if args.dry_run or not changes:
        return
    if args.apply:
        if not args.backup or not Path(args.backup).is_file():
            sys.exit("--apply requires an existing --backup file")
        backup = json.loads(Path(args.backup).read_text())
        if any(backup.get(key) != current.get(key) for key in target):
            sys.exit("Backup no longer matches live configuration; take a fresh backup first")
    call("PATCH", changes)
    after = call("GET")
    mismatched = [key for key in target if after.get(key) != target[key]]
    print(json.dumps({"readback_mismatched": mismatched}, indent=2))
    sys.exit(1 if mismatched else 0)


if __name__ == "__main__":
    main()
