#!/usr/bin/env python3
"""Export only clean tracked sources; fail on credentials; add SHA-256 manifest.
Does not execute app code, access a database, or alter production.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import zipfile

SENSITIVE = re.compile(r'(?:API_?KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL|PRIVATE_KEY)', re.I)
KEY_PATTERNS = [
    re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    re.compile(rb'\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b'),
    re.compile(rb'\bgh[pousr]_[A-Za-z0-9]{30,}\b'),
    re.compile(rb'\bAKIA[0-9A-Z]{16}\b'),
]
FORBIDDEN_PARTS = {'.git', 'node_modules', 'dist', '.cache', '__pycache__', 'data', '.venv'}
REQUIRED = [
    'README.md', 'REBUILD.md', 'ADATTARE.md', 'RENDER.md', 'ACCESSIBILITA.md',
    'AGENTS.md', 'FILOSOFIA-DSA.md', 'render.yaml', 'package.json', 'pnpm-lock.yaml', '.env.example',
    '.gitignore', '.github/workflows/ci.yml', 'scripts/verify-package.py',
    'tests/test_export_tools.py', 'docs/PACCHETTO-ESPORTABILE.md',
]


def git(project, *args):
    return subprocess.check_output(['git', '-C', str(project), *args])


def exclusion(name):
    p = PurePosixPath(name)
    if any(part in FORBIDDEN_PARTS for part in p.parts):
        return 'generated/runtime/dependencies'
    if any(part == '.env' or part.startswith('.env.') for part in p.parts) and p.name != '.env.example':
        return 'environment credentials'
    if p.name in {'.DS_Store', 'env.generated.ts', 'template.json'}:
        return 'generated/private/diagnostic'
    if p.suffix.lower() in {'.log', '.sqlite', '.sqlite3', '.db', '.zip', '.pyc'}:
        return 'runtime/archive'
    if p.name.startswith(('diag_', 'diag-')) and p.suffix in {'.mjs', '.ts', '.js', '.py'}:
        return 'standalone diagnostic'
    return None


def known_secrets(project):
    # Never return/log the values outside of the scanner.
    result = set()
    for key, value in os.environ.items():
        if SENSITIVE.search(key) and len(value) >= 12:
            result.add(value.encode())
    env = project / '.env'
    if env.exists():
        for line in env.read_text(errors='replace').splitlines():
            if '=' not in line or line.lstrip().startswith('#'):
                continue
            key, value = line.split('=', 1)
            value = value.strip().strip('\"\'')
            if SENSITIVE.search(key) and len(value) >= 12:
                result.add(value.encode())
    return result


def verify_payload(name, payload, secrets):
    if any(secret in payload for secret in secrets):
        raise RuntimeError(f'Credential value detected: {name} (value withheld)')
    if any(pattern.search(payload) for pattern in KEY_PATTERNS):
        raise RuntimeError(f'Credential signature detected: {name} (value withheld)')
    if PurePosixPath(name).name == '.env.example':
        for line in payload.decode().splitlines():
            if '=' not in line or line.lstrip().startswith('#'):
                continue
            key, value = line.split('=', 1)
            if SENSITIVE.search(key) and value.strip().strip('\"\''):
                raise RuntimeError(f'Nonempty secret placeholder: {name} (value withheld)')


def export(project, output, prefix, deployment):
    project = project.resolve(strict=True)
    if git(project, 'status', '--porcelain').strip():
        raise RuntimeError('Repository must be clean: checkpoint changes before export')
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]*', prefix):
        raise RuntimeError('Unsafe archive prefix')
    if output.resolve().is_relative_to(project):
        raise RuntimeError('Write the archive outside the project')
    commit = git(project, 'rev-parse', 'HEAD').decode().strip()
    stamp = int(git(project, 'show', '-s', '--format=%ct', 'HEAD').decode().strip())
    commit_time = datetime.fromtimestamp(stamp, timezone.utc)
    zip_time = (max(1980, min(2107, commit_time.year)), commit_time.month, commit_time.day,
                commit_time.hour, commit_time.minute, commit_time.second)
    names = sorted(x for x in git(project, 'ls-files', '-z').decode().split('\0') if x)
    included, excluded = [], []
    for name in names:
        p = PurePosixPath(name)
        if p.is_absolute() or '..' in p.parts:
            raise RuntimeError('Unsafe tracked path')
        reason = exclusion(name)
        if reason:
            excluded.append({'path': name, 'reason': reason})
        else:
            included.append(name)
    for name in REQUIRED:
        if name not in included:
            raise RuntimeError(f'Missing required file: {name}')
    if not any(name.startswith('patches/') for name in included):
        raise RuntimeError('Missing dependency patches')
    secrets = known_secrets(project)
    manifest = {
        'format': 1,
        'created_at_utc': datetime.now(timezone.utc).isoformat(),
        'source_commit': commit,
        'production_deployment': deployment,
        'archive_prefix': prefix,
        'payload_file_count': len(included),
        'zip_file_entries_including_manifest': len(included) + 1,
        'note': 'Manifest lists every payload file except itself; no production credentials or runtime data.',
        'excluded_tracked_files': excluded,
        'excluded_untracked_categories': sorted(FORBIDDEN_PARTS | {'.env* (except empty .env.example)', 'shared/env.generated.ts'}),
        'files': [],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    tmp = output.with_suffix(output.suffix + '.tmp')
    try:
        with zipfile.ZipFile(tmp, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for name in included:
                path = project / name
                if path.is_symlink() or not path.is_file():
                    raise RuntimeError(f'Unexpected symlink/missing file: {name}')
                payload = path.read_bytes()
                verify_payload(name, payload, secrets)
                info = zipfile.ZipInfo(f'{prefix}/{name}')
                info.date_time = zip_time
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = (0o100755 if path.stat().st_mode & 0o111 else 0o100644) << 16
                archive.writestr(info, payload, compresslevel=6)
                manifest['files'].append({'path': name, 'size': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()})
            archive.writestr(f'{prefix}/MANIFEST-SHA256.json', json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        with zipfile.ZipFile(tmp) as archive:
            if archive.testzip() is not None:
                raise RuntimeError('ZIP CRC verification failed')
            for record in manifest['files']:
                payload = archive.read(f"{prefix}/{record['path']}")
                if hashlib.sha256(payload).hexdigest() != record['sha256']:
                    raise RuntimeError(f"Archive hash mismatch: {record['path']}")
        tmp.replace(output)
    except Exception:
        tmp.unlink(missing_ok=True)
        raise
    return {
        'archive': str(output), 'files': len(included), 'source_commit': commit,
        'bytes': output.stat().st_size,
        'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        'excluded_tracked_files': excluded,
        'credentials_scan': 'passed (no values printed)', 'zip_crc_and_sha256': 'passed',
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--project', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--prefix', required=True)
    p.add_argument('--deployment', type=int)
    args = p.parse_args()
    try:
        result = export(args.project, args.output, args.prefix, args.deployment)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as exc:
        print(f'EXPORT REFUSED: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

