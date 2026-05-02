# APK Internal Component Map

- APK: `/Users/bubble3/Library/Containers/ru.keepcoder.Telegram/Data/tmp/app-release.apk`
- App: **TechForum 2026**
- Package: `com.psy_lololo.conferenceapp`
- Version: `1.0.0` (code `1`)
- SDK: min `24`, target `36`
- MainActivity: `com.psy_lololo.conferenceapp.MainActivity`

## 1) Android Entry Components
### Activitys
- `com.psy_lololo.conferenceapp.MainActivity` | exported=true
  - actions: android.intent.action.MAIN
  - categories: android.intent.category.LAUNCHER
  - actions: android.intent.action.VIEW
  - categories: android.intent.category.DEFAULT, android.intent.category.BROWSABLE
  - data: [{'android:scheme': 'conference-app'}]
- `expo.modules.imagepicker.ExpoCropImageActivity` | exported=false
- `com.canhub.cropper.CropImageActivity` | exported=true
- `com.google.android.gms.common.api.GoogleApiActivity` | exported=false

### Services
- `com.google.android.gms.metadata.ModuleDependencies` | exported=false
  - actions: com.google.android.gms.metadata.MODULE_DEPENDENCIES
- `expo.modules.location.services.LocationTaskService` | exported=false

### Receivers
- `androidx.profileinstaller.ProfileInstallReceiver` | exported=true | permission=`android.permission.DUMP`
  - actions: androidx.profileinstaller.action.INSTALL_PROFILE
  - actions: androidx.profileinstaller.action.SKIP_FILE
  - actions: androidx.profileinstaller.action.SAVE_PROFILE
  - actions: androidx.profileinstaller.action.BENCHMARK_OPERATION

### Providers
- `expo.modules.filesystem.FileSystemFileProvider` | exported=false
- `expo.modules.imagepicker.fileprovider.ImagePickerFileProvider` | exported=false
- `com.canhub.cropper.CropFileProvider` | exported=false
- `androidx.startup.InitializationProvider` | exported=false

## 2) Permissions
- `android.permission.ACCESS_COARSE_LOCATION`
- `android.permission.ACCESS_FINE_LOCATION`
- `android.permission.ACCESS_NETWORK_STATE`
- `android.permission.CAMERA`
- `android.permission.INTERNET`
- `android.permission.READ_EXTERNAL_STORAGE`
- `android.permission.RECORD_AUDIO`
- `android.permission.SYSTEM_ALERT_WINDOW`
- `android.permission.VIBRATE`
- `android.permission.WRITE_EXTERNAL_STORAGE`
- `com.psy_lololo.conferenceapp.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`

## 3) JS/App Layer (Expo Router, heuristics from Hermes bundle)
- `./(tabs)/_layout.tsx`
- `./(tabs)/chat.tsx`
- `./(tabs)/index.tsx`
- `./(tabs)/profile.tsx`
- `./(tabs)/schedule.tsx`
- `./(tabs)/speakers.tsx`
- `./+not-found.tsx`
- `./_layout.tsx`
- `./about.tsx`
- `./gifts.tsx`
- `./map.tsx`
- `./meetings.tsx`
- `./my-schedule.tsx`
- `./news.tsx`
- `./partners.tsx`
- `./ticket.tsx`

## 4) Expo Config (`assets/app.config`)
- `name`: `TechForum 2026`
- `slug`: `conference-app`
- `version`: `1.0.0`
- `sdkVersion`: `54.0.0`
- `scheme`: `conference-app`
- `newArchEnabled`: `True`
- `plugins`: `[['expo-router', {'origin': 'https://replit.com/'}], 'expo-font', 'expo-web-browser']`

## 5) Native Layer
- DEX files: classes.dex, classes2.dex, classes3.dex
- Native libs count: 92
- `lib/arm64-v8a/libanimation-decoder-gif.so`
- `lib/arm64-v8a/libappmodules.so`
- `lib/arm64-v8a/libavif_android.so`
- `lib/arm64-v8a/libc++_shared.so`
- `lib/arm64-v8a/libexpo-modules-core.so`
- `lib/arm64-v8a/libfbjni.so`
- `lib/arm64-v8a/libgesturehandler.so`
- `lib/arm64-v8a/libgifimage.so`
- `lib/arm64-v8a/libhermes.so`
- `lib/arm64-v8a/libhermestooling.so`
- `lib/arm64-v8a/libimagepipeline.so`
- `lib/arm64-v8a/libjsi.so`
- `lib/arm64-v8a/libnative-filters.so`
- `lib/arm64-v8a/libnative-imagetranscoder.so`
- `lib/arm64-v8a/libreact_codegen_reactnativekeyboardcontroller.so`
- `lib/arm64-v8a/libreact_codegen_rnscreens.so`
- `lib/arm64-v8a/libreact_codegen_rnsvg.so`
- `lib/arm64-v8a/libreact_codegen_safeareacontext.so`
- `lib/arm64-v8a/libreactnative.so`
- `lib/arm64-v8a/libreanimated.so`
- `lib/arm64-v8a/librnscreens.so`
- `lib/arm64-v8a/libstatic-webp.so`
- `lib/arm64-v8a/libworklets.so`
- `lib/armeabi-v7a/libanimation-decoder-gif.so`
- `lib/armeabi-v7a/libappmodules.so`
- `lib/armeabi-v7a/libavif_android.so`
- `lib/armeabi-v7a/libc++_shared.so`
- `lib/armeabi-v7a/libexpo-modules-core.so`
- `lib/armeabi-v7a/libfbjni.so`
- `lib/armeabi-v7a/libgesturehandler.so`
- `lib/armeabi-v7a/libgifimage.so`
- `lib/armeabi-v7a/libhermes.so`
- `lib/armeabi-v7a/libhermestooling.so`
- `lib/armeabi-v7a/libimagepipeline.so`
- `lib/armeabi-v7a/libjsi.so`
- `lib/armeabi-v7a/libnative-filters.so`
- `lib/armeabi-v7a/libnative-imagetranscoder.so`
- `lib/armeabi-v7a/libreact_codegen_reactnativekeyboardcontroller.so`
- `lib/armeabi-v7a/libreact_codegen_rnscreens.so`
- `lib/armeabi-v7a/libreact_codegen_rnsvg.so`
- ... and 52 more

## 6) Class Composition
- Total classes: `21128`
- Top package prefixes:
  - `com.google.android`: 2313
  - `kotlin.reflect.jvm`: 1943
  - `com.google.common`: 1878
  - `com.facebook.react`: 1868
  - `expo.modules.kotlin`: 1139
  - `com.bumptech.glide`: 693
  - `com.facebook.imagepipeline`: 560
  - `kotlinx.coroutines.flow`: 361
  - `com.swmansion.rnscreens`: 299
  - `androidx.core.view`: 297
  - `expo.modules.filesystem`: 288
  - `androidx.appcompat.widget`: 263
  - `androidx.core.app`: 219
  - `org.apache.commons`: 219
  - `expo.modules.image`: 205
  - `com.facebook.fresco`: 195
  - `androidx.fragment.app`: 190
  - `android.support.v4`: 188
  - `com.horcrux.svg`: 176
  - `androidx.recyclerview.widget`: 175
  - `com.caverock.androidsvg`: 135
  - `expo.modules.location`: 132
  - `com.swmansion.gesturehandler`: 132
  - `kotlinx.coroutines.channels`: 128
  - `com.facebook.common`: 123
- Expo module prefixes:
  - `expo.modules.kotlin`: 1139
  - `expo.modules.filesystem`: 288
  - `expo.modules.image`: 205
  - `expo.modules.location`: 132
  - `expo.modules.imagepicker`: 103
  - `expo.modules.core`: 70
  - `expo.modules.fetch`: 65
  - `expo.modules.adapters`: 32
  - `expo.modules.webbrowser`: 31
  - `expo.modules.interfaces`: 31
  - `expo.modules.haptics`: 22
  - `expo.modules.splashscreen`: 19
  - `expo.modules.blur`: 19
  - `expo.modules.lineargradient`: 17
  - `expo.modules.keepawake`: 16
  - `expo.modules.systemui`: 15
  - `expo.modules.font`: 15
  - `expo.modules.asset`: 13
  - `expo.modules.constants`: 10
  - `expo.modules.linking`: 10

## 7) App Package Classes
- `com.psy_lololo.conferenceapp.BuildConfig`
- `com.psy_lololo.conferenceapp.MainActivity`
- `com.psy_lololo.conferenceapp.MainActivity$createReactActivityDelegate$1`
- `com.psy_lololo.conferenceapp.MainApplication`
- `com.psy_lololo.conferenceapp.MainApplication$reactNativeHost$1`
- `com.psy_lololo.conferenceapp.R`
- `com.psy_lololo.conferenceapp.R$color`
- `com.psy_lololo.conferenceapp.R$drawable`
- `com.psy_lololo.conferenceapp.R$integer`
- `com.psy_lololo.conferenceapp.R$mipmap`
- `com.psy_lololo.conferenceapp.R$raw`
- `com.psy_lololo.conferenceapp.R$string`
- `com.psy_lololo.conferenceapp.R$style`