#!/bin/sh
set -eu
policy_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
policy_tmp=$(mktemp -d "${TMPDIR:-/tmp}/commandeici-opening-policy.XXXXXX")
trap 'rm -rf "$policy_tmp"' EXIT HUP INT TERM
xcrun swiftc -parse-as-library "$policy_root/ios/App/App/OpeningRecoveryPolicy.swift" "$policy_root/ios/PolicyTests/main.swift" -o "$policy_tmp/checks"
"$policy_tmp/checks"
