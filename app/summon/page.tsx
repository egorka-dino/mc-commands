import { SummonEditor } from "../components/summon/SummonEditor";
import type { SummonTemplateLike } from "../components/summon/data";
import { getDatabaseUrlStatus } from "../server/db";
import { listSummonTemplates } from "../server/summon-templates";

export const dynamic = "force-dynamic";

export default async function SummonPage() {
  let templates: SummonTemplateLike[] = [];

  if (getDatabaseUrlStatus().configured) {
    try {
      templates = await listSummonTemplates();
    } catch {
      templates = [];
    }
  }

  return (
    <>
      <header>
        <h1>ГЕНЕРАТОР /SUMMON</h1>
        <p>Minecraft Java Edition 1.21.5 и новее · React</p>
      </header>
      <main className="container">
        <SummonEditor templates={templates} />
        <section className="panel">
          <h2>Как пользоваться</h2>
          <p className="summon-help">
            1. Настрой основного моба или нажми “Случайно”.<br />
            2. Хочешь куриного жокея? Жми “+ Добавить пассажира” — появится карточка с теми же настройками.<br />
            3. Можно добавлять сколько угодно пассажиров: первый сидит на основном, второй на первом, и т.д.<br />
            4. Клик по шапке карточки сворачивает её, чтобы не мешала.<br />
            5. Команда обновляется автоматически. Копируй и вставляй в чат или командный блок.
          </p>
        </section>
      </main>
      <footer>v4.0 · общий React-редактор мобов</footer>
    </>
  );
}
