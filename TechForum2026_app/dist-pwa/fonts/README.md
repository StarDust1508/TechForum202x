# GOST Type A — фирменный шрифт TechForum 2026

Это chertezh-style шрифт ГОСТ 2.304 (Type A с наклоном). Используется в Auth,
заголовках, кнопках главного действия. Перекликается с blueprint-фоном.

## Что положить сюда

Сюда нужно положить три файла:

```
public/fonts/
  GOSTTypeA-Regular.woff2     # вес 400-600, обычное начертание
  GOSTTypeA-Italic.woff2      # вес 400-600, наклонное (чертёжный курсив)
  GOSTTypeA-Bold.woff2        # вес 700-900, жирное начертание
```

## Где взять

GOST 2.304 Type A — открытый шрифт. Источники (выберите дистрибутив с лицензией
SIL OFL или Public Domain, под нужный шрифт):

- https://fontesk.com/gost-type-a/   (TTF/OTF)
- https://www.fontspace.com/gost-type-a-font  (TTF)
- https://github.com/Ftylitakis/Trusses/tree/master/fonts (если в проекте)
- Поиск: `GOST 2.304 Type A woff2 cyrillic`

## Конвертация TTF → WOFF2

Если найдёте только TTF — конвертируйте через:

```bash
# через fonttools
pip install fonttools brotli
fonttools ttLib.woff2 compress GOSTTypeA-Regular.ttf
mv GOSTTypeA-Regular.woff2 public/fonts/

# или онлайн: https://transfonter.org/ (выберите woff2, кириллицу)
```

## Subset (опционально, для уменьшения размера)

GOST Type A с полной кириллицей весит ~80-120 KB в woff2. Можно subset'нуть до
наших нужных глифов (русский+латиница+цифры+пунктуация) — упадёт до ~30 KB:

```bash
pyftsubset GOSTTypeA-Regular.ttf \
  --unicodes="U+0020-007E,U+0400-04FF,U+2010-2027,U+2030-2044" \
  --flavor=woff2 \
  --output-file=GOSTTypeA-Regular.woff2
```

## Что произойдёт без файлов

Пока файлов нет, всё работает: `@font-face` имеет `font-display: swap`,
а CSS-fallback `Cormorant Garamond` подхватывается мгновенно. Но визуальная
brand-привязка к blueprint будет неполной — добавьте шрифт перед релизом APK.
