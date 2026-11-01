# Следующий шаг: живая приёмка batch

Реализация выполнена в codex/structure-batch-instances от синхронных main/origin/main 76c2c4d. Итоговый preview READY: https://mc-commands-r7v9emuaa-egorka-dinos-projects.vercel.app/structures (dpl_GnCCvXYqmcfUaahJUhZT71aTVf1H). Callback /api/auth/callback/google на этом origin ещё не подтверждён. Код, строгие схемы, отдельный scope, атомарный сервис и API готовы; тесты и reviewable preview описаны в [batch-acceptance.md](batch-acceptance.md), контракт до кода — [batch-contract.md](batch-contract.md). Batch-stage-prompt.md ниже по ссылке остаётся исходным заданием, не командой повторять реализацию.

Работать только в /private/tmp/mc-structure-core-release. Сначала git status/log/fetch и сравнение main/origin; не сбрасывать локальные коммиты и не трогать основную папку. Сохранить существующую batch-ветку и пользовательский исходный batch-stage-prompt.md. Не начинать библиотеку, вложенность, соединение портов, realtime или создание/удаление через MCP.

До живой приёмки получить отдельное согласие на новый проект Batch QA 2026-11-01, get_project/validate_structure/batch_update_instances, срок 1 час, конкретные тестовые операции и отзыв/удаление QA-секрета после проверки. Single update не нужен. Прежнее согласие на MCP и служебный Neon-тест не разрешает выдачу пользовательского доступа. Старый QA 15c4b285-2d0a-43c8-8661-c0b985996747/revision 3 не менять. OAuth нового preview не проверен; callback не добавлять без отдельного разрешения, production aliases/DNS не менять.

После согласия: настоящий Google-вход, новый QA-проект с двумя непересекающимися комнатами; явный выбор get/validate/batch на 1 час; сохранить секрет вне Git в папку 0700/файл 0600 с uid/symlink checks. Через настоящий SDK stdio get, один batch нескольких комнат и get/validate с revision+1. Проверить отказ последнего недопустимого элемента без частичной записи. Сделать dirty в браузере до batch, убедиться в отсутствии автозамены, stale save/409 с сохранением сцены, отмене загрузки без подмены и явном подтверждении серверной версии. Скачать .schem, затем отозвать только QA-доступ, проверить 401, удалить именно локальный QA-файл; проект оставить пользователю. Не выдавать SQL fixture/test identity/JWT за OAuth E2E. Если среда недоступна, записать точный незакрытый пункт.

Закрытая WorldEdit-приёмка не открывается без регрессии; writer Java 1.21.5/DataVersion 4325/Sponge v3 не менять. Не читать защищённый Downloads и не обходить EPERM: для независимого reader пользователь предоставляет файл в доступном месте.

После приёмки обновить отчёт/план/handoff и предложить merge в main и push origin. Выполнять только по новому явному подтверждению; учитывать production deploy от Git integration при push main. Telegram отменён: не отправлять и не предлагать без нового запроса.

## Сохранённый контекст подготовки (до реализации)

Минимальный локальный MCP Structure Studio реализован и прошёл живой сценарий Google→делегирование→stdio get/update/validate→browser dirty/409→ручная загрузка→экспорт→отзыв/401. Подробности и ограничение нового browser-файла (macOS EPERM) — [mcp-acceptance.md](mcp-acceptance.md).

Следующая итерация — отдельный batch. Подготовленный промпт реализации: [batch-stage-prompt.md](batch-stage-prompt.md). Подготовка промпта не означает начало реализации. До кода прочитать AGENTS.md, integration-plan.md, core-format.md, mcp-contract.md, mcp-acceptance.md и текущую документацию; проверить git status/log/main/origin. Работать только в /private/tmp/mc-structure-core-release, основную папку с чужими правками не трогать. Сохранить owner/project/scopes/expiry/revocation, hash-only storage, строгую валидацию, CAS и dirty-подтверждение. Не добавлять create/delete/realtime/вложенность вместе с batch. Для нового реального делегирования и следующего merge/push/production/Telegram получить новое согласие; разрешение текущего пользователя относится к завершению нынешней итерации.

Исходный mcp-stage-prompt.md и промежуточный mcp-acceptance-prompt.md сохранены как история; не использовать их как команду повторять уже закрытую работу.

Подготовлено от синхронных main/origin/main 76c2c4d. Для новой реализации создать новую codex/ ветку; прежнее разрешение на merge/push относилось к завершённой MCP-итерации. Telegram-объявления отменены пользователем; без нового запроса не отправлять и не предлагать.
