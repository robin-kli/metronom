#!/usr/bin/env bash
# Installs the packaged AppImage for the current user with a launcher entry and a desktop icon.
# Run after `npm run package`:  npm run install:desktop
set -euo pipefail

cd "$(dirname "$0")/.."

shopt -s nullglob
images=(release/metronom-*.AppImage)
if [ ${#images[@]} -ne 1 ]; then
  echo "install:desktop: expected exactly one release/metronom-*.AppImage — run 'npm run package' first." >&2
  exit 1
fi

apps_dir="$HOME/Applications"
icon_dir="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/512x512/apps"
launcher_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
desktop_dir="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
appimage="$apps_dir/metronom.AppImage"

mkdir -p "$apps_dir" "$icon_dir" "$launcher_dir"
install -m 755 "${images[0]}" "$appimage"
install -m 644 build/icon.png "$icon_dir/metronom.png"

entry="$launcher_dir/metronom.desktop"
cat > "$entry" <<EOF
[Desktop Entry]
Type=Application
Name=metronom
Comment=Minimal speed-trainer metronome
Exec="$appimage" %U
Icon=metronom
Terminal=false
Categories=AudioVideo;Audio;
StartupWMClass=metronom
EOF
chmod 755 "$entry"
update-desktop-database "$launcher_dir" 2>/dev/null || true
gtk-update-icon-cache -q "${icon_dir%/512x512/apps}" 2>/dev/null || true

if [ -d "$desktop_dir" ]; then
  install -m 755 "$entry" "$desktop_dir/metronom.desktop"
  # GNOME (Desktop Icons NG) only launches desktop files marked as trusted.
  gio set "$desktop_dir/metronom.desktop" metadata::trusted true 2>/dev/null || true
fi

echo "Installed $appimage"
echo "Launcher: $entry"
[ -d "$desktop_dir" ] && echo "Desktop icon: $desktop_dir/metronom.desktop"
