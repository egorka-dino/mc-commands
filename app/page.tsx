import { AuthCorner } from "./components/AuthCorner";

const releases = [
  {
    date: "17 мая 2026",
    items: [
      <>В <strong style={{ color: "var(--accent)" }}>/summon</strong> и <strong style={{ color: "var(--accent-2)" }}>/give</strong> появился <strong>AI-помощник «Собрать словами»</strong>: опиши по-человечески моба или предмет, а сайт заполнит подходящие поля редактора.</>,
    ],
  },
  {
    date: "16 мая 2026",
    items: [
      <>В <strong style={{ color: "var(--accent)" }}>/summon</strong> добавлены <strong>шаблоны мобов</strong>: выбираешь шаблон, и поля моба с пассажирами сразу заполняются.</>,
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
        <AuthCorner currentPath="/" />
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
