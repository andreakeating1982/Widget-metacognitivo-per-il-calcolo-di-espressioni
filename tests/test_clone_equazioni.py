"""Verifica isolata della clonazione: fixture sintetiche, nessun DB o rete."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts/clona-app-equazioni.py'


class CloneTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='test-clone-widget-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.source = self.base / 'source'
        self.source.mkdir()
        files = {
            'package.json': '{"name":"fixture"}',
            'pnpm-lock.yaml': 'lockfileVersion: 9',
            'ADATTARE-EQUAZIONI.md': 'note',
            'GUIDA-IA-CLONAZIONE-EQUAZIONI.md': 'guida',
            'client/src/App.tsx': 'export const fixture = 1;',
            '.env.example': 'EASY_PEASY_API_KEY=\nDATABASE_URL=\n',
        }
        self.records = []
        for name, content in files.items():
            path = self.source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
            data = path.read_bytes()
            self.records.append({'path': name, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
        self.write_manifest()
        # Non presente nel manifest: non deve essere copiato neppure se esiste.
        (self.source / '.env').write_text('EASY_PEASY_API_KEY=synthetic-private-value-123456\n')
        (self.source / 'data').mkdir()
        (self.source / 'data/session.json').write_text('private fixture')

    def write_manifest(self):
        (self.source / 'MANIFEST-SHA256.json').write_text(json.dumps({
            'payload_file_count': len(self.records), 'files': self.records,
        }))

    def run_clone(self, destination=None):
        return subprocess.run([sys.executable, str(SCRIPT), '--source', str(self.source),
                               '--output', str(destination or self.base/'clone')],
                              capture_output=True, text=True)

    def test_copia_completa_non_copia_privati_e_non_modifica_sorgente(self):
        r = self.run_clone()
        self.assertEqual(r.returncode, 0, r.stderr)
        dest = self.base/'clone'
        self.assertEqual((dest/'client/src/App.tsx').read_text(), 'export const fixture = 1;')
        self.assertTrue((dest/'.env.example').exists())
        self.assertFalse((dest/'.env').exists())
        self.assertFalse((dest/'data').exists())
        self.assertFalse((dest/'MANIFEST-SHA256.json').exists())
        self.assertTrue((self.source/'data/session.json').exists())

    def test_rifiuta_destinazione_esistente_senza_modificarla(self):
        target = self.base/'exists'
        target.mkdir()
        (target/'mio-file').write_text('da preservare')
        self.assertNotEqual(self.run_clone(target).returncode, 0)
        self.assertEqual((target/'mio-file').read_text(), 'da preservare')

    def test_rifiuta_manomissione_manifest(self):
        (self.source/'client/src/App.tsx').write_text('diverso')
        self.assertNotEqual(self.run_clone().returncode, 0)
        self.assertFalse((self.base/'clone').exists())

    def test_rifiuta_percorso_pericoloso(self):
        self.records.append({'path': '../escape', 'size': 0, 'sha256': '0'*64})
        self.write_manifest()
        self.assertNotEqual(self.run_clone().returncode, 0)
        self.assertFalse((self.base/'clone').exists())

    def test_rifiuta_symlink(self):
        p = self.source/'client/src/App.tsx'
        p.unlink()
        p.symlink_to(self.source/'package.json')
        self.assertNotEqual(self.run_clone().returncode, 0)
        self.assertFalse((self.base/'clone').exists())

    def test_rifiuta_sorgente_dentro_se_stessa(self):
        self.assertNotEqual(self.run_clone(self.source/'figlia').returncode, 0)
        self.assertFalse((self.source/'figlia').exists())


if __name__ == '__main__':
    unittest.main()

