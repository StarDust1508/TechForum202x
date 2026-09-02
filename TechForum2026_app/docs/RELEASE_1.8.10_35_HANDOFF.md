# TechForum 1.8.10 (35): доказательный handoff

Статус: локальный кандидат для QA. Production, RuStore, App Store Connect и база данных не изменялись.

## Канон

- Основа: `05b223d48081dca14589c0c0863cc7c30be9200b`.
- Commit, из которого собран APK: `fb78eb553299f778ebb0390d5ff4195be8afd3e0`.
- Android: `com.psy_lololo.conferenceapp`, version `1.8.10`, code `35`.
- iOS: `ru.techpravo.conference`, version `1.8.10`, build `35`, minimum iOS 15.
- API сборки: `https://tech-pravo.ru/tfapi/v1`.
- Единственный бинарный артефакт кандидата: debug APK из `release/1.8.10-35-debug/`.
- `CURRENT 1.8.6`, checksum `1.8.0` и server package `1.7.0` остаются историческими свидетельствами. Их не переименовывали и не перезаписывали; разрешение расхождения — этот manifest и его SHA-256.

## Что исправлено

- Безопасные deep links для `conference-app://` с allow-list маршрутов и отказом на `/` для неизвестного payload.
- Офлайн-снимок 33 спикеров с provenance/ETag/SHA-256 и приоритетом live → cache → bundled.
- Возврат из карточки спикера без скачка в начало; индивидуальная точка фокуса фотографий.
- Человеческие ошибки входа и восстановления доступа; labels, autocomplete, 16 px inputs и управляемый фокус.
- Общий доступный диалог: portal, inert-фон, focus trap, Escape/hardware back, возврат фокуса, блокировка прокрутки документа.
- Safe area, минимальные цели 44×44, отсутствие горизонтального overflow на 320/375/393 px.
- Тексты исследований сведены только к фактам, подтверждённым на `/opros` и `/opros2`.
- iOS push закрыт на уровне runtime и native plugin allow-list, даже если случайно выставлен `VITE_PUSH_CONFIGURED=true`.

## Проверки

- `npm run lint`: PASS.
- `npm run test:client`: PASS, 20/20.
- Android debug build: PASS; package/version/signature проверены `aapt` и `apksigner`.
- Android release task без owner signing secrets: ожидаемый fail-closed NO-GO.
- iOS Capacitor sync: PASS; восемь allow-listed plugins, Firebase Messaging отсутствует.
- Браузерная QA: `/`, `/speakers`, `/giveaways`, `/schedule` на 320/375/393 px; overflow и цели меньше 44 px не обнаружены.
- Возврат спикера: scrollTop `1990 → 1990` сразу после Back и через 1 секунду.

## Общий API и границы

Этот diff читает существующие `/speakers`, `/sessions`, `/days`, `/tracks`; существующие endpoints регистрации программы остаются без серверных изменений. `/opros` и `/opros2` использовались только как источник фактов. Landing, admin, production schema и серверный release не менялись.

Изменения шире одного экрана, но внутри приложения: общий цвет foreground для primary-action, `BackButton`, `AccessibleDialog`, offline speaker normalizer и deep-link router. Ранее сверх узкой задачи были затронуты исследования, authentication UX и глобальные touch targets; в этом handoff они явно перечислены и покрыты тестами.

## Схема и ledger: безопасный план

1. Владелец создаёт provider snapshot/backup и отдельную staging-копию. Backup должен иметь проверенный restore, а не только статус «создан».
2. В read-only соединении запускается `ops/release/schema-preflight-1.8.10-35.sql`; вывод сохраняется как датированный артефакт без секретов.
3. Сверяются фактические таблицы/constraints/indexes и migration ledger с `drizzle/0018_contact_pins_and_telegram_tokens.sql` и `drizzle/0019_current_support_email.sql`. Не считать наличие записи ledger доказательством фактической схемы.
4. Только на staging последовательно применяются 0018 и 0019. Они повторяемы: `CREATE ... IF NOT EXISTS`, детерминированные `UPDATE`, замена только старого email.
5. Повторный запуск должен дать ту же схему и ноль строк со старой почтой; проверяются pin/unpin, одноразовость Telegram token, expiry/consumed state и чтение `app_content` после restart.
6. Production migration — отдельная команда владельца после сравнения before/after и заранее подготовленного rollback. В этом проходе миграции не применялись.

## Push acceptance

Единственная достаточная цепочка: `scheduled` в серверном ledger → Firebase вернул message ID/accepted → Android показал системное уведомление в шторке при свёрнутом приложении → владелец нажал его → deep link открыл ожидаемый экран → сервер получил tap-confirm с тем же correlation ID. Firebase `accepted` без системного уведомления и tap-confirm — не PASS.

Физический Android-тест остаётся действием владельца. Debug APK подписан другим сертификатом и может потребовать удаления RuStore-версии; поверх опубликованного приложения его устанавливать нельзя.

## Решение

- Android local QA: GO.
- RuStore: NO-GO — debug certificate, AAB отсутствует, опубликованный/upload certificate не доказаны.
- iOS source sync: GO.
- App Store/TestFlight: NO-GO — Distribution signing, provisioning, Archive, App Store Connect record и metadata acceptance не доказаны.
