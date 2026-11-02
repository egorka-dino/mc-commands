giveEditor = component "Редактор предметов" "ItemEditor: публичный /give и редактор админской библиотеки в adminMode." "React" {
    url https://github.com/egorka-dino/mc-commands/blob/main/app/components/give/ItemEditor.tsx
}
summonEditor = component "Редактор мобов" "MobEditor: публичный /summon и редактор админской библиотеки в adminMode." "React" {
    url https://github.com/egorka-dino/mc-commands/blob/main/app/components/summon/MobEditor.tsx
}
assistant = component "AI-помощник" "CommandAssistant и useCommandAssistant отправляют prompt и snapshot, применяют проверенные изменения." "React / HTTP JSON" {
    url https://github.com/egorka-dino/mc-commands/tree/main/app/components/command-assistant
}
preview = component "3D-preview моба" "EntityPreview, preview-scene и preview-material визуализируют моба и снаряжение." "Three.js" {
    url https://github.com/egorka-dino/mc-commands/blob/main/app/components/summon/EntityPreview.tsx
}
locations = component "Редактор мест" "Анонимные места в браузере; синхронизация и импорт в аккаунт через API." "React" {
    url https://github.com/egorka-dino/mc-commands/blob/main/app/components/locations/LocationsEditor.tsx
}
adminUi = component "Админский интерфейс" "Клиентские панели библиотек, публикаций серверов и сценариев." "React" {
    url https://github.com/egorka-dino/mc-commands/tree/main/app/admin
}
executor = component "Выполнение команды" "ServerCommandExecutor отправляет snapshot, сервер, игрока и параметры выполнения." "React / HTTP JSON" {
    url https://github.com/egorka-dino/mc-commands/blob/main/app/components/ServerCommandExecutor.tsx
}
localStorage = component "Локальные данные" "Коллекции give/summon, анонимные места и выбор AI-провайдера. Внутри браузера; не отдельный сервис." "Web Storage API" {
    tags "Local Storage"
}
