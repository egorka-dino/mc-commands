player = person "Игрок" "Создаёт и копирует команды; сохраняет коллекции и личные места."
admin = person "Администратор" "Управляет библиотеками, серверами и сценариями; выполняет команды."
google = softwareSystem "Google" "Вход через Google OAuth / OpenID Connect." {
    tags "External"
}
openai = softwareSystem "OpenAI API" "AI-помощник для админа и создание черновиков сценариев." {
    tags "External"
}
deepseek = softwareSystem "DeepSeek API" "AI-помощник публичных генераторов." {
    tags "External"
}
exaroton = softwareSystem "Exaroton API" "Состояние серверов, онлайн-игроки и передача команд в консоль." {
    tags "External"
}
minecraft = softwareSystem "Minecraft-сервер" "Исполняет команды Minecraft Java Edition 1.21.5+." {
    tags "External"
}
