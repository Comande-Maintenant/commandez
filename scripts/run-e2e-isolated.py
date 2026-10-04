"""Run the complete collected suite with a fresh browser lifetime per file.

All projects/assertions remain enabled. No retries, skipped cases or selective
green aggregation: collected and executed identities must match exactly.
"""
from pathlib import Path
import datetime
import hashlib
import json
import os
import subprocess
import sys


def identities(report):
    result = []
    def walk(suite):
        for spec in suite.get('specs', []):
            for test in spec['tests']:
                result.append((spec['id'], test['projectName']))
        for child in suite.get('suites', []):
            walk(child)
    for suite in report['suites']:
        walk(suite)
    return result


def main():
    out = Path(sys.argv[1]).resolve()
    out.mkdir(parents=True, exist_ok=False)
    source = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    assert not subprocess.check_output(['git', 'status', '--porcelain'], text=True), 'Freeze source before complete integration'
    env = dict(os.environ)
    env['PLAYWRIGHT_JSON_OUTPUT_FILE'] = str(out / 'collection.json')
    with (out / 'collection.log').open('w') as log:
        subprocess.run(['npx', 'playwright', 'test', '--list', '--reporter=json'], env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
    collection = json.loads((out / 'collection.json').read_text())
    expected = identities(collection)
    files = sorted({suite['file'] for suite in collection['suites']})
    actual = []
    suites = []
    totals = {'expected': 0, 'unexpected': 0, 'skipped': 0, 'flaky': 0, 'duration': 0}
    exit_codes = []
    file_results = []
    for index, file in enumerate(files):
        assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip() == source
        assert not subprocess.check_output(['git', 'status', '--porcelain'], text=True)
        tag = f'{index + 1:02d}-{Path(file).stem}'
        env['PLAYWRIGHT_JSON_OUTPUT_FILE'] = str(out / (tag + '.json'))
        with (out / (tag + '.log')).open('w') as log:
            completed = subprocess.run(['npx', 'playwright', 'test', file, '--workers=1', '--reporter=list,json',
                                        '--output=' + str(out / (tag + '-results'))], env=env, stdout=log, stderr=subprocess.STDOUT)
        report = json.loads((out / (tag + '.json')).read_text())
        actual.extend(identities(report))
        suites.extend(report['suites'])
        for key in totals:
            totals[key] += report['stats'][key]
        exit_codes.append(completed.returncode)
        result = {'file': file, 'exitCode': completed.returncode, 'stats': report['stats']}
        file_results.append(result)
        print(f'{tag}: {report["stats"]["expected"]} passed, {report["stats"]["unexpected"]} failed, {report["stats"]["skipped"]} skipped', flush=True)
    assert len(expected) == len(set(expected)) and len(actual) == len(set(actual))
    coverage = sorted(actual) == sorted(expected)
    assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip() == source
    assert not subprocess.check_output(['git', 'status', '--porcelain'], text=True)
    proof = {'source': source, 'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
             'runner': 'Fresh Playwright process and browser lifetime per collected file, one worker, all three projects',
             'allCollectedCasesExecutedExactlyOnce': coverage, 'collected': len(expected), 'executed': len(actual),
             'stats': totals, 'files': file_results, 'suites': suites, 'retries': 0,
             'collectionSha256': hashlib.sha256((out / 'collection.json').read_bytes()).hexdigest()}
    (out / 'report.json').write_text(json.dumps(proof, indent=2))
    print(json.dumps({key: proof[key] for key in ['source', 'collected', 'executed', 'allCollectedCasesExecutedExactlyOnce', 'stats']}))
    assert coverage and not any(exit_codes) and not any(totals[key] for key in ['unexpected', 'skipped', 'flaky'])


if __name__ == '__main__':
    main()
