import { readFile } from "node:fs/promises";

const STYLE_FILE = new URL("../../style.css", import.meta.url);

export const dynamic = "force-static";

export async function GET() {
  const css = await readFile(STYLE_FILE, "utf8");

  return new Response(css, {
    headers: {
      "content-type": "text/css; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}
