# iOS 1.8.10 (35): Xcode → TestFlight → App Store

Текущий результат — синхронизированный Xcode-проект, не IPA для магазина. Push намеренно отсутствует до отдельного Apple/APNs контура.

## Фактическая готовность на 2 сентября 2026

| Пункт | Статус | Доказательство / пробел |
|---|---|---|
| Bundle ID | Готово в source | `ru.techpravo.conference` в Xcode project |
| Version/build | Готово в source | `1.8.10 (35)` |
| Privacy manifest | Есть, требует аудита | `ios/App/App/PrivacyInfo.xcprivacy`; полнота SDK/data practices не доказана |
| Privacy URL | Live | `https://tech-pravo.ru/privacy` отвечает 200 |
| Support URL | Live | `https://tech-pravo.ru/support` отвечает 200 и содержит страницу поддержки TechPravo |
| Marketing URL | Кандидат live | `https://tech-pravo.ru/conference` отвечает 200; владелец должен утвердить его для карточки |
| App Store Connect record | Не проверено | Нужен кабинет владельца |
| Distribution certificate/profile | Нет доказательства | Нужен owner Team в Xcode |
| Archive / Validate / Upload | Не готово | Archive и IPA отсутствуют |
| TestFlight build | Не готово | Build 35 не загружался |
| Privacy Nutrition Labels | Не готово | Нужна сверка данных приложения и всех SDK |
| Screenshots / age rating / review metadata | Не готово | Нужны финальные материалы и ответы владельца |
| Export compliance | Частично | В source есть `ITSAppUsesNonExemptEncryption=false`; истинность должен подтвердить владелец |
| Agreements / tax / banking | Не проверено | Доступно только в учётной записи владельца |

## 1. Учётная запись и идентификаторы

1. Владелец входит в Xcode своим Apple ID; пароль, session cookie, private key и 2FA-коды никому не передаются.
2. В Certificates, Identifiers & Profiles проверяет Team и App ID для `ru.techpravo.conference`.
3. В App Store Connect создаёт app record с тем же Bundle ID или доказывает существующий; принимает актуальные agreements. Tax/banking должны быть действующими, если используются платные функции.
4. Создаёт App Store Distribution certificate и App Store provisioning profile. Автоматическое signing допустимо только в owner-controlled Team.

## 2. Сборка

1. Открыть `ios/App/App.xcodeproj`; выбрать реальное устройство/Any iOS Device, Release и owner Team.
2. Проверить version `1.8.10`, build `35`, bundle `ru.techpravo.conference`, iOS 15+, scheme `conference-app`.
3. Не включать Push Notifications, APNs entitlement или Firebase Messaging в этой версии.
4. Проверить `PrivacyInfo.xcprivacy` против фактических SDK и сетевых данных; наличие файла не доказывает полноту декларации.
5. Product → Archive. В Organizer: Validate App, затем Distribute App → App Store Connect → Upload.
6. Дождаться processing и выбрать build 35 в TestFlight. Провести вход, deep links, offline speakers, программу, исследование, клавиатуру/safe area на реальном iPhone.

## 3. Metadata и privacy

- App name, subtitle, description, keywords, category, age rating и review notes.
- Support URL `https://tech-pravo.ru/support` и privacy URL `https://tech-pravo.ru/privacy` сейчас открываются без авторизации; marketing-кандидат — `https://tech-pravo.ru/conference`. Перед отправкой владелец подтверждает, что тексты соответствуют этой версии приложения.
- App Privacy / Privacy Nutrition Labels: перечислить данные самого приложения и всех third-party SDK, цели, связь с пользователем и tracking.
- Export compliance: подтвердить фактическое использование шифрования. В проекте стоит `ITSAppUsesNonExemptEncryption=false`, но это нужно подтвердить владельцу; неверный флаг нельзя оставлять ради прохождения формы.
- Screenshots: подготовить финальные экраны для поддерживаемых iPhone display sizes без тестовых данных, системных ошибок и ложных функций.
- App Review contact, demo account/инструкции, content rights и ответы на обязательные вопросы.

## 4. Gate

GO возможен только после: successful Validate/Upload, processed TestFlight build 35, доказанного Distribution certificate/profile, заполненной privacy/metadata, реального iPhone smoke test и отдельного решения владельца о публикации. Unsigned, development или ad-hoc IPA непригоден для App Store Connect.

Официальные инструкции: [upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/), [app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/), [export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/), [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).
