const releases = [
  {
    date: "16 октября 2026",
    items: [<>В <strong>/summon</strong> описание моба можно надиктовать через микрофон в поддерживаемом браузере: проверь распознанный текст и примени его к текущему мобу или собери нового.</>, <>В <strong>/summon</strong> и <strong>/give</strong> помощник "Собрать словами" умеет дорабатывать текущего моба или предмет последовательными запросами с учётом ручных правок: добавлять и убирать чары, снаряжение, эффекты и другие настройки. Есть история, отмена последней AI-правки и сборка заново.</>, <>3D-модель в <strong>/summon</strong> можно развернуть почти на всё окно кнопкой "Развернуть"; вращение и приближение сохраняются.</>, <>В <strong>/summon</strong> 3D-предпросмотр расширен на весь каталог конструктора: <strong>94 сущности и 69 предметов снаряжения</strong>. Добавлены головы, элитры, трезубцы, булавы, щиты и флаги с узорами, окраска и отделки брони. Предметы отображаются с учётом игровых слоёв и поз; облако эффекта пока остаётся без частиц. Версия моделей — Minecraft Java 26.1.2.</>],
  },
  {
    date: "15 октября 2026",
    items: [<>В <strong>/summon</strong> появился экспериментальный <strong>3D-предпросмотр</strong> зомби, скелета, лошади, жителя и разорителя: вращение, приближение, броня у зомби и скелета, цепочки пассажиров и выбор окраса лошади. Модели соответствуют Minecraft Java 26.1.2; ограничения указаны под просмотром.</>],
  },
  {
    date: "1 июня 2026",
    items: [
      <>Появился раздел <strong>«Места»</strong>: можно сохранять личные координаты Minecraft, фильтровать их, копировать X Y Z и переносить локальные точки в аккаунт после входа.</>,
    ],
  },
  {
    date: "17 мая 2026",
    items: [
      <>Появилась страница <strong>«Серверная»</strong>: там можно посмотреть адреса серверов сообщества, онлайн игроков, версии и выбрать, куда зайти поиграть.</>,
      <>Навигация переехала в <strong>верхнюю панель</strong>: с любой страницы можно быстро открыть <strong>Командный хаб</strong>, <strong style={{ color: "var(--accent)" }}>/summon</strong> и <strong style={{ color: "var(--accent-2)" }}>/give</strong>.</>,
      <>В <strong style={{ color: "var(--accent)" }}>/summon</strong> и <strong style={{ color: "var(--accent-2)" }}>/give</strong> для флагов добавлены те же <strong>узоры и слои</strong>, что и для щитов: базовый цвет, до 16 слоёв и все vanilla-узоры.</>,
      <>AI-помощник <strong>«Собрать словами»</strong> теперь возвращает компактный план без лишних пустых полей, поэтому описания мобов и предметов должны применяться быстрее.</>,
      <>В <strong style={{ color: "var(--accent)" }}>/summon</strong> и <strong style={{ color: "var(--accent-2)" }}>/give</strong> уровни зачарований теперь можно поднимать до <strong>255</strong>, а обычный ванильный максимум показывается только как подсказка.</>,
      <>В <strong style={{ color: "var(--accent-2)" }}>/give</strong> добавлен <strong>предпросмотр предмета</strong>: до копирования команды видно имя, количество, цель, лор, чары и особые компоненты.</>,
      <>В числовые поля <strong style={{ color: "var(--accent)" }}>/summon</strong> и <strong style={{ color: "var(--accent-2)" }}>/give</strong> вернулись жёсткие лимиты: уровни чар, количество, эффекты и шансы сразу исправляются до допустимых значений.</>,
      <>В <strong style={{ color: "var(--accent)" }}>/summon</strong> и <strong style={{ color: "var(--accent-2)" }}>/give</strong> появился <strong>AI-помощник «Собрать словами»</strong>: опиши по-человечески моба или предмет, а сайт заполнит подходящие поля редактора.</>,
    ],
  },
  {
    date: "16 мая 2026",
    items: [
      <>В <strong style={{ color: "var(--accent)" }}>/summon</strong> добавлена <strong>библиотека готовых мобов</strong>: выбираешь моба, и поля с пассажирами сразу заполняются.</>,
      <>В <strong style={{ color: "var(--accent-2)" }}>/give</strong> длинные команды теперь умнее: если команда нужна для командного блока, цель <code>@s</code> автоматически меняется на <code>@p</code>, чтобы предмет получил ближайший игрок, а не сам блок.</>,
      <>В <strong style={{ color: "var(--accent-2)" }}>/give</strong> появилась кнопка <strong>Случайно</strong>: она собирает случайный предмет с количеством, именем, лором, чарами и подходящими компонентами.</>,
    ],
  },
  {
    date: "15 мая 2026",
    items: [
      <>В <strong style={{ color: "var(--accent)" }}>/summon</strong> появилась кнопка <strong>Случайно</strong>: она генерирует случайного моба с характеристиками, снаряжением, эффектами и пассажирами.</>,
    ],
  },
  {
    date: "14 мая 2026",
    items: [
      <>В <strong style={{ color: "var(--accent)" }}>/summon</strong> добавлен <strong>фаерболл</strong>: можно настроить направление полёта и мощность взрыва.</>,
    ],
  },
  {
    date: "5 мая 2026",
    items: [
      <>В <strong style={{ color: "var(--accent)" }}>/summon</strong> добавлен <strong>предпросмотр</strong>: видно основного моба, пассажиров, снаряжение, эффекты и важные флаги до копирования команды.</>,
    ],
  },
];

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <header>
        <h1>MC-COMMANDS</h1>
        <p>Генераторы команд для Minecraft Java Edition 1.21.5+</p>
      </header>

      <main>
        <section className="container landing-container">
          <div className="landing-grid">
            <a href="/summon" className="cmd-card summon">
              <div className="cmd-title">/SUMMON</div>
              <div className="cmd-desc">Создать моба с кастомными параметрами: снаряжение, зачарования, пассажиры, эффекты, атрибуты</div>
              <span className="cmd-arrow">▶</span>
            </a>
            <a href="/give" className="cmd-card give">
              <div className="cmd-title">/GIVE</div>
              <div className="cmd-desc">Выдать предмет игроку: зачарования, еда с эффектами, фейерверки, тотем-поведение для любого предмета</div>
              <span className="cmd-arrow">▶</span>
            </a>
            <a href="/locations" className="cmd-card locations">
              <div className="cmd-title">МЕСТА</div>
              <div className="cmd-desc">Сохранить личные координаты: базы, порталы, сундуки, фермы, структуры и опасные точки</div>
              <span className="cmd-arrow">▶</span>
            </a>
            <a href="/servers" className="cmd-card servers">
              <div className="cmd-title">СЕРВЕРНАЯ</div>
              <div className="cmd-desc">Открыть серверы сообщества: адрес, статус, онлайн и версию, чтобы выбрать, куда зайти поиграть</div>
              <span className="cmd-arrow">▶</span>
            </a>
          </div>
        </section>

        <section className="container landing-container">
          <div className="panel news-panel">
            <h2>Что нового</h2>
            {releases.map((release) => (
              <div className="release-block" key={release.date}>
                <p className="release-date">{release.date}</p>
                <ul>
                  {release.items.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              </div>
            ))}
            <div>
              <p className="release-date">26 апреля 2026</p>
              <p>Теперь есть генератор <strong style={{ color: "var(--accent-2)" }}>/give</strong> — можно выдать себе любой предмет с крутыми параметрами:</p>
              <ul>
                <li>Зачарования — выбираешь и сразу видишь команду</li>
                <li>Еда с эффектами — например, яблоко которое даёт невидимость</li>
                <li>Тотем бессмертия на любом предмете — хочешь, чтобы палка тебя спасала?</li>
                <li>Фейерверки — настраиваешь форму, цвета и сколько взрывов</li>
                <li>Кожаная броня — красишь в любой цвет</li>
                <li>Любимчики — сохраняешь нужные предметы чтобы не настраивать заново</li>
              </ul>
              <p style={{ margin: "16px 0 0" }}>В <strong style={{ color: "var(--accent)" }}>/summon</strong> появилась галочка <strong>Босс</strong> — она добавляет мобу тег <code>boss</code> для bossbar-мода.</p>
              <p className="release-note">
                Внутри подсказки есть ссылка на релизы серверного мода:{" "}
                <a href="https://github.com/egorka-dino/minecraft-mod-mob-bossbar/releases/" target="_blank" rel="noopener">minecraft-mod-mob-bossbar</a>
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer>v1.0 · Minecraft Java Edition 1.21.5+</footer>
    </>
  );
}
