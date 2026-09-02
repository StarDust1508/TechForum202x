# Interface review 1.8.10 (35)

Review выполнен по `better-interface` с маршрутами accessibility, layout, writing, typography, colors и UI polish.

## P0/P1, закрытые в кандидате

- iOS push полностью скрыт и fail-closed; случайный build flag не вызывает Firebase.
- Modal isolation: inert/background, focus trap, Escape/hardware back, restore focus, document scroll lock и исключение CSS-hidden controls.
- Нет iOS input zoom: интерактивные поля не меньше 16 px.
- Safe-area и 44×44 touch targets на критических действиях.
- Возврат в список спикеров сохраняет позицию без позднего визуального прыжка.
- Основной foreground на brand pink изменён на тёмный; contrast проверен тестом.
- Ошибки входа описывают действие пользователя, а не CORS/VPN/`Failed to fetch`.

## Проверенный layout

320, 375 и 393 CSS px: home, speakers, research, schedule. Горизонтального overflow и видимых целей меньше 44 px не обнаружено. Отдельно проверены диалог восстановления доступа и keyboard navigation.

## Остаточный риск

- Фактические safe area/keyboard/VoiceOver требуют реального iPhone TestFlight build.
- Android push требует системной доставки и tap-confirm на физическом устройстве.
- Индивидуальные фотофокусы основаны на автоматическом распознавании лица и требуют редакторской spot-check при замене исходных фотографий.
- App Store metadata/screenshots и RuStore listing не входят в этот локальный UI-кандидат.
