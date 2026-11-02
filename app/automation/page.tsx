import { AuthError } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { automationEnabled } from "../server/automation-auth";
import { signIn } from "../server/google-auth";

export const dynamic = "force-dynamic";

export default async function AutomationPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!automationEnabled()) notFound();
  const { error } = await searchParams;
  return (
    <main className="auth-page">
      <section className="admin-panel">
        <h1>Сервисный вход</h1>
        <p>Отдельная учетная запись Codex. Сессия действует 5 минут с момента входа.</p>
        <p>Роль администратора дает доступ к админке и выполнению команд на серверах.</p>
        {error ? <p role="alert">Не удалось войти. Проверьте ключ и доступность сервисного входа.</p> : null}
        <form action={async (formData: FormData) => {
          "use server";
          if (!automationEnabled()) notFound();
          const role = formData.get("role");
          try {
            await signIn("automation", {
              key: formData.get("key"), role,
              redirectTo: role === "admin" ? "/admin" : "/locations",
            });
          } catch (error) {
            if (error instanceof AuthError) redirect("/automation?error=invalid");
            throw error;
          }
        }}>
          <p><label htmlFor="automation-key">Ключ сервисного доступа</label><br />
            <input id="automation-key" name="key" type="password" autoComplete="off" spellCheck={false} maxLength={512} required /></p>
          <p><label htmlFor="automation-role">Роль</label><br />
            <select id="automation-role" name="role" defaultValue="member">
              <option value="member">Пользователь</option>
              <option value="admin">Администратор</option>
            </select></p>
          <button className="auth-button" type="submit">Войти на 5 минут</button>
        </form>
        <p><a href="/">Вернуться на сайт</a></p>
      </section>
    </main>
  );
}
