# Прозрачность слоёв щитов и флагов

Исправление 16 октября 2026. Одиночный Mojang отображался, но после красного градиента красный Mojang исчезал визуально. Причина: `banner_pattern` не был помечен как translucent, поэтому MeshBasicMaterial делал cutout вместо смешивания дробного alpha из PNG. Градиент становился сплошной заливкой.

Регрессия из пользовательской команды: зомби, щит в offhand, чёрная основа; слои строго в порядке: triangles_bottom/yellow, triangles_top/orange, rhombus/black, gradient/red, mojang/red. Посторонние зачарования, характеристики и эффекты не влияют на эту ошибку.

В `preview-material.ts` декоративные слои используют NormalBlending, depthTest=true, depthWrite=false, forceSinglePass=true. Непрозрачная основа задаёт глубину и закрывает дальние поверхности; renderOrder узоров возрастает в порядке редактора. Отделки брони сохраняют прежнее поведение. Используются исходные игровые PNG, без перерисовки.

Проверено локально: 17 тестов `npm run test:entity-preview`, `npx tsc --noEmit`, `npm run build -- --webpack` и `git diff --check`. Webpack использован локально из-за node_modules, подключённых из основного checkout в изолированную рабочую копию. Обычную production-сборку дополнительно выполняет Vercel preview.

Preview: https://mc-commands-8ripah0yh-egorka-dinos-projects.vercel.app/summon

Сравнение с запущенным Minecraft не выполнялось. До исправления в браузере щит красный, без различимых нижних слоёв; после исправления видны треугольники и градиент, Mojang различим поверх них.

Автоматические проверки preview также обнаружили устаревший транспортный gzip от предыдущего экспорта (в нём были старые shulker defaults и alpha предметов). Для итогового preview пакет заново создан `bundle-catalog.py` из текущего каталога. При обычном Git deployment этот транспорт не используется.

Итоговый Vercel preview READY (`dpl_9EDqEvPbFEuU5pm93hZ6wfusxfB9`): проверены исходные пять слоёв на щите и на флаге, незеритовая броня с rib/redstone, rib/gold и silence/gold и меч. 3D-ресурсы загружаются без HTTP-ошибок. Контрольные снимки: [щит после исправления](banner-alpha-fixed.png), [щит до исправления](banner-alpha-before.png).
