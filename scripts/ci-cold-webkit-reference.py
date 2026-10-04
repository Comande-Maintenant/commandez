"""Observe a constant WebKit document on a separate fresh CI host.

This reference does not launch or warm CommandeIci or replace its native tests.
It measures document readiness, not React, authenticated APIs or AX hitability.
"""
from pathlib import Path
import datetime
import json
import os
import plistlib
import subprocess
import time


def run(arguments, timeout=60):
    try:
        return subprocess.check_output(arguments, text=True, stderr=subprocess.STDOUT, timeout=timeout).strip()
    except subprocess.CalledProcessError as error:
        Path('CIReference/command-error.log').write_text(error.output)
        raise


def main():
    report = Path('CIReference')
    report.mkdir()
    app = report / 'ColdReference.app'
    app.mkdir()
    bundle = 'com.commandeici.cold-reference'
    info = {'CFBundleIdentifier': bundle, 'CFBundleExecutable': 'ColdReference', 'CFBundleName': 'ColdReference',
            'CFBundlePackageType': 'APPL', 'CFBundleVersion': '1', 'CFBundleShortVersionString': '1.0',
            'MinimumOSVersion': '15.0', 'UIDeviceFamily': [1], 'UILaunchScreen': {}, 'LSRequiresIPhoneOS': True}
    (app / 'Info.plist').write_bytes(plistlib.dumps(info))
    simulated = report / 'simulated.plist'
    simulated.write_bytes(plistlib.dumps({'application-identifier': '889YAF54QV.' + bundle}))
    empty = report / 'host.plist'
    empty.write_bytes(plistlib.dumps({}))
    sdk = run(['xcrun', '--sdk', 'iphonesimulator', '--show-sdk-path'])
    run(['xcrun', 'swiftc', '-parse-as-library', '-sdk', sdk, '-target', 'arm64-apple-ios15.0-simulator',
         'scripts/native-cold-reference.swift', '-Xlinker', '-sectcreate', '-Xlinker', '__TEXT',
         '-Xlinker', '__entitlements', '-Xlinker', str(simulated), '-o', str(app / 'ColdReference')], timeout=120)
    run(['codesign', '--force', '--sign', '-', '--entitlements', str(empty), str(app)])
    run(['codesign', '--verify', '--deep', '--strict', str(app)])
    device = run(['xcrun', 'simctl', 'create', 'Cold WebKit Reference ' + os.environ.get('GITHUB_RUN_ID', 'local'),
                  'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro', 'com.apple.CoreSimulator.SimRuntime.iOS-26-2'])
    try:
        run(['xcrun', 'simctl', 'boot', device])
        run(['xcrun', 'simctl', 'bootstatus', device, '-b'], timeout=180)
        run(['xcrun', 'simctl', 'install', device, str(app)])
        container = Path(run(['xcrun', 'simctl', 'get_app_container', device, bundle, 'data']))
        started = time.monotonic()
        run(['xcrun', 'simctl', 'launch', device, bundle])
        file = container / 'Documents/reference.json'
        records = []
        while time.monotonic() - started < 59:
            if file.exists():
                records = json.loads(file.read_text())
                if any(x['event'] == 'document-frame-ready' for x in records):
                    break
            time.sleep(.2)
        ready = any(x['event'] == 'document-frame-ready' for x in records)
        proof = {'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'source': run(['git', 'rev-parse', 'HEAD']),
                 'isolatedHostJob': True, 'networkUsed': False, 'authUsed': False, 'actualAppLaunched': False,
                 'privateSigningIdentityUsed': False, 'device': device, 'documentReady': ready, 'records': records,
                 'totalLaunchSeconds': time.monotonic() - started,
                 'limits': 'Constant inline document and frame callbacks; no React, app route, API, AX hitability or user-data proof'}
        (report / 'summary.json').write_text(json.dumps(proof, indent=2))
        run(['xcrun', 'simctl', 'io', device, 'screenshot', str(report / 'reference-screen.png')])
        print(json.dumps({'documentReady': ready, 'totalLaunchSeconds': proof['totalLaunchSeconds']}))
        assert ready, 'Separate constant WebKit reference did not reach its document readiness boundary'
    finally:
        subprocess.run(['xcrun', 'simctl', 'shutdown', device], capture_output=True)
        subprocess.run(['xcrun', 'simctl', 'delete', device], capture_output=True)


if __name__ == '__main__':
    main()
