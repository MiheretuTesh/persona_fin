# Building Equilibrium APK

Two paths. **EAS Build** is the no-friction cloud path — install one CLI, sign in, run one command, download the APK when it's done. **Local** uses your machine's Android SDK + Gradle — zero cloud cost, slightly more setup.

---

## Path A — EAS Build (recommended)

### 1. One-time account setup

```bash
# Global CLI
npm i -g eas-cli

# Sign in (creates a free Expo account if you don't have one).
# APKs on the free tier take a few minutes and queue behind other builds.
eas login

# Generates an EAS project ID, writes it into app.json → extra.eas.projectId.
# Do this from the project root.
eas init
```

After `eas init`, open `app.json` and confirm **two** places got the project id:
- `expo.extra.eas.projectId`
- `expo.updates.url` (should be `https://u.expo.dev/<that-id>`)

The second was a placeholder in this repo; `eas init` replaces it automatically.

### 2. Make sure credentials are present

EAS Build runs on a clean cloud VM — it doesn't have your local `.env`. You've got two options for `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`:

**Option A — inline in `eas.json` (fine for non-secret values)**

The Supabase anon key is public by design (RLS is what actually protects data), so it's acceptable to commit. Open `eas.json` and add them under the profile:

```json
"preview": {
  "distribution": "internal",
  "android": { "buildType": "apk" },
  "env": {
    "APP_VARIANT": "preview",
    "EXPO_PUBLIC_SUPABASE_URL": "https://YOUR-PROJECT-REF.supabase.co",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJhbGci…"
  }
}
```

**Option B — EAS Secrets (cleaner, not committed)**

```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://…"
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ…"
```

Then leave `eas.json` free of those keys; EAS injects them.

### 3. Preflight + build

```bash
# Local sanity checks (assets, env, app.json)
npm run preflight

# Kick off the APK build. First time prompts you to let EAS create a keystore —
# say yes. It's stored server-side and reused for every future build.
npm run build:android:preview
```

You'll get a URL that streams the build logs. When it finishes (usually 8–15 min on free tier), EAS gives you a signed APK download link. Transfer to an Android device, enable "Install from unknown sources" for the source app, and install.

### 4. Building for Play Store later

```bash
# AAB (Android App Bundle), signed, production channel
npm run build:android:production

# Submit to Play Console internal track
eas submit --platform android --profile production --latest
```

---

## Path B — Local build (no EAS account)

### Prerequisites

- **JDK 17** — `brew install openjdk@17` then follow the brew hint to link it. Verify with `java -version` (must say `openjdk version "17"`).
- **Android SDK** — easiest via Android Studio. Install Android Studio → open → SDK Manager → install Android 14 (API 35) + Android SDK Platform-Tools.
- Set env vars in `~/.zshrc` (or your shell rc):
  ```
  export ANDROID_HOME="$HOME/Library/Android/sdk"
  export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
  ```

### Build a release APK locally

```bash
# Generates the android/ folder from app.json. Idempotent.
npx expo prebuild --platform android --clean

cd android
./gradlew assembleRelease
# APK lands at: android/app/build/outputs/apk/release/app-release.apk
```

The first build takes 5–15 min while Gradle downloads the world. Subsequent builds are much faster.

This uses a debug-style signing key by default — **fine for sideloading and testing, not accepted by Google Play**. For Play Store, you need a real keystore; that's where EAS Build becomes worth the 5 minutes of setup.

### Install on a connected phone

```bash
# Enable USB debugging on your phone first: Settings → Developer options → USB debugging
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

---

## Troubleshooting

**`eas init` fails with "not logged in"** — Run `eas login` first. Needs your Expo account credentials.

**Preflight says "EXPO_PUBLIC_SUPABASE_URL missing"** — Copy `.env.example` to `.env` and fill in both values from Supabase dashboard → Project Settings → API.

**Gradle build fails on "compileSdk 35 not found"** — Android SDK Platform 35 isn't installed. Open Android Studio → SDK Manager → SDK Platforms → check **Android 14.0 (UpsideDownCake)** → Apply.

**APK installs but crashes on launch** — Almost always missing env vars. Open the build's Logs tab (EAS) or run `adb logcat -s ReactNativeJS` (local) and look for the line from `src/lib/supabase.ts` complaining about `EXPO_PUBLIC_SUPABASE_URL`.

**"No development build installed" when running `expo start`** — That message is only shown in dev. For release APKs it doesn't apply. We removed `expo-dev-client` from deps already; if you ever want a local dev client, `npm i expo-dev-client` and then `npx expo run:android`.

---

## What's *not* in this guide

- **iOS builds** — `npm run build:ios:preview` works but needs an Apple Developer account ($99/year). EAS generates the certs for you.
- **OTA updates** — Already configured in `app.json` (`runtimeVersion` + `updates.url`). After your first `eas init`, running `eas update --branch preview --message "…"` ships a JS-only update to installed devices without a new APK build.
- **Play Store listing assets** — screenshots, feature graphic, etc. Those are Play Console work, not build work.
