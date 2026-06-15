#!/usr/bin/env bash
# Assemble the deployable site into dist/ — no build tooling, just a clean copy
# of exactly the files the browser needs (keeps private/backup files out).
set -e
cd "$(dirname "$0")"
rm -rf dist
mkdir -p dist
cp index.html manifest.webmanifest favicon.svg robots.txt CHANGELOG.md vercel.json dist/
cp -R css js dist/
echo "dist/ ready ($(find dist -type f | wc -l | tr -d ' ') files) — drag the dist/ folder onto your host."
