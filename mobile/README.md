# Saafera — Android app (Trusted Web Activity)

This folder is a self-contained Android project that wraps the live
`https://saafera.com` website in a **Trusted Web Activity (TWA)** — Google's
official pattern for shipping an existing PWA to the Play Store. It renders
through Chrome itself (not a generic WebView), so it reuses 100% of the real
web app's UI. There is no separate mobile codebase to maintain: any change
you deploy to the website shows up in the app automatically.

## What's already done

- The main web app (`../public/manifest.webmanifest`, `../public/sw.js`,
  `../public/icons/`, `../public/.well-known/assetlinks.json`) has everything
  needed for this to work, once deployed.
- `android.keystore` — the release signing key for this app — already exists
  in this folder (gitignored, see **Back this up** below).
- `public/.well-known/assetlinks.json` already contains this keystore's
  SHA-256 fingerprint, matching `packageId: com.saafera.app` in
  `twa-manifest.json`. This is what lets Android verify the app and the
  website are the same publisher (removes the browser URL bar from the app).
- A signed release build already works end-to-end on this machine —
  `app-release-signed.apk` and `app-release-bundle.aab` (the format Play
  Store wants) were both produced successfully.

## ⚠️ Back up the keystore — do this now

`android.keystore` + `keystore.password.txt` are gitignored (signing keys
must never be committed). **If you lose them, you can never publish an
update to this app again under the same identity** — Play Store would treat
a re-signed app as a totally different app. Copy both files somewhere safe
(password manager, encrypted drive, etc.) before doing anything else.

## Rebuilding

```
cd mobile
npm install        # installs the pinned bubblewrap CLI + applies the patch below
npm run build       # produces app-release-signed.apk and app-release-bundle.aab
```

You'll be prompted once: *"No checksum file was found... regenerate your
project?"* — answer **yes** if you changed `twa-manifest.json` or the site's
manifest/icons, **no** if you just want to rebuild as-is.

`BUBBLEWRAP_KEYSTORE_PASSWORD` / `BUBBLEWRAP_KEY_PASSWORD` env vars (read
from `keystore.password.txt`) avoid the interactive password prompt — see
`package.json`'s `build` script, or set them yourself:

```
$env:BUBBLEWRAP_KEYSTORE_PASSWORD = (Get-Content keystore.password.txt -Raw).Trim()
$env:BUBBLEWRAP_KEY_PASSWORD = $env:BUBBLEWRAP_KEYSTORE_PASSWORD
npx bubblewrap build --skipPwaValidation
```

**Use PowerShell, not Git Bash**, to run bubblewrap on Windows — see the next
section for why.

## Known upstream bug — patched via `patch-package`

Bubblewrap's Windows path handling has two bugs that break a fresh build on
Windows (both hit during this project's initial setup):

1. `GradleWrapper` invokes a bare `gradlew.bat` instead of `.\gradlew.bat`,
   which `child_process.execFile(..., {shell:true})` can't resolve from the
   current directory on Windows.
2. `JdkHelper.runJava` (used for `apksigner`) doesn't quote the `java.exe`
   path, which breaks as soon as the JDK is installed somewhere with a space
   in the path (e.g. `C:\Program Files\...`, the default install location).

Both are fixed in `patches/@bubblewrap+core+1.24.1.patch`, applied
automatically by the `postinstall` script after `npm install`. If you ever
upgrade the pinned `@bubblewrap/cli` version, regenerate the patch:
edit the two files under `node_modules/@bubblewrap/core/dist/lib/` the same
way, then run `npx patch-package @bubblewrap/core`.

Also note: on Windows, invoking Bubblewrap from **Git Bash** hits additional
`.bat`-file quoting issues beyond the two patched above (a Git Bash/MSYS
quirk, not fixable in the package) — always run `npm run build` from
PowerShell or cmd.exe.

## What's still needed (manual — can't be automated from here)

1. **Create a Google Play Console developer account** (one-time $25 fee) at
   https://play.google.com/console if you haven't already.
2. **Deploy the web app** (your normal flow) so `saafera.com` actually serves
   `manifest.webmanifest`, `sw.js`, `/icons/*`, and
   `/.well-known/assetlinks.json` — the TWA won't show the verified,
   no-URL-bar experience until these are live.
3. **Create the app listing** in Play Console: package name
   `com.saafera.app`, upload `app-release-bundle.aab`, fill in the store
   listing (screenshots, description, privacy policy URL, content rating,
   etc.), and submit for review.
4. After that first release, version bumps are just: bump
   `appVersionCode`/`appVersionName` in `twa-manifest.json` (or let
   `npm run build` prompt you), rebuild, and upload the new `.aab` as a new
   release in Play Console.
