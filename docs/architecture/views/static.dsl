systemContext mc "context" "C1: игрок, администратор, приложение и внешние системы." {
    include *
    include minecraft
    autoLayout lr
}
container mc "containers" "C2: браузер, серверное приложение на Vercel и Neon Postgres." {
    include *
    include minecraft
    autoLayout lr
}
component mc.browser "browser-components" "C3: компоненты браузера. Общие генераторы также используются сервером." {
    include *
    autoLayout lr
}
component mc.server "server-components" "C3: все серверные компоненты." {
    include *
    autoLayout lr
}
// Те же элементы модели используются повторно в тематических представлениях.
component mc.browser "editors" "C3: общие редакторы публичных генераторов и админских библиотек." {
    include mc.browser.giveEditor mc.browser.summonEditor mc.browser.giveEngine mc.browser.summonEngine mc.browser.preview mc.browser.assistant mc.browser.adminUi mc.browser.localStorage mc.server.ai
    autoLayout lr
}
component mc.server "server-execution" "C3: выполнение команд и сценариев, включая общие генераторы." {
    include mc.server.execution mc.server.auth mc.server.repositories mc.server.scenarios mc.server.commands mc.server.giveEngine mc.server.summonEngine mc.server.exarotonClient exaroton
    autoLayout lr
}
