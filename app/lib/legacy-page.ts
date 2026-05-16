import { readFile } from "node:fs/promises";
import { currentUser } from "@clerk/nextjs/server";

type LegacyPage = "home" | "summon" | "give";
type AuthUser = {
  name: string;
  imageUrl: string | null;
} | null;

const LEGACY_FILES: Record<LegacyPage, URL> = {
  home: new URL("../../index.html", import.meta.url),
  summon: new URL("../../summon.html", import.meta.url),
  give: new URL("../../give.html", import.meta.url),
};

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "x-content-type-options": "nosniff",
};

function normalizeLinks(html: string) {
  return html
    .replaceAll('href="index.html"', 'href="/"')
    .replaceAll('href="summon.html"', 'href="/summon"')
    .replaceAll('href="give.html"', 'href="/give"')
    .replaceAll('href="style.css', 'href="/style.css');
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isClerkConfigured() {
  return (
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    Boolean(process.env.CLERK_SECRET_KEY)
  );
}

async function getAuthUser(): Promise<AuthUser> {
  if (!isClerkConfigured()) {
    return null;
  }

  const user = await currentUser();

  if (!user) {
    return null;
  }

  return {
    name:
      user.fullName ||
      user.primaryEmailAddress?.emailAddress ||
      user.username ||
      "Игрок",
    imageUrl: user.imageUrl || null,
  };
}

function renderAuthCorner(user: AuthUser, currentPath: string) {
  if (!user) {
    if (!isClerkConfigured()) {
      return `
<div class="auth-corner">
  <span class="auth-text">Clerk-вход почти готов: осталось заполнить ключи проекта.</span>
</div>`;
    }

    const callbackUrl = encodeURIComponent(currentPath);

    return `
<div class="auth-corner">
  <a class="auth-button" href="/sign-in?redirect_url=${callbackUrl}">Войти через Google</a>
</div>`;
  }

  const name = escapeHtml(user.name);
  const image = user.imageUrl
    ? `<img src="${escapeHtml(user.imageUrl)}" alt="" class="auth-avatar">`
    : "";
  const callbackUrl = encodeURIComponent(currentPath);

  return `
<div class="auth-corner signed-in">
  <span class="auth-user">${image}<span>${name}</span></span>
  <a class="auth-link" href="/sign-out?redirect_url=${callbackUrl}">Выйти</a>
</div>`;
}

function injectAuthCorner(html: string, user: AuthUser, currentPath: string) {
  return html.replace("</header>", `${renderAuthCorner(user, currentPath)}\n</header>`);
}

export async function legacyHtmlResponse(page: LegacyPage, currentPath: string) {
  const html = await readFile(LEGACY_FILES[page], "utf8");
  const user = await getAuthUser();
  const pageHtml = injectAuthCorner(normalizeLinks(html), user, currentPath);

  return new Response(pageHtml, { headers: HTML_HEADERS });
}
