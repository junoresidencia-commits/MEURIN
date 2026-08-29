#!/usr/bin/env bash
# Gera o atalho Meu Rim.app (ZIP) para o Mac.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/downloads"
APP="$OUT/Meu Rim.app"
URL="${MEURIM_APP_URL:-https://meurim.vercel.app}"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$ROOT/public/icons/icon-512.png" "$APP/Contents/Resources/AppIcon.png"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>Meu Rim</string>
  <key>CFBundleDisplayName</key>
  <string>Meu Rim</string>
  <key>CFBundleIdentifier</key>
  <string>br.meurim.app</string>
  <key>CFBundleVersion</key>
  <string>1.0</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleExecutable</key>
  <string>MeuRim</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

cat > "$APP/Contents/MacOS/MeuRim" <<EOF
#!/bin/bash
URL="${URL}/?source=macapp"
if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --app="\$URL"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -na "Microsoft Edge" --args --app="\$URL"
else
  open -a Safari "\$URL"
fi
EOF
chmod +x "$APP/Contents/MacOS/MeuRim"

cat > "$OUT/LEIA-ME-Mac.txt" <<'TXT'
Meu Rim para Mac
================

Opção 1 (melhor, nativa do Safari)
  Abra https://meurim.vercel.app no Safari
  Menu Arquivo → Adicionar ao Dock…

Opção 2 (este ZIP)
  1. Extraia o ZIP
  2. Arraste "Meu Rim.app" para a pasta Aplicativos
  3. Clique com o botão direito → Abrir
     (o Mac pede isso na primeira vez porque o atalho não vem da App Store)

O atalho abre o Meu Rim em janela de aplicativo.
TXT

cd "$OUT"
rm -f Meu-Rim-Mac.zip
zip -r Meu-Rim-Mac.zip "Meu Rim.app" LEIA-ME-Mac.txt
rm -rf "$APP"
echo "Gerado: $OUT/Meu-Rim-Mac.zip"
