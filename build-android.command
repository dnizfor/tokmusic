#!/bin/bash
# Double-click: installs deps and sends an Android APK build to Expo (EAS).
cd "$(dirname "$0")"
echo "== npm install =="
npm install || { echo "npm install failed"; read -p "Press Enter to close"; exit 1; }
echo "== EAS build (preview APK) =="
npx -y eas-cli@latest build -p android --profile preview
echo
read -p "Done. Press Enter to close"
