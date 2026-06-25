#!/usr/bin/env bash
# Copies the built plugin into Tabby's plugin directory (macOS / Linux).
set -e

root="$(cd "$(dirname "$0")/.." && pwd)"
if [ ! -f "$root/dist/index.js" ]; then
  echo "dist/index.js not found - run 'npm run build' first." >&2
  exit 1
fi

case "$(uname)" in
  Darwin) dest="$HOME/Library/Application Support/tabby/plugins/node_modules/tabby-pane-titles" ;;
  *)      dest="$HOME/.config/tabby/plugins/node_modules/tabby-pane-titles" ;;
esac

mkdir -p "$dest/dist"
cp "$root/package.json" "$dest/"
cp -R "$root/dist/"* "$dest/dist/"

echo "Installed to $dest"
echo "Restart Tabby to load the plugin."
