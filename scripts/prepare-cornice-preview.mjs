// Produce una pagina di prova dalla cornice Blogger effettiva. L'app aperta
// dalla pagina di prova è SEMPRE quella dello stesso ambiente che la serve.
// Il file Blogger pronto da copiare conserva invece l'URL di produzione.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'cornice-dinamica/embed-espressioni-dedicata.html');
const target=path.join(root,'client/public/anteprima-cornice.html');
const production="var APP_URL = 'https://espressioni-monomi-polinomi.easy-peasy.site/';";
const dynamic="var APP_URL = window.location.origin + '/';";
let frame=await readFile(source,'utf8');
if(frame.split(production).length!==2) throw new Error('APP_URL della cornice dedicata assente o duplicato');
frame=frame.replace(production,dynamic).replaceAll('https://espressioni-monomi-polinomi.easy-peasy.site/fonts/','/fonts/');
const html=`<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Anteprima della cornice — Widget Metacognitivo</title>
<style>
  body { margin:0; background:#fff; color:#2e2018; font-family:Georgia,serif; }
  main { max-width:840px; margin:0 auto; padding:16px; }
  .nota-anteprima { margin:0 0 12px; padding:10px 12px; border:1px solid #dedbd6; border-radius:10px; background:#fdfbf8; color:#2e2018; font-size:14px; line-height:1.5; }
</style>
</head>
<body>
<main>
<p class="nota-anteprima">Cornice di prova: mostra l'app dell'ambiente corrente. Il post del blog non viene modificato da questa pagina.</p>
${frame}
</main>
</body>
</html>
`;
if(process.argv.includes('--check')) {
  const existing=await readFile(target,'utf8').catch(()=>null);
  if(existing!==html){console.error('Anteprima cornice non aggiornata: eseguire node scripts/prepare-cornice-preview.mjs');process.exit(1);}
  console.log('Anteprima della cornice coerente con il file Blogger.');
} else {
  await writeFile(target,html,'utf8');
  console.log('Anteprima della cornice aggiornata dallo snippet dedicato.');
}

