# Проверка 15 октября 2026

Preview: https://mc-commands-dwnwne3x9-egorka-dinos-projects.vercel.app/summon

Vercel project `mc-commands`, `prj_VLwaXfhYmW6kCPsAAe7WFzg2bJuC`, team `team_hMIU83FjnI83moxLlXLf77k1`. Deployment `dpl_2cQZcPw4w7jnmN9GLH6HbQ5ww1k2`: READY, target null (preview). Отправлены текущие исходники и подготовленные ресурсы через Vercel MCP. CLI сначала вернул `Missing authentication token`; существующее MCP-подключение позволило выполнить deployment. Production domains не назначались, Git push не выполнялся.

Проверка подготовки:

- Upstream `:tooling:entityModels`: BUILD SUCCESSFUL, затем повторный запуск сохранённого `research-asset-renderer.py`: BUILD SUCCESSFUL.
- SHA1 vanilla 26.1.2 JAR совпадает с launcher JSON. SHA256: `b1b3158572666445eff01e82fad8c7de2e4953db6d354f311730d77a8359d0b0`.
- Прямой exporter запущен повторно с `--out /tmp/mc-final-reproduced`; manifest побайтно совпал. В нём 336 SHA256 подготовленных файлов.
- `verify.py`: 8 adult/baby bodies, 12 armor layers, finite positions/UV, unit normals, pose transforms и обе hand matrices проходят проверку. Основные meshes содержат 42/42/72/66/72 quad polygons соответственно zombie/skeleton/horse/villager/ravager.
- `npm run test:entity-preview`: 5 тестов, все проходят.
- `npm run build`: successful compilation, TypeScript, prerender и route generation. `git diff --check` без ошибок.

Браузер локально:

- Все пять семейств переключались из редактора; каждое достигло статуса "Модель обновлена". Скриншоты проверены для лошади, жителя и разорителя, а также общей цепочки с зомби и скелетом.
- Пример показывает horse → zombie в четырёх алмазных armor slots с diamond sword → skeleton с bow. Команда содержит те же Passengers и equipment.
- Смена окраса сохраняет одну загрузку `horse--main.json`, меняет PNG и добавляет ожидаемый `Variant:1` в команду.
- Вращение и приближение меняют пиксели canvas. Проверены кнопки управления; OrbitControls подключён к pointer/wheel/touch.
- До открытия viewer: 0 запросов `/entity-preview/`. Для примера и смены окраса: только нужные 3 модели, armor layers, textures и item parents; ravager не запрашивается.
- 390×844: canvas ~325 px, горизонтального переполнения страницы нет.
- Включение "Ребёнок" у экипированного zombie загружает отдельный `humanoid_baby/diamond.png`, статус обновлён, текст тоже отражает baby.
- Creeper в цепочке явно переводит 3D в fallback, текстовая карточка остаётся.
- Принудительный WebGL unavailable показывает объяснение и сохраняет текст.
- Принудительный HTTP 404 для mesh JSON показывает ошибку ресурса и сохраняет текст.
- Во время проверки обнаружена canvas ResizeObserver/layout feedback loop; исправлена абсолютным позиционированием canvas и `setSize(..., false)`.

На Vercel preview проверены открытие `/summon`, отсутствие ранних запросов моделей, загрузка примера, готовая сцена, наличие брони/пассажиров в команде и отсутствие HTTP ошибок у 3D-ресурсов. Загружены только horse/zombie/skeleton main JSON. В консоли есть существующий 401 от `/api/admin/minecraft/servers` при анонимном входе, не связанный с viewer; ошибок 3D нет.

Отдельная визуальная сверка со скриншотом запущенного Minecraft не проведена. Вершины/UV/позы получены игровыми методами, но освещение, посадка и полнота renderer layers не признаны pixel-perfect.
