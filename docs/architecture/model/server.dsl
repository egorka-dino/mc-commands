pages = component "Серверные страницы" "App Router: публичные страницы и защищённые страницы админки." "Next.js Server Components" {
    url https://github.com/egorka-dino/mc-commands/tree/main/app
}
auth = component "Авторизация и права" "Auth.js, Google OAuth, JWT-cookie; getAuthUser и серверные проверки admin." "Auth.js / TypeScript" {
    url https://github.com/egorka-dino/mc-commands/blob/main/app/server/auth.ts
}
api = component "Прикладные API" "Шаблоны, опубликованные серверы, личные места, CRUD библиотек и сценариев." "Next.js Route Handlers" {
    url https://github.com/egorka-dino/mc-commands/tree/main/app/api
}
ai = component "AI API" "Проверяет и применяет AI-операции к snapshot; создаёт AI-черновики сценариев без исполнения." "Route Handlers / TypeScript" {
    url https://github.com/egorka-dino/mc-commands/blob/main/app/api/ai/command/route.ts
}
repositories = component "Модули данных" "library-items, library-mobs, scenarios, locations, exaroton-publications: валидация и SQL-операции." "TypeScript" {
    url https://github.com/egorka-dino/mc-commands/tree/main/app/server
}
db = component "Клиент БД" "getSql(): общий клиент Neon из DATABASE_URL." "@neondatabase/serverless" {
    url https://github.com/egorka-dino/mc-commands/blob/main/app/server/db.ts
}
execution = component "API выполнения" "Защищённые обработчики /api/admin/minecraft/execute и /api/admin/scenarios/execute." "Next.js Route Handlers" {
    url https://github.com/egorka-dino/mc-commands/tree/main/app/api/admin
}
scenarios = component "Исполнение сценариев" "Разворачивает вложенные сценарии, проверяет циклы, ограничивает параллельность действий." "TypeScript" {
    url https://github.com/egorka-dino/mc-commands/blob/main/app/server/scenario-execution.ts
}
commands = component "Подготовка команды" "Проверяет параметры и собирает give/summon/equip через общие генераторы." "TypeScript" {
    url https://github.com/egorka-dino/mc-commands/blob/main/app/server/minecraft-command-execution.ts
}
exarotonClient = component "Клиент Exaroton" "Читает серверы и онлайн-игроков, отправляет команды. API-ключ используется только сервером." "HTTP / TypeScript" {
    url https://github.com/egorka-dino/mc-commands/blob/main/app/server/exaroton.ts
}
