import { legacyHtmlResponse } from "../lib/legacy-page";

export const dynamic = "force-dynamic";

export function GET() {
  return legacyHtmlResponse("give", "/give");
}
