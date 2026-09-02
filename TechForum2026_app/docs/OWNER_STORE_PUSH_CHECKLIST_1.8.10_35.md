# Один экран владельца: магазины и push

## RuStore — сейчас NO-GO

- [ ] В консоли RuStore открыть опубликованный `com.psy_lololo.conferenceapp` и записать текущий version code (ранее сообщался `19`).
- [ ] Сверить SHA-256 сертификата опубликованного APK и upload/app-signing certificates с release keystore владельца.
- [ ] Не использовать debug APK/AAB: его certificate SHA-256 — `4ba586b873ee61f3f112cdc1093b6e757b802a0ebd86f157c336dd5390fe33da`.
- [ ] Ввести keystore path/password/alias/password только локально или в защищённые CI secrets; не отправлять пароли и ключи в чат.
- [ ] Собрать signed AAB code 35, проверить `apksigner`, `bundletool` и возможность обновления установленного пакета.
- [ ] Загрузку выполнять только отдельной командой после GO.

## Android push — физическая приёмка

- [ ] Установить совместимо подписанную QA-сборку, войти, дать системное разрешение на уведомления.
- [ ] Свернуть приложение; отправить одно scheduled test с уникальным correlation ID.
- [ ] Зафиксировать server scheduled, Firebase message ID, уведомление в шторке, tap и server tap-confirm.
- [ ] PASS только при всех пяти доказательствах; Firebase accepted отдельно — NO-GO.

## Apple — сейчас NO-GO

- [ ] Владелец входит в Xcode/App Store Connect сам и подтверждает Team, Bundle ID `ru.techpravo.conference`, agreements/tax/banking.
- [ ] Создаёт/проверяет App Store Distribution certificate, App Store provisioning profile и App Store Connect app record.
- [ ] Выполняет Archive → Validate → Upload → TestFlight; unsigned/ad-hoc IPA не использовать.
- [ ] Заполняет privacy, support/privacy URLs, age rating, export compliance, metadata и screenshots.

Нужны только три действия владельца: доказать RuStore certificates; провести физический Android push test; завершить Apple signing/App Store Connect в своей учётной записи.
