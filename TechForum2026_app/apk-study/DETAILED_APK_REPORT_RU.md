# Подробный технический отчёт по APK

_Дата подготовки: 2026-04-27 16:12_

## 1. Цель и контекст
Цель отчёта: разложить мобильное приложение на внутренние компоненты для безопасного изучения архитектуры, точек входа, экранов и зависимостей.

Анализ выполнен по артефактам:
- APK: `/Users/bubble3/Library/Containers/ru.keepcoder.Telegram/Data/tmp/app-release.apk`
- Декодированный манифест: `apk-study/AndroidManifest.decoded.xml`
- Машиночитаемая структура: `apk-study/apk_components.json`

Ограничение: JS-слой в APK упакован в Hermes bytecode (`assets/index.android.bundle`), поэтому имена маршрутов/экранов извлекались эвристически по строкам байткода.

## 2. Паспорт приложения
- Название: **TechForum 2026**
- Package ID: `com.psy_lololo.conferenceapp`
- Версия: `1.0.0` (code `1`)
- MainActivity: `com.psy_lololo.conferenceapp.MainActivity`
- Android SDK: min `24`, target `36`
- DEX файлов: `3` (classes.dex, classes2.dex, classes3.dex)
- Native `.so` библиотек: `92`

## 3. Архитектурный срез (слои)
1. **Android shell**: `MainActivity/MainApplication` запускают React Native/Expo runtime.
2. **JS/UI слой**: экраны и навигация через Expo Router (табовая структура + отдельные страницы).
3. **Native integrations**: `expo.modules.*`, RN-библиотеки (`reanimated`, `gesturehandler`, `rnscreens`, `rnsvg`), GMS/Google API компоненты.
4. **Системные сервисы**: локация, файловый доступ, image picker/cropper, профиль установки (`profileinstaller`).

## 4. Android-компоненты (entry points)
| Тип | Класс | Exported | Permission | Intent filters |
|---|---|---:|---|---|
| `activity` | `com.canhub.cropper.CropImageActivity` | `true` | `—` | — |
| `activity` | `com.google.android.gms.common.api.GoogleApiActivity` | `false` | `—` | — |
| `activity` | `com.psy_lololo.conferenceapp.MainActivity` | `true` | `—` | actions: android.intent.action.MAIN; categories: android.intent.category.LAUNCHER; data: — <br> actions: android.intent.action.VIEW; categories: android.intent.category.DEFAULT, android.intent.category.BROWSABLE; data: {'android:scheme': 'conference-app'} |
| `activity` | `expo.modules.imagepicker.ExpoCropImageActivity` | `false` | `—` | — |
| `service` | `com.google.android.gms.metadata.ModuleDependencies` | `false` | `—` | actions: com.google.android.gms.metadata.MODULE_DEPENDENCIES; categories: —; data: — |
| `service` | `expo.modules.location.services.LocationTaskService` | `false` | `—` | — |
| `receiver` | `androidx.profileinstaller.ProfileInstallReceiver` | `true` | `android.permission.DUMP` | actions: androidx.profileinstaller.action.INSTALL_PROFILE; categories: —; data: — <br> actions: androidx.profileinstaller.action.SKIP_FILE; categories: —; data: — <br> actions: androidx.profileinstaller.action.SAVE_PROFILE; categories: —; data: — <br> actions: androidx.profileinstaller.action.BENCHMARK_OPERATION; categories: —; data: — |
| `provider` | `androidx.startup.InitializationProvider` | `false` | `—` | — |
| `provider` | `com.canhub.cropper.CropFileProvider` | `false` | `—` | — |
| `provider` | `expo.modules.filesystem.FileSystemFileProvider` | `false` | `—` | — |
| `provider` | `expo.modules.imagepicker.fileprovider.ImagePickerFileProvider` | `false` | `—` | — |

### 4.1 Что важно по точкам входа
- Лаунчер и deep link идут через `MainActivity` (схема `conference-app`).
- `CropImageActivity` помечен как exported=true: нужно контролировать входные `Intent` и URI-права.
- `ProfileInstallReceiver` exported=true, но защищён permission `android.permission.DUMP` (системный уровень).
- Все провайдеры файлов (`FileProvider`) неэкспортируемые, что снижает риск внешнего чтения файлов.

## 5. Разрешения (permissions)
| Permission | Назначение (оценка) | Приоритет проверки |
|---|---|---|
| `android.permission.ACCESS_COARSE_LOCATION` | Примерная геолокация | Средний |
| `android.permission.ACCESS_FINE_LOCATION` | Точная геолокация | Высокий |
| `android.permission.ACCESS_NETWORK_STATE` | Проверка состояния сети | Низкий |
| `android.permission.CAMERA` | Съемка/сканирование/аватар | Средний |
| `android.permission.INTERNET` | Сеть/HTTP API | Низкий |
| `android.permission.READ_EXTERNAL_STORAGE` | Чтение медиа из памяти (legacy) | Средний |
| `android.permission.RECORD_AUDIO` | Запись голоса/медиа | Средний |
| `android.permission.SYSTEM_ALERT_WINDOW` | Поверх других окон | Высокий |
| `android.permission.VIBRATE` | Вибро-отклик UI | Низкий |
| `android.permission.WRITE_EXTERNAL_STORAGE` | Запись в память (legacy) | Средний |
| `com.psy_lololo.conferenceapp.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | Служебное/не классифицировано | Низкий |

### 5.1 Фокус аудита разрешений
1. Проверить, на каких экранах реально запрашиваются `CAMERA`, `RECORD_AUDIO`, `ACCESS_FINE_LOCATION`.
2. Для `SYSTEM_ALERT_WINDOW` убедиться, что есть явный user-consent и понятный UX-поток.
3. `READ/WRITE_EXTERNAL_STORAGE` — legacy-модель; для Android 13+ желательно мигрировать на современную media-permission схему.

## 6. JS/UI маршруты и экраны (Hermes, эвристика)
| Маршрут в APK | Предполагаемая роль | Соответствие в текущем коде |
|---|---|---|
| `./(tabs)/_layout.tsx` | Навигационный layout | — |
| `./(tabs)/chat.tsx` | Чат/коммуникации | src/pages/Chat.tsx |
| `./(tabs)/index.tsx` | Экран/роут приложения | src/pages/Home.tsx (вероятно) |
| `./(tabs)/profile.tsx` | Профиль | src/pages/Profile.tsx |
| `./(tabs)/schedule.tsx` | Расписание | src/pages/Schedule.tsx |
| `./(tabs)/speakers.tsx` | Спикеры | src/pages/Speakers.tsx |
| `./+not-found.tsx` | 404 route fallback | — |
| `./_layout.tsx` | Навигационный layout | — |
| `./about.tsx` | О приложении/конференции | src/pages/Home.tsx / отдельная страница (не обнаружена напрямую) |
| `./gifts.tsx` | Подарки/активности | src/pages/Giveaways.tsx (по смыслу) |
| `./map.tsx` | Карта/локации | src/pages/Map.tsx |
| `./meetings.tsx` | Встречи | src/pages/Chat.tsx или отдельная страница (по смыслу) |
| `./my-schedule.tsx` | Расписание | src/pages/Schedule.tsx (по смыслу) |
| `./news.tsx` | Новости/лента | src/pages/Feed.tsx (по смыслу) |
| `./partners.tsx` | Партнёры | src/pages/Home.tsx или отдельная страница (по смыслу) |
| `./ticket.tsx` | Билет | src/pages/Ticket.tsx |

### 6.1 Табовая навигация (признаки)
В APK присутствует сегмент `/(tabs)/...`, что указывает на табовый корневой layout с вкладками: `index`, `schedule`, `speakers`, `chat`, `profile`.

## 7. Expo и runtime-конфигурация
| Параметр | Значение |
|---|---|
| `name` | `TechForum 2026` |
| `slug` | `conference-app` |
| `version` | `1.0.0` |
| `sdkVersion` | `54.0.0` |
| `scheme` | `conference-app` |
| `newArchEnabled` | `True` |
| `orientation` | `portrait` |
| `userInterfaceStyle` | `dark` |
| `plugins` | `[['expo-router', {'origin': 'https://replit.com/'}], 'expo-font', 'expo-web-browser']` |

Ключевые признаки:
- `sdkVersion: 54.0.0` (современный Expo stack).
- `newArchEnabled: true` (новая архитектура RN включена).
- Deep link scheme: `conference-app` (совпадает с `MainActivity` intent-filter).

## 8. Native библиотеки и ABI
| ABI | Кол-во библиотек |
|---|---:|
| `arm64-v8a` | 23 |
| `armeabi-v7a` | 23 |
| `x86` | 23 |
| `x86_64` | 23 |

Набор библиотек повторяется по 4 ABI; базовый список (на примере `arm64-v8a`):
- `libanimation-decoder-gif.so`
- `libappmodules.so`
- `libavif_android.so`
- `libc++_shared.so`
- `libexpo-modules-core.so`
- `libfbjni.so`
- `libgesturehandler.so`
- `libgifimage.so`
- `libhermes.so`
- `libhermestooling.so`
- `libimagepipeline.so`
- `libjsi.so`
- `libnative-filters.so`
- `libnative-imagetranscoder.so`
- `libreact_codegen_reactnativekeyboardcontroller.so`
- `libreact_codegen_rnscreens.so`
- `libreact_codegen_rnsvg.so`
- `libreact_codegen_safeareacontext.so`
- `libreactnative.so`
- `libreanimated.so`
- `librnscreens.so`
- `libstatic-webp.so`
- `libworklets.so`

### 8.1 Функциональные группы native-lib
- JS/Runtime: `libhermes.so`, `libhermestooling.so`, `libjsi.so`
- Core RN: `libreactnative.so`, `libfbjni.so`
- UI/навигация/жесты: `librnscreens.so`, `libgesturehandler.so`, `libreanimated.so`, `libworklets.so`
- Графика и медиа: `libimagepipeline.so`, `libavif_android.so`, `libgifimage.so`, `libstatic-webp.so`
- Expo/native module glue: `libexpo-modules-core.so`, `libappmodules.so`

## 9. Состав классов (DEX)
- Всего классов: `21128`

### 9.1 Топ package-префиксов
| Package prefix | Кол-во классов |
|---|---:|
| `com.google.android` | 2313 |
| `kotlin.reflect.jvm` | 1943 |
| `com.google.common` | 1878 |
| `com.facebook.react` | 1868 |
| `expo.modules.kotlin` | 1139 |
| `com.bumptech.glide` | 693 |
| `com.facebook.imagepipeline` | 560 |
| `kotlinx.coroutines.flow` | 361 |
| `com.swmansion.rnscreens` | 299 |
| `androidx.core.view` | 297 |
| `expo.modules.filesystem` | 288 |
| `androidx.appcompat.widget` | 263 |
| `androidx.core.app` | 219 |
| `org.apache.commons` | 219 |
| `expo.modules.image` | 205 |
| `com.facebook.fresco` | 195 |
| `androidx.fragment.app` | 190 |
| `android.support.v4` | 188 |
| `com.horcrux.svg` | 176 |
| `androidx.recyclerview.widget` | 175 |
| `com.caverock.androidsvg` | 135 |
| `expo.modules.location` | 132 |
| `com.swmansion.gesturehandler` | 132 |
| `kotlinx.coroutines.channels` | 128 |
| `com.facebook.common` | 123 |
| `com.github.penfeizhou` | 120 |
| `androidx.core.content` | 119 |
| `androidx.emoji2.text` | 119 |
| `com.facebook.drawee` | 116 |
| `androidx.constraintlayout.motion` | 108 |

### 9.2 Топ Expo module-префиксов
| Expo prefix | Кол-во классов |
|---|---:|
| `expo.modules.kotlin` | 1139 |
| `expo.modules.filesystem` | 288 |
| `expo.modules.image` | 205 |
| `expo.modules.location` | 132 |
| `expo.modules.imagepicker` | 103 |
| `expo.modules.core` | 70 |
| `expo.modules.fetch` | 65 |
| `expo.modules.adapters` | 32 |
| `expo.modules.webbrowser` | 31 |
| `expo.modules.interfaces` | 31 |
| `expo.modules.haptics` | 22 |
| `expo.modules.splashscreen` | 19 |
| `expo.modules.blur` | 19 |
| `expo.modules.lineargradient` | 17 |
| `expo.modules.keepawake` | 16 |
| `expo.modules.systemui` | 15 |
| `expo.modules.font` | 15 |
| `expo.modules.asset` | 13 |
| `expo.modules.constants` | 10 |
| `expo.modules.linking` | 10 |
| `expo.modules.imageloader` | 9 |
| `expo.modules.apploader` | 6 |
| `expo.modules.rncompatibility` | 1 |
| `expo.modules.ApplicationLifecycleDispatcher` | 1 |
| `expo.modules.BuildConfig` | 1 |

## 10. Собственные Android-классы приложения
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

Вывод: собственный нативный слой минимален; основная логика, вероятнее всего, в JS/TS-слое и Expo-модулях.

## 11. META-INF version-маркеры (библиотечный стек)
- Всего version-файлов: `62`
- AndroidX: `59`
- Google: `1`
- Kotlin: `2`

Это подтверждает богатый AndroidX-стек и типичную зависимостную базу Expo/RN-сборки.

## 12. Связка с текущим репозиторием (для изучения)
Найденные страницы в текущем коде проекта:
- `src/pages/Auth.tsx`
- `src/pages/Chat.tsx`
- `src/pages/Feed.tsx`
- `src/pages/Giveaways.tsx`
- `src/pages/Home.tsx`
- `src/pages/Map.tsx`
- `src/pages/Profile.tsx`
- `src/pages/Schedule.tsx`
- `src/pages/Speakers.tsx`
- `src/pages/Ticket.tsx`

Рекомендованный порядок изучения в коде:
1. `src/main.tsx` -> `src/App.tsx` (точка запуска и композиция приложения).
2. `src/pages/Home.tsx`, `Schedule.tsx`, `Speakers.tsx` (базовый user flow конференции).
3. `src/pages/Chat.tsx`, `Profile.tsx`, `Ticket.tsx`, `Map.tsx` (функциональные модули).
4. `src/lib/runtimeEndpoint.ts`, `src/lib/localAuth.ts`, `src/lib/utils.ts` (инфраструктура данных/аутентификации).
5. `src/data.ts` (источники и модели данных интерфейса).

## 13. Приоритеты безопасности и качества
1. **Deep links**: проверить валидацию параметров для `conference-app://...` до перехода на экран.
2. **Media intents**: в crop/image-picker потоках проверить `content://` URI-permissions и обработку невалидного контента.
3. **Sensitive permissions**: минимизировать запросы `CAMERA/MIC/LOCATION` и делать их строго контекстными.
4. **Overlay permission**: обосновать необходимость `SYSTEM_ALERT_WINDOW`, либо убрать для production-сборки.
5. **Storage legacy**: рассмотреть замену `READ/WRITE_EXTERNAL_STORAGE` на современную permission-модель.

## 14. Методика извлечения (для воспроизводимости)
- Манифест и компоненты: `androguard` (парсинг binary AndroidManifest).
- Классы и статистика пакетов: `AnalyzeAPK` по `classes.dex/classes2.dex/classes3.dex`.
- Роуты/экраны: извлечение printable-строк из Hermes bundle (`assets/index.android.bundle`) + фильтрация route-like паттернов.
- Native stack: инвентарь `.so` по каталогам `lib/<abi>/` внутри APK.

## 15. Краткий итог
Приложение представляет собой Expo/RN-конференц-клиент с табовой навигацией и набором функциональных экранов (расписание, спикеры, чат, карта, билет, профиль). Нативная часть в основном инфраструктурная (RN/Expo-модули), а продуктовая логика сосредоточена в JS-слое.

---
Дополнительные данные: подробный JSON-срез находится в `apk-study/apk_components.json`.