#!/usr/bin/env python3
"""Copia pulita e indipendente del Widget, pronta per una variante.

Accetta la cartella estratta dal pacchetto, un repository Git locale pulito
oppure un URL HTTPS Git. NON sviluppa/risolve le equazioni, NON installa
pacchetti, NON configura database/chiavi e NON pubblica alcun servizio.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('export_verified', HERE / 'export-verified.py')
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


def sha_file(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def source_files(source):
    manifest = source / 'MANIFEST-SHA256.json'
    if manifest.is_file():
        data = json.loads(manifest.read_text(encoding='utf-8'))
        files = data['files']
        if data.get('payload_file_count') != len(files):
            raise ValueError('Il manifest ha un conteggio incoerente')
        return [(rec['path'], rec['sha256'], rec['size']) for rec in files]
    gitdir = subprocess.run(['git', '-C', str(source), 'rev-parse', '--show-toplevel'],
                            capture_output=True, text=True)
    if gitdir.returncode or Path(gitdir.stdout.strip()).resolve() != source:
        raise ValueError('Sorgente non valida: usa la root Git pulita o lo ZIP estratto con manifest')
    status = subprocess.check_output(['git', '-C', str(source), 'status', '--porcelain'], text=True)
    if status.strip():
        raise ValueError('Repository sorgente non pulito: registrare prima le modifiche o usare lo ZIP')
    names = subprocess.check_output(['git', '-C', str(source), 'ls-files', '-z']).decode().split('\0')
    return [(n, None, None) for n in names if n and not exporter.exclusion(n)]


def clone_from(source, destination):
    source = source.resolve(strict=True)
    destination = destination.absolute()
    if not source.is_dir() or not (source / 'package.json').is_file() or not (source / 'ADATTARE-EQUAZIONI.md').is_file():
        raise ValueError('La sorgente deve essere la root di questa app (package.json e guide)')
    if destination.exists() or destination.is_symlink():
        raise ValueError('La destinazione esiste già: scegline una NUOVA')
    if not destination.parent.is_dir():
        raise ValueError('La cartella madre della destinazione non esiste')
    if destination.resolve().is_relative_to(source) or source.is_relative_to(destination.resolve()):
        raise ValueError('Sorgente e destinazione non devono contenersi')
    records = source_files(source)
    if not records:
        raise ValueError('Nessun file selezionato')
    seen = set()
    secrets = exporter.known_secrets(source)
    stage = Path(tempfile.mkdtemp(prefix='.widget-clone-', dir=destination.parent))
    try:
        for name, expected, size in records:
            p = PurePosixPath(name)
            if p.is_absolute() or '..' in p.parts or not p.parts or '\\' in name or name in seen or exporter.exclusion(name):
                raise ValueError(f'Percorso vietato o duplicato: {name}')
            seen.add(name)
            src = source.joinpath(*p.parts)
            # Vietati symlink in ogni componente; non uscire mai dalla sorgente.
            current = source
            for part in p.parts:
                current = current / part
                if current.is_symlink():
                    raise ValueError(f'Symlink non consentito: {name}')
            if not src.is_file() or not src.resolve().is_relative_to(source):
                raise ValueError(f'File mancante o fuori dalla sorgente: {name}')
            if expected and (src.stat().st_size != size or sha_file(src) != expected):
                raise ValueError(f'File non conforme al manifest: {name}')
            exporter.verify_payload(name, src.read_bytes(), secrets)
            dst = stage.joinpath(*p.parts)
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
        for required in ('package.json', 'pnpm-lock.yaml', 'ADATTARE-EQUAZIONI.md',
                         'GUIDA-IA-CLONAZIONE-EQUAZIONI.md', 'client/src/App.tsx'):
            if required not in seen:
                raise ValueError(f'File necessario non presente: {required}')
        if destination.exists() or destination.is_symlink():
            raise ValueError('Destinazione comparsa durante la copia: operazione annullata')
        os.rename(stage, destination)
    except BaseException:
        shutil.rmtree(stage, ignore_errors=True)  # solo la cartella temporanea creata sopra
        raise
    return len(seen)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', default=str(HERE.parent), help='root Git pulita, cartella ZIP estratta o URL HTTPS del repository')
    parser.add_argument('--output', required=True, type=Path, help='nuova cartella, che NON deve esistere')
    args = parser.parse_args()
    try:
        if args.source.startswith('https://'):
            with tempfile.TemporaryDirectory(prefix='widget-git-clone-') as tmp:
                repo = Path(tmp) / 'repo'
                subprocess.run(['git', 'clone', '--depth', '1', '--', args.source, str(repo)], check=True)
                count = clone_from(repo, args.output)
        else:
            count = clone_from(Path(args.source), args.output)
        print(f'Copia creata: {args.output} ({count} file). Nessun deploy o cambio dati.')
        print('Prosegui con GUIDA-IA-CLONAZIONE-EQUAZIONI.md; prima ricostruisci la baseline.')
        print('Per un nuovo servizio cambiare identità, origin, ambiente e render.yaml: non riusare il database sorgente.')
        return 0
    except (ValueError, OSError, KeyError, subprocess.SubprocessError) as exc:
        print(f'CLONAZIONE RIFIUTATA: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())

