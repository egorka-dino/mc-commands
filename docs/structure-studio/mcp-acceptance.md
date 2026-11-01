# MCP: реализация и границы приёмки

1 ноября 2026. Ветка `codex/structure-mcp-stdio` создана от `ab54493` в `/private/tmp/mc-structure-core-release`. До создания ветки выполнен fetch origin; main/origin/main совпали, рабочая папка была чистой. История d9a1b5a/28b2343/01a95a1/99a6e51/c8c1500 сохранена. Основная папка с чужими правками не менялась.

## Реализовано

Отдельный stdio Node-пакет с официальным SDK 1.32.2, три инструмента, JSON input/output schemas, тонкий HTTPS-клиент без retries/redirects/cookies/DB. Общая операция update_instance над копией существующего экземпляра использует прежний owner/CAS-сервис. get/validate не пишут документ. validate возвращает коды диагностики, в том числе пересечения и неподдерживаемые материалы. Существующие хранилище, формат 1, IDs, черновик, редактор, export writer и 3D не переписаны.

Проектное ограниченное делегирование: owner из Auth.js, выбранные scopes, 1…168 часов, 256-битный секрет, только SHA-256 в БД, список и отзыв через session-only routes. UI показывает секрет один раз, не хранит его в session/localStorage; изменение по умолчанию выключено. POSIX-файл 0600 в папке 0700, uid и symlink checks; configuration содержит только путь и origin. Подробный контракт, источники и граница transport/API auth: mcp-contract.md.

## Проверено в этой работе

52 прошедших node:test: новый MCP 5, core 9, viewer 8, projects 2, schematic 7, auth policy 4, entity preview 17 (в prebuild). Это свежие запуски, а не прежние 82 теста. Новый MCP включает реальный SDK subprocess initialize/list/call, raw stdout JSON-RPC frames, strict args/неизвестные поля/размеры/materials, owner/project binding, scopes/expiry/revocation, хеш вместо plaintext, отсутствие секрета в ошибках/stdout, no-write read/validate, update revision+1, конкурентный CAS/409, неизменность документа при отказе/пересечении, session-only выдачу/Origin, запрет redirect/retry при неоднозначном исходе и отказ при небезопасном файле. Серверные проверки используют детерминированную SQL-границу и тестовую identity; stdio HTTP-сценарий — loopback fixture. Это не Google OAuth/Neon E2E.

`npx tsc --noEmit`, `npm run build`, `git diff --check` прошли. SDK не найден в `.next/static` (поиск @modelcontextprotocol/structure-mcp); root dependencies не пополнились, зависимости адаптера изолированы собственным package/lockfile. npm audit отдельного пакета: 0 vulnerabilities на момент установки.

Vercel project inspect подтвердил `egorka-dinos-projects/mc-commands`, ID `prj_VLwaXfhYmW6kCPsAAe7WFzg2bJuC`. Первый preview vna6yjp6s выявил переполнение примера config на мобильном; исправлено ограничением прокрутки самого pre. Финальный preview READY: https://mc-commands-1lwnp5516-egorka-dinos-projects.vercel.app/structures, deployment `dpl_2iDUzjT1y3CqUordaEvyLLiWbL7F`.

На финальном preview проверены desktop 1440×1000 и mobile 390×844, раскрытие формы, блокировка выдачи без входа, default read+validate при выключенном update, ссылка на настройку. После загрузки CSS documentWidth=375 при viewport 390 на /structures и /structures/mcp, горизонтального переполнения страницы нет; длинный config прокручивается внутри pre. На desktop добавлена локальная комната: 3D с текстурами отображается, dirty появился, sessionStorage содержит project/baseline/cloud без секрета. Полёт, WebGL-loss и все материалы заново вручную не прогонялись; соответствующие регрессии viewer выполнены. На первом preview анонимные GET проекта/делегирований возвращали 401 и private/no-store. Неавторизованная форма — не доказательство авторизованного выпуска/отзыва.

## Не закрыто

Реальное делегирование в пользовательском аккаунте не выпускалось и не использовалось. Запрошено отдельное согласие на новый проект `MCP QA 2026-11-01`, get_project/update_instance/validate_structure, срок 1 час, изменение только тестовой комнаты, затем отзыв и удаление локального секрета. До согласия эти действия не выполнять.

Callback финального preview: `https://mc-commands-1lwnp5516-egorka-dinos-projects.vercel.app/api/auth/callback/google`. Его регистрация не подтверждена; Google-настройки агент не менял. Прежде подтверждённый callback nzkv8xbbs не означает доступность входа на новом preview и не содержит новый код. Пользователю предложено зарегистрировать новый callback самостоятельно. В этой работе Google login на новом preview ещё не проверялся; возможный redirect_uri_mismatch не утверждается без наблюдения.

После согласия и доступного OAuth нужно пройти: настоящий вход → отдельный QA-проект → выпуск/приватная доставка секрета → MCP get/update/validate → ручная загрузка новой серверной версии → экспорт .schem. Отдельно dirty: прежняя локальная сцена сохраняется, stale save получает 409, отказ от загрузки сохраняет черновик, подтверждение загружает сервер. Затем реальный отзыв → 401, удаление QA-файла. Эти пункты не заменять тестовыми JWT, моками или старой экспортной приёмкой. Новая схема делегирований на настоящем Neon также ещё не проверена.

Приёмка .schem этапа 5 остаётся принятой на ранее предоставленной Minecraft 26.3/Fabric/WorldEdit 7.4.6; её повторная ручная проверка не проводилась. Minecraft-сервер, миры и схемы не менялись. Merge/push/production/Telegram не выполнялись. Следующий handoff — mcp-acceptance-prompt.md; batch отложен до завершения этой приёмки.
