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
        return exp.export(self.repo, self.archive, 'app', 8756)

    def changed_archive(self, name, payload):
        other = self.base/'changed.zip'
        with zipfile.ZipFile(self.archive) as a, zipfile.ZipFile(other,'w') as b:
            for n in a.namelist():
                if n != name:
                    b.writestr(n,a.read(n))
            b.writestr(name,payload)
        return other

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
            exp.export(self.repo,self.repo/'out.zip','app',8756)

    def test_unsafe_prefix_refused(self):
        with self.assertRaises(RuntimeError):
            exp.export(self.repo,self.archive,'../escape',8756)

    def test_clean_export_and_manifest(self):
        r = self.build()
        m, report = ver.verify_archive(self.archive)
        self.assertEqual(report['payload_files'],len(exp.REQUIRED)+1)
        self.assertEqual(report['zip_file_entries_including_manifest'],len(m['files'])+1)
        self.assertEqual(m['payload_file_count'],len(m['files']))
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

    def test_safe_environment(self):
        env = ver.safe_environment()
        self.assertEqual(env['NODE_ENV'],'production')
        for k in env:
            self.assertIsNone(__import__('re').search(r'API_?KEY|TOKEN|SECRET|DATABASE_URL|^VITE_',k,__import__('re').I))

if __name__ == '__main__':
    unittest.main()

