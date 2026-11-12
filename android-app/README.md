# Saafera Android app (Capacitor)

A real Android project that loads **https://saafera.com** and adds phone features around it. It is separate from `../mobile/`
(the Play Store Trusted Web Activity); both use the package name `com.saafera.app`.

## What the app adds on top of the website

| Feature | How it works |
|---|---|
| **Saved trips offline** | `src/components/app/NativeBridge.tsx` copies saved trips and the trip cart into the app's storage. With no internet, the app opens `www/offline.html`, which shows them (read through `MainActivity.java`). It returns to the site by itself when the network is back. |
| **Native share sheet** | The website's Share buttons use `navigator.share`, which the app replaces with Android's share sheet. |
| **Back button** | Goes back through pages; leaves the app from the first screen. |
| **Native location** | Android location permission (asked at first use) for "near me" places, distances and weather. |
| **Splash screen, status bar, icon** | Native; see `capacitor.config.json` and `scripts/make-icons.cjs`. |
| **Google sign-in** | Google refuses its web sign-in page inside an embedded browser, so the app opens Android's own Google account picker (`@capgo/capacitor-social-login`, see `MobileLogin.tsx`) and sends the ID token to the same server check as the website. Needs an **Android OAuth client** in Google Cloud (package `com.saafera.app` + the signing key's SHA-1) in the same project as the web client in `AUTH_GOOGLE_ID`. |

Anything on the website itself updates for app users as soon as you deploy the site. Rebuild the app only when you change
`android-app/` or the native plugins.

## Build

```
cd android-app
npm install
npx cap sync android
cd android
gradlew.bat assembleRelease bundleRelease     # JDK 17; outputs in app/build/outputs/
```

Release signing reads `android/keystore.properties` (git-ignored):

```
storeFile=D:/path/to/android.keystore
keyAlias=android
storePassword=...
keyPassword=...
```

Without that file the release build is unsigned. Raise `versionCode` in `android/app/build.gradle` for every store upload.

## Testing against a local site

Point `capacitor.config.json` at `http://10.0.2.2:<port>` (the emulator's name for your computer), set `"cleartext": true`, add `10.0.2.2` to
`allowNavigation`, run `npx cap sync android`, build `assembleDebug`, then put the file back. Do not ship that config.
