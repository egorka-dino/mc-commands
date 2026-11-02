workspace "mc-commands" "Архитектура генераторов Minecraft Java Edition 1.21.5+. Одна модель для C1, C2, C3 и сценариев." {
    !identifiers hierarchical

    model {
        !include model/people-and-systems.dsl

        mc = softwareSystem "mc-commands" "Генераторы команд, личные места, библиотеки и админские сценарии." {
            url https://github.com/egorka-dino/mc-commands
            browser = container "Браузерный клиент" "Интерактивные редакторы и административный интерфейс." "React / TypeScript" {
                !include model/browser.dsl
                group "Общие модули команд" {
                    !include model/shared-command-engines.dsl
                }
            }
            server = container "Next.js на Vercel" "Server components, HTTP API, авторизация и интеграции. Одна поставка с браузерным клиентом." "Next.js / Node.js" {
                !include model/server.dsl
                group "Общие модули команд" {
                    !include model/shared-command-engines.dsl
                }
            }
            database = container "База приложения" "Библиотеки предметов и мобов, сценарии, публикации серверов и личные места." "Neon Postgres" {
                tags "Database"
            }
        }

        !include model/relationships.dsl
    }

    views {
        !include views/static.dsl
        !include views/dynamic.dsl
        !include views/styles.dsl
    }
}
