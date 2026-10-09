#!/usr/bin/env bash
# Loads a built package the way its consumers do: osrs-tracker-api requires the CommonJS build and osrs-tracker-web
# imports the ESM build. Run from the package folder after `npm run build`. Packages without an `exports` map are
# skipped. Temp files go to $TMPDIR (mktemp).
set -euo pipefail

if [ "$(node -p "'exports' in require('./package.json')")" != true ]; then
  echo "No exports map in package.json, skipping."
  exit 0
fi

name=$(node -p "require('./package.json').name")

echo "Loading the dist folders directly"
node -e "require('./dist/cjs/index.js')"
node --input-type=module -e "await import('./dist/esm/index.js')"

# Through the exports map, as a consumer sees it: install the packed tarball in an empty project. Peer dependencies
# from this repo (hiscores needs models) are built and packed from their folder next to this one (dist isn't committed)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
tarballs=("$tmp/$(npm pack --silent --pack-destination "$tmp")")
for peer in $(node -p "Object.keys(require('./package.json').peerDependencies ?? {}).join(' ')"); do
  case $peer in
    @osrs-tracker/*)
      (cd "../${peer#@osrs-tracker/}" && npm ci --silent --no-audit --no-fund && npm run build --silent > /dev/null)
      tarballs+=("$tmp/$(cd "../${peer#@osrs-tracker/}" && npm pack --silent --pack-destination "$tmp")")
      ;;
  esac
done

mkdir "$tmp/consumer"
cd "$tmp/consumer"
npm init -y > /dev/null
npm install --no-audit --no-fund "${tarballs[@]}"

echo "Loading $name by package name"
node -e "require('$name')"
node --input-type=module -e "await import('$name')"
echo "$name loads with require and import."
