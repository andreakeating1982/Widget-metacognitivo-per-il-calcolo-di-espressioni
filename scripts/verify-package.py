#!/usr/bin/env python3
"""Verify an exported ZIP; optionally rebuild without API/DB credentials.
Python 3.11+ standard library. Never uses production data or calls live AI.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import socket
import stat
import subprocess
import time
import urllib.error
import urllib.request
import zipfile

MODULE = Path(__file__).with_name('export-verified.py')
spec = importlib.util.spec_from_file_location('package_export', MODULE)
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)
APPROVED = {
    'assets/index-4q0PEhNN.js': '734e0af599b2e49ae52bc3660155b241af6fc7223b2b3ea356ed05a4dc340d7c',
    'assets/index-G2fFP9TG.css': 'd86a90702741b80a751a8c76ee9f7e5a68fcf13cd939a768c1c941a1655eb2e8',
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def hashes(root):
    return {p.relative_to(root).as_posix(): sha(p.read_bytes()) for p in root.rglob('*') if p.is_file()}


def verify_archive(archive):
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:
            raise ValueError('ZIP CRC failed')
        names = z.namelist()
        if len(names) != len(set(names)):
            raise ValueError('Duplicate ZIP entries')
        roots = set()
        for item in z.infolist():
            p = PurePosixPath(item.filename)
            if p.is_absolute() or '..' in p.parts or '\\' in item.filename or not p.parts:
                raise ValueError('Unsafe ZIP path')
            if stat.S_ISLNK(item.external_attr >> 16):
                raise ValueError('Symlink not allowed')
            roots.add(p.parts[0])
        if len(roots) != 1:
            raise ValueError('Expected one application root')
        prefix = roots.pop()
        manifest_name = f'{prefix}/MANIFEST-SHA256.json'
        m = json.loads(z.read(manifest_name))
        if m['archive_prefix'] != prefix:
            raise ValueError('Manifest prefix mismatch')
        seen = set()
        for record in m['files']:
            name = record['path']
            p = PurePosixPath(name)
            if p.is_absolute() or '..' in p.parts or '\\' in name or name in seen:
                raise ValueError('Invalid/duplicate manifest path')
            if exporter.exclusion(name):
                raise ValueError(f'Forbidden payload: {name}')
            data = z.read(f'{prefix}/{name}')
            if len(data) != record['size'] or sha(data) != record['sha256']:
                raise ValueError(f'Payload mismatch: {name}')
            exporter.verify_payload(name, data, set())
            seen.add(name)
        expected = {f'{prefix}/{n}' for n in seen} | {manifest_name}
        actual = {n for n in names if not n.endswith('/')}
        if expected != actual:
            raise ValueError('Unlisted/missing archive entries')
        if not set(exporter.REQUIRED).issubset(seen):
            raise ValueError('Missing required guides/configuration')
        return m, {'archive_name': Path(archive).name, 'archive_sha256': sha(Path(archive).read_bytes()),
                   'archive_bytes': Path(archive).stat().st_size,
                   'source_commit': m['source_commit'], 'production_deployment': m.get('production_deployment'),
                   'payload_files': len(seen), 'zip_file_entries_including_manifest': len(actual),
                   'crc': 'passed', 'sha256_all_payloads': 'passed',
                   'credential_signatures': 'passed', 'paths_and_exclusions': 'passed'}


def safe_environment():
    # Do not inherit API keys, database URLs, benchmark switches or CI secrets.
    env = {k: v for k, v in os.environ.items() if not re.search(
        r'API_?KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL|PRIVATE_KEY|^VITE_|^BENCH|^RUN_', k, re.I)}
    env.update(CI='true', NODE_ENV='production')
    return env


def request(url, data=None):
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'} if data else {})
    try:
        r = urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as exc:
        r = exc
    with r:
        return r.status, dict(r.headers), r.read()


def smoke(project, env, logs):
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    base = f'http://127.0.0.1:{port}'
    with (logs/'server.log').open('w') as log:
        proc = subprocess.Popen(['node', 'dist/index.js'], cwd=project,
                                env=dict(env, PORT=str(port)), stdout=log, stderr=subprocess.STDOUT)
        try:
            for _ in range(80):
                try:
                    code, headers, body = request(base+'/')
                    break
                except (OSError, urllib.error.URLError):
                    if proc.poll() is not None:
                        raise RuntimeError('Smoke server exited')
                    time.sleep(.2)
            else:
                raise RuntimeError('Smoke server not ready')
            assert code == 200 and b'WIDGET METACOGNITIVO' in body
            assert headers.get('Cross-Origin-Opener-Policy') == 'same-origin'
            assert headers.get('Cross-Origin-Embedder-Policy') == 'require-corp'
            checks = []
            assets = ['fonts/OpenDyslexic-Regular.ttf',
                      'fonts/OpenDyslexic-Regular-v2.woff2', 'fonts/OpenDyslexic-Bold-v2.woff2',
                      'models/comer/vocab.json',
                      'models/comer/encoder_int8.onnx', 'wasm/ort-wasm-simd-threaded.jsep.wasm',
                      'tess/worker.min.js', 'tessdata/eng.traineddata.gz',
                      'quaderno-matematica-facile-v4.pdf', *APPROVED]
            for rel in assets:
                status, hs, payload = request(base+'/'+rel)
                assert status == 200 and sha(payload) == sha((project/'dist/public'/rel).read_bytes()), rel
                if rel.startswith('fonts/'):
                    assert hs.get('Access-Control-Allow-Origin') == '*'
                checks.append({'path': rel, 'http': status, 'content_sha256_matches_file': True,
                               'content_type': hs.get('Content-Type')})
            ai, _, ai_body = request(base+'/api/ai/transcribe', b'{}')
            assert ai == 503 and 'EASY_PEASY_API_KEY' in ai_body.decode()
            return {'root_http': code, 'coop': headers['Cross-Origin-Opener-Policy'],
                    'coep': headers['Cross-Origin-Embedder-Policy'],
                    'ai_without_key': ai, 'asset_checks': checks,
                    'database_read_or_write_endpoints_used': False}
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill(); proc.wait()


def rebuild(archive, destination, manifest, baseline):
    if destination.exists():
        raise ValueError('Extraction destination must be NEW (not overwrite existing files)')
    destination.mkdir(parents=True)
    with zipfile.ZipFile(archive) as z:
        z.extractall(destination)
    project = destination/manifest['archive_prefix']
    logs = destination/'qa-logs'
    logs.mkdir()
    env = safe_environment()
    steps = [('corepack', ['corepack', 'enable'], project),
             ('install', ['pnpm', 'install', '--frozen-lockfile', '--prod=false'], project),
             ('check', ['pnpm', 'check'], project),
             ('unit', ['pnpm', 'exec', 'vitest', 'run'], project/'client'),
             ('packaging', ['python3', '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_export_tools.py', '-v'], project),
             ('build', ['pnpm', 'build'], project)]
    results = []
    for name, command, cwd in steps:
        print(f'RUN {name}', flush=True)
        start = time.monotonic()
        with (logs/f'{name}.log').open('w') as log:
            p = subprocess.run(command, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT, timeout=1200)
        results.append({'step': name, 'exit_code': p.returncode, 'seconds': round(time.monotonic()-start, 2)})
        if p.returncode:
            raise RuntimeError(f'{name} failed; see isolated qa-logs/{name}.log')
    units = (logs/'unit.log').read_text()
    assert '738 passed' in units and '28 skipped' in units
    generated = (project/'shared/env.generated.ts').read_text()
    assert re.search(r'BAKED_EASY_PEASY_API_KEY: string = "";', generated)
    public = hashes(project/'dist/public')
    for rel, expected in APPROVED.items():
        assert public.get(rel) == expected, f'Approved baseline changed: {rel}'
    comparison = None
    if baseline:
        approved = hashes(baseline)
        comparison = {'files': len(approved), 'missing': sorted(approved.keys()-public.keys()),
                      'extra': sorted(public.keys()-approved.keys()),
                      'different': sorted(k for k in approved.keys() & public.keys() if approved[k] != public[k])}
        assert not comparison['missing'] and not comparison['extra'] and not comparison['different'], comparison
    return {'steps': results, 'node_env': 'production', 'install_dev_dependencies': True,
            'unit_tests': {'passed': 738, 'skipped': 28},
            'approved_js_css_identical': True, 'client_files': len(public),
            'all_client_files_comparison': comparison, 'generated_api_key_empty': True,
            'live_ai_tested': False, 'production_database_used': False,
            'smoke': smoke(project, env, logs)}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('archive', type=Path)
    p.add_argument('--report', type=Path, required=True)
    p.add_argument('--rebuild', action='store_true')
    p.add_argument('--extract-to', type=Path)
    p.add_argument('--baseline-public', type=Path)
    args = p.parse_args()
    if args.rebuild and not args.extract_to:
        p.error('--rebuild requires --extract-to pointing to a new directory')
    manifest, result = verify_archive(args.archive)
    result['checked_at_utc'] = datetime.now(timezone.utc).isoformat()
    result['reconstruction'] = rebuild(args.archive, args.extract_to, manifest, args.baseline_public) if args.rebuild else None
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()

