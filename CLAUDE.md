# mc-commands
  Генераторы команд Minecraft Java Edition 1.21.5+.

  ## Структура файлов
  - `index.html` — лендинг mc-commands
  - `summon.html` — генератор /summon
  - `give.html` — генератор /give
  - `style.css` — общий CSS

  ## Ключевые факты
  - Формат предметов: components:{enchantments:{id:lvl}} (без levels, было в 1.20.5)
  - Снаряжение мобов: единый блок equipment:{head, chest, legs, feet, mainhand, offhand}
  - /give: компоненты в квадратных скобках [comp=val,...], формат 1.21.5
  - Деплой: Vercel, production URL `https://mc-summon.vercel.app`; кастомный домен `mc-commands.egorka.fun`

  ## Стиль
  - Интерфейс на русском
  - Без внешних зависимостей кроме Google Fonts
  - Ни фреймворков, ни сборки
