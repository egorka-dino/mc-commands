export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    ok: true,
    app: "mc-commands",
    runtime: "nextjs",
  });
}
