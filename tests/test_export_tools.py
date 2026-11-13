"""Packaging tests (stdlib); no API/database, no app build or user data."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

exp = load('exp_under_test', ROOT/'scripts/export-verified.py')
ver = load('ver_under_test', ROOT/'scripts/verify-package.py')

class PackagingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='package-tools-')
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.repo = self.base/'repo'
        self.repo.mkdir()
        for rel in exp.REQUIRED:
            p = self.repo/rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text('EASY_PEASY_API_KEY=\nDATABASE_URL=\n' if rel == '.env.example' else 'fixture\n')
        (self.repo/'patches').mkdir()
        (self.repo/'patches/test.patch').write_text('synthetic fixture\n')
        subprocess.run(['git','init','-q',str(self.repo)],check=True)
        self.git('config','user.name','Packaging test')
        self.git('config','user.email','fixture@example.invalid')
        self.git('add','.')
        self.git('commit','-qm','synthetic fixture')
        self.archive = self.base/'app.zip'

    def git(self, *args):
        return subprocess.run(['git','-C',str(self.repo),*args],check=True,stdout=subprocess.DEVNULL)

    def build(self):
        return exp.export(self.repo, self.archive, 'app', 9052)

    def changed_archive(self, name, payload):
        other = self.base/'changed.zip'
        with zipfile.ZipFile(self.archive) as a, zipfile.ZipFile(other,'w') as b:
            for n in a.namelist():
                if n != name:
                    b.writestr(n,a.read(n))
            b.writestr(name,payload)
        return other

    def test_release_9055_requires_symbolic_powers_and_correct_bundle(self):
        for name in ['docs/DEPLOY-9096.md', 'client/src/lib/periodicNotation.ts',
                     'client/src/lib/periodicPhotoRegression.test.ts',
                     'docs/DEPLOY-9094.md', 'docs/DEPLOY-9073.md', 'docs/DEPLOY-9062.md', 'docs/DEPLOY-9058.md', 'docs/DEPLOY-9055.md',
                     'docs/DEPLOY-9052.md', 'docs/DEPLOY-9038.md',
                     'docs/DEPLOY-9033.md',
                     'docs/COLLAUDO-PDF-PRIMO-COLPO-ANTEPRIMA.md',
                     'tests/pdf-intestazione.e2e.mjs', 'tests/FRATTE-FOTO.md',
                     'tests/fratte-foto-iframe.e2e.mjs',
                     'client/src/lib/potenze-simboliche.test.ts',
                     'client/src/lib/appNotationLatex.ts',
                     'client/src/lib/appNotationLatex.test.ts',
                     'server/frazioniLetteraliGuidate.ts',
                     'server/frazioniLetteraliGuidate.test.ts',
                     'server/trascrizioneFratte.test.ts']:
            self.assertIn(name, exp.REQUIRED)
        # 9073: bundle con verifica a sostituzione + healing server-side
        self.assertNotIn('assets/index-ChrQq2K_.js', ver.APPROVED)
        self.assertNotIn('assets/index-a9KvYjRF.css', ver.APPROVED)
        # 9162: MOSTRA SOLUZIONE e notazione calcolatrice (bundle storico).
        self.assertNotIn('assets/index-7-1XbvsP.js', ver.APPROVED)
        # 9212: condizioni aggiuntive e ramo senza moduli.
        self.assertNotIn('assets/index-BL9EkuY6.js', ver.APPROVED)
        # 9212: bundle storico dopo la 9213 (lettura accessibile di formule e pulsanti).
        self.assertNotIn('assets/index-BqWdPZnL.js', ver.APPROVED)
        self.assertNotIn('assets/index-CU5iKsjL.css', ver.APPROVED)
        for n in ['docs/DEPLOY-9212.md', 'client/src/lib/ramoCondizionato.ts',
                  'client/src/lib/ramoCondizionato.test.ts', 'client/src/lib/moduliSottintesi.ts']:
            self.assertIn(n, exp.REQUIRED)
        self.assertIn('docs/DEPLOY-9213.md', exp.REQUIRED)
        self.assertEqual(ver.APPROVED.get('assets/index-DwZngAFT.js'),
                         'dbf636ec7467ae49ab7d23765a76d26a370b35ea26c91c59e7d916bb6bc0a180')
        self.assertEqual(ver.APPROVED.get('assets/index-CTH_tEWo.css'),
                         '545c02d9c3cd38b07cf01891f1d25ba0bbdf98363e602bf612d2debaee8794b3')
        for n in ['GUIDA-IA-CLONAZIONE-EQUAZIONI.md', 'scripts/clona-app-equazioni.py',
                  'tests/test_clone_equazioni.py', 'client/src/lib/soluzioneCalcolatrice.ts']:
            self.assertIn(n, exp.REQUIRED)
        self.assertNotIn('assets/index-CGwBWSS5.js', ver.APPROVED)
        self.assertNotIn('assets/index-HnG9x97T.js', ver.APPROVED)
        self.assertNotIn('assets/index-Dpnp3kZL.js', ver.APPROVED)
        self.assertNotIn('assets/index-D6pcemJP.css', ver.APPROVED)
        self.assertNotIn('assets/index-D-0ZrcU9.js', ver.APPROVED)

    def test_active_guides_match_release_9213(self):
        guides = {
            'ADATTARE.md': 'Baseline funzionale pubblicata: 9213',
            'RENDER.md': 'baseline pubblicata 9213',
            'ACCESSIBILITA.md': 'Stato corrente: produzione 9213',
            'README.md': 'Produzione corrente:** deploy Easy-Peasy **9213',
            'REBUILD.md': 'versione pubblicata 9213',
        }
        for name, expected in guides.items():
            self.assertIn(expected, (ROOT/name).read_text(encoding='utf-8')[:700], name)

    def test_exclusions(self):
        for n in ['.env','.env.production','shared/env.generated.ts','dist/index.js',
                  'node_modules/a.js','data/session.json','client/diag-89.ts','x.log']:
            self.assertIsNotNone(exp.exclusion(n),n)
        for n in ['.env.example','client/public/models/m.onnx','patches/a.patch',
                  'tests/fixtures/photo-crop/demo.tsx','scripts/verify-package.py']:
            self.assertIsNone(exp.exclusion(n),n)

    def test_known_secret_refused(self):
        with self.assertRaises(RuntimeError):
            exp.verify_payload('fixture.txt',b'synthetic-value-for-test',{b'synthetic-value-for-test'})

    def test_private_key_signature_refused(self):
        fake = b'-----BEGIN ' + b'PRIVATE KEY-----'
        with self.assertRaises(RuntimeError):
            exp.verify_payload('fixture.txt',fake,set())

    def test_nonempty_env_example_refused(self):
        with self.assertRaises(RuntimeError):
            exp.verify_payload('.env.example',b'EASY_PEASY_API_KEY=synthetic\n',set())
        exp.verify_payload('.env.example',b'EASY_PEASY_API_KEY=\n',set())

    def test_dirty_repo_refused(self):
        (self.repo/'untracked.txt').write_text('not committed')
        with self.assertRaises(RuntimeError):
            self.build()

    def test_output_inside_repo_refused(self):
        with self.assertRaises(RuntimeError):
            exp.export(self.repo,self.repo/'out.zip','app',9038)

    def test_unsafe_prefix_refused(self):
        with self.assertRaises(RuntimeError):
            exp.export(self.repo,self.archive,'../escape',9038)

    def test_clean_export_and_manifest(self):
        r = self.build()
        m, report = ver.verify_archive(self.archive)
        self.assertEqual(report['payload_files'],len(exp.REQUIRED)+1)
        self.assertEqual(report['zip_file_entries_including_manifest'],len(m['files'])+1)
        self.assertEqual(m['payload_file_count'],len(m['files']))
        self.assertEqual(m['production_deployment'],9052)
        self.assertEqual(r['sha256'],hashlib.sha256(self.archive.read_bytes()).hexdigest())

    def test_tampered_payload_refused(self):
        self.build()
        altered = self.changed_archive('app/README.md',b'modified')
        with self.assertRaises(ValueError):
            ver.verify_archive(altered)

    def test_unlisted_entry_refused(self):
        self.build()
        altered = self.changed_archive('app/unlisted.txt',b'extra')
        with self.assertRaises(ValueError):
            ver.verify_archive(altered)

    def test_traversal_refused(self):
        self.build()
        altered = self.changed_archive('../escape.txt',b'unsafe')
        with self.assertRaises(ValueError):
            ver.verify_archive(altered)

    def test_duplicate_entry_refused(self):
        self.build()
        with zipfile.ZipFile(self.archive,'a') as z:
            z.writestr('app/README.md',b'duplicate')
        with self.assertRaises(ValueError):
            ver.verify_archive(self.archive)

    def test_rebuild_never_overwrites(self):
        self.build()
        m, _ = ver.verify_archive(self.archive)
        with self.assertRaises(ValueError):
            ver.rebuild(self.archive,self.repo,m,None)

    def test_cornice_matches_observed_blogger_snapshot(self):
        cornice = ROOT/'cornice-dinamica/embed-espressioni-dedicata.html'
        self.assertEqual(hashlib.sha256(cornice.read_bytes()).hexdigest(),ver.BLOG_FRAME_SHA256)

    def test_rebuild_refuses_wrong_blogger_snapshot(self):
        self.build()  # archivio con fixture sintetica, non la cornice pubblica
        m, _ = ver.verify_archive(self.archive)
        with self.assertRaisesRegex(ValueError,'Cornice differs'):
            ver.rebuild(self.archive,self.base/'new-destination',m,None)

    def test_log_colours_are_removed_for_parsing(self):
        import re
        text = '\x1b[2m      Tests \x1b[22m \x1b[1m\x1b[32m1286 passed\x1b[39m\x1b[22m | \x1b[33m28 skipped\x1b[39m'
        plain = ver.plain_log(text)
        self.assertIsNotNone(re.search(r'Tests\s+1286 passed', plain))
        self.assertIsNotNone(re.search(r'Tests.*?28 skipped', plain))
        self.assertEqual(ver.plain_log('\x1b[31m FAIL \x1b[0m test'), ' FAIL  test')

    def test_safe_environment(self):
        env = ver.safe_environment()
        self.assertEqual(env['NODE_ENV'],'production')
        self.assertEqual(env['FORCE_COLOR'],'0')
        self.assertEqual(env['NO_COLOR'],'1')
        self.assertNotIn('WIDGET_STORAGE_DIR', env)
        for k in env:
            self.assertIsNone(__import__('re').search(r'API_?KEY|TOKEN|SECRET|DATABASE_URL|^VITE_',k,__import__('re').I))

if __name__ == '__main__':
    unittest.main()

