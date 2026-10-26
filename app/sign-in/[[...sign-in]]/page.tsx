import { redirect } from "next/navigation";
import { AuthActionButton } from "../../components/AuthActionButton";
import { getSafeRedirectUrl, isGoogleAuthConfigured } from "../../server/auth-policy";
import { getAuthUser } from "../../server/auth";

export const dynamic = "force-dynamic";
type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function SignInPage({ searchParams }: Props) {
  const params = await searchParams;
  const redirectUrl = getSafeRedirectUrl(params?.redirect_url);
  if (!isGoogleAuthConfigured()) return <main className="auth-page">Вход через Google ещё не настроен.</main>;
  if (await getAuthUser()) redirect(redirectUrl === "/sign-in" ? "/" : redirectUrl);

  return (
    <main className="auth-page">
      <section className="admin-panel">
        <h1>Вход через Google</h1>
        {params?.error ? <p role="alert">Не удалось войти. Попробуй ещё раз и разреши вход в Google.</p>
          : <p>Открываем Google для входа...</p>}
        <AuthActionButton action="sign-in" redirectUrl={redirectUrl} autoStart={!params?.error} />
        <p><a href={redirectUrl}>Вернуться на сайт</a></p>
      </section>
    </main>
  );
}
