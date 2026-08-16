import { NextResponse } from "next/server";
import { processarSessoesInativas } from "@/lib/zapia";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/verifica-sessoes
 * Rede de segurança do timeout de 10 minutos: cobre o caso de o usuário
 * fechar o app abruptamente (sendBeacon falhou, celular desligou, etc).
 *
 * Configure no vercel.json:
 *   { "crons": [{ "path": "/api/cron/verifica-sessoes", "schedule": "*\/5 * * * *" }] }
 *
 * Protegido por CRON_SECRET (Vercel envia Authorization: Bearer <CRON_SECRET>).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
    }
  }

  try {
    const resultado = await processarSessoesInativas(); // só sessões com 10+ min de inatividade
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e: any) {
    console.error("[api/cron/verifica-sessoes]", e);
    return NextResponse.json({ erro: "Erro no processamento." }, { status: 500 });
  }
}
