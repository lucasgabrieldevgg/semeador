import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * POST /api/quiz/responder
 * Grava cada resposta do quiz em logs_desempenho e mantém a sessão "viva"
 * (atualiza ultima_atividade — base do timeout de 10 minutos).
 *
 * Body: { usuarioId, sessaoId?, capitulo, perguntaId, resultado }
 * Retorna: { ok, sessaoId } (cria a sessão se ainda não existir)
 */
export async function POST(req: Request) {
  try {
    const { usuarioId, sessaoId, capitulo, perguntaId, resultado, respostaMarcada } =
      await req.json();

    if (!usuarioId || !capitulo || !perguntaId || typeof resultado !== "boolean") {
      return NextResponse.json({ erro: "Payload inválido." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const agora = new Date().toISOString();

    // 1) Garante a sessão (cria ou renova)
    let idSessao: string | null = sessaoId ?? null;

    if (idSessao) {
      const { data: sess } = await supabase
        .from("sessoes_quiz")
        .select("id, relatorio_enviado")
        .eq("id", idSessao)
        .maybeSingle();

      // sessão inexistente ou já encerrada => abre uma nova
      if (!sess || sess.relatorio_enviado) idSessao = null;
    }

    if (!idSessao) {
      const { data: nova, error: sessErr } = await supabase
        .from("sessoes_quiz")
        .insert({ usuario_id: usuarioId, iniciada_em: agora, ultima_atividade: agora })
        .select("id")
        .single();
      if (sessErr) throw sessErr;
      idSessao = nova.id;
    } else {
      await supabase
        .from("sessoes_quiz")
        .update({ ultima_atividade: agora })
        .eq("id", idSessao);
    }

    // 2) Grava o log de desempenho (com a alternativa marcada, se a coluna existir)
    const log: Record<string, unknown> = {
      usuario_id: usuarioId,
      capitulo: Number(capitulo),
      pergunta_id: String(perguntaId),
      resultado,
      timestamp: agora,
    };
    if (typeof respostaMarcada === "number") log.resposta_marcada = respostaMarcada;

    let { error: logErr } = await supabase.from("logs_desempenho").insert(log);
    // fallback: banco ainda sem a coluna resposta_marcada => grava sem ela
    if (logErr && /resposta_marcada/i.test(logErr.message ?? "")) {
      delete log.resposta_marcada;
      ({ error: logErr } = await supabase.from("logs_desempenho").insert(log));
    }
    if (logErr) throw logErr;

    return NextResponse.json({ ok: true, sessaoId: idSessao });
  } catch (e: any) {
    console.error("[api/quiz/responder]", e);
    return NextResponse.json({ erro: "Erro ao gravar resposta." }, { status: 500 });
  }
}
