# PR: PWA Manifest (TASK-P5-006)

## 📝 Description
Added `manifest.json` and linked it in `index.html` to enable PWA installation.
Configured theme color, background color, and icons.

## 🔗 Linked Tasks
- [x] TASK-P5-006: PWA Manifest & Icons

## 🛠️ Changes
- `manifest.json`: Created with standard PWA properties.
- `index.html`: Added `<link rel="manifest" href="/manifest.json" />`.
- `assets/icons/`: Directory created (using existing logo/logo_icon.png as placeholder in manifest).

## ✅ Verification
- [x] Browser detects manifest (Application tab in DevTools).
- [x] "Install App" prompt available (if criteria met).
