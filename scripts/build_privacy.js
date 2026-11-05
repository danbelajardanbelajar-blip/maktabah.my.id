// Publish the same policy component as HTML so it works without JavaScript or login.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = path.join(root, 'node_modules/.cache/maktabah-privacy');
await fs.mkdir(cache, { recursive: true });
const compiled = ts.transpileModule(await fs.readFile(path.join(root, 'src/components/Privacy.tsx'), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const modulePath = path.join(cache, 'Privacy.mjs');
await fs.writeFile(modulePath, compiled);
const { default: Privacy } = await import(pathToFileURL(modulePath).href);
const html = `<!doctype html>
<html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kebijakan Privasi — al Maktabah as Sunniyyah</title>
<meta name="description" content="Kebijakan Privasi layanan al Maktabah as Sunniyyah dan kontak pengelola.">
<link rel="canonical" href="https://maktab.my.id/privacy-policy">
<style>
*{box-sizing:border-box}body{margin:0;background:#f0fdf4;color:#334155;font:16px/1.75 system-ui,sans-serif}
header,main,footer{max-width:900px;margin:auto;padding:24px}header a,footer a{color:#047857}
main{background:white;border-radius:16px;box-shadow:0 2px 12px #0001;margin-bottom:24px;padding:32px}
h1{font-size:30px;color:#065f46;line-height:1.3}h2{font-size:21px;color:#065f46;margin-top:32px}
a{color:#047857;overflow-wrap:anywhere}li{margin:8px 0}section{margin-top:28px}p{margin:12px 0}
@media(max-width:600px){main{padding:20px;border-radius:0}header,footer{padding:20px}h1{font-size:26px}}
</style></head><body>
<header><a href="/">← Kembali ke al Maktabah as Sunniyyah</a></header>
<main>${renderToStaticMarkup(React.createElement(Privacy))}</main>
<footer><a href="/">maktab.my.id</a></footer></body></html>`;
await fs.mkdir(path.join(root, 'dist/privacy-policy'), { recursive: true });
await fs.writeFile(path.join(root, 'dist/privacy-policy/index.html'), html);
await fs.writeFile(path.join(root, 'dist/privacy-policy.html'), html);
console.log('Published standalone privacy policy HTML.');
