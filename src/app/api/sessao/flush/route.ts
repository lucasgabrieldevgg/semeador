import { NextResponse } from "next/server";
import { processarSessoesInativas } from "@/lib/zapia";

export const dynamic = "force-dynamic";

/**
 * POST /api/sessao/flush
 * Encerra uma sessão e dispara o relatório para a Zapia Max.
 *
 * Chamado pelo client em 2 situações:
 *  1. Timer de inatividade de 10 min no navegador (fetch normal);
 *  2. Fechamento do app/aba (navigator.sendBeacon no evento pagehide).
 *
 * Body: { sessaoId: string, motivo?: "timeout" | "fechamento" }
 */
export async function POST(req: Request) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      /* sendBeacon pode mandar body como text/plain */
      const txt = await req.text().catch(() => "");
      if (txt) body = JSON.parse(txt);
    }

    const { sessaoId, motivo } = body ?? {};
    if (!sessaoId) {
      return NextResponse.json({ erro: "sessaoId obrigatório." }, { status: 400 });
    }

    const resultado = await processarSessoesInativas({
      sessaoId,
      forcar: motivo === "fechamento", // ao fechar o app, envia imediatamente
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (e: any) {
    console.error("[api/sessao/flush]", e);
    return NextResponse.json({ erro: "Erro ao processar sessão." }, { status: 500 });
  }
}
