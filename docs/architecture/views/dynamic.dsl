dynamic mc.server "ai-refinement" "AI возвращает проверенные изменения; браузер применяет их и пересобирает команду." {
    mc.browser -> mc.server.ai "Передаёт запрос и текущий snapshot"
    mc.server.ai -> mc.server.auth "Определяет доступного провайдера"
    mc.server.ai -> deepseek "Запрашивает операции для редактора"
    mc.server.ai -> mc.server.giveEngine "Нормализует состояние предмета"
    autoLayout lr
}
dynamic mc.server "scenario-execution" "Администратор исполняет сохранённый сценарий на Minecraft-сервере." {
    mc.browser -> mc.server.execution "Отправляет scenarioId, serverId и игрока"
    mc.server.execution -> mc.server.auth "Проверяет роль admin"
    mc.server.execution -> mc.server.repositories "Загружает сценарии и библиотеки"
    mc.server.execution -> mc.server.scenarios "Запускает сценарий"
    mc.server.scenarios -> mc.server.commands "Собирает команду действия"
    mc.server.commands -> mc.server.giveEngine "Формирует give-команду для действия с предметом"
    mc.server.scenarios -> mc.server.exarotonClient "Отправляет команду"
    mc.server.exarotonClient -> exaroton "Вызывает API консоли"
    exaroton -> minecraft "Исполняет команду"
    autoLayout lr
}
