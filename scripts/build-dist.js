#!/usr/bin/env node
/* Assemble the desktop app's web bundle into dist/ — no bundler, no transforms, just
   a clean copy of exactly the files the webview needs. Tauri embeds this folder into
   the desktop binary (src-tauri/tauri.conf.json → build.frontendDist), so anything
   not copied here is not shipped. Runs automatically before `tauri dev` / `tauri
   build` (build.beforeDevCommand / beforeBuildCommand); works on macOS, Windows and
   Linux because the Tauri CLI already needs Node. */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const FILES = ['index.html', 'favicon.svg', 'manifest.webmanifest'];
const DIRS  = ['css', 'js', 'fonts', 'vendor'];
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(root, f), path.join(dist, f));
for (const d of DIRS) fs.cpSync(path.join(root, d), path.join(dist, d), { recursive: true });
let n = 0; (function count(p){ for (const e of fs.readdirSync(p, { withFileTypes: true })) e.isDirectory() ? count(path.join(p, e.name)) : n++; })(dist);
console.log(`dist/ ready (${n} files)`);
