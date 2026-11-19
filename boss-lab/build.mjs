// neon-boss-lab.html (artifact form: no <html>/<head>) -> index.html (standalone page for GitHub)
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('./neon-boss-lab.html', import.meta.url), 'utf8');
const out = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="theme-color" content="#07050f">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>
</head>
<body>
${src}
</body>
</html>
`;
writeFileSync(new URL('./index.html', import.meta.url), out);
console.log('wrote index.html', out.length, 'bytes');
