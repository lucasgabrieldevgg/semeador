import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { validarApiKeyZapia, consolidarResumoSessao, SESSAO_TIMEOUT_MS } from "@/lib/zapia";

export const dynamic = "force-dynamic";

/**
 * GET /api/relatorios-pendentes
 * (Zapia Max ➡️ Site — polling/tarefa agendada)
 *
 * Substitui o envio ativo via Z-API: a Zapia chama este endpoint
 * periodicamente e recebe TUDO que aconteceu desde a última chamada:
 *  - relatórios de sessões de estudo encerradas (10+ min inativas);
 *  - duelos finalizados ainda não notificados.
 *
 * Cada item é entregue UMA ÚNICA VEZ (marcado como enviado/notificado).
 * Header: x-api-key: <ZAPIA_API_KEY>
 *
 * Resposta:
 * {
 *   "tem_novidades": true,
 *   "relatorios": [{ "usuario": "Lucas", "resumo_sessao": "..." }],
 *   "duelos": [{ "texto": "Lucas 7 x 9 Maria (Cap 2) — vencedora: Maria" }],
 *   "mensagem_pronta": "texto único formatado para encaminhar ao professor"
 * }
 */
export async function GET(req: Request) {
  if (!validarApiKeyZapia(req)) {
    return NextResponse.json({ erro: "API key inválida ou ausente." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const limite = new Date(Date.now() - SESSAO_TIMEOUT_MS).toISOString();

    /* ---------- 1) Sessões de estudo encerradas ---------- */
    const { data: sessoes } = await supabase
      .from("sessoes_quiz")
      .select("id, usuario_id, iniciada_em, ultima_atividade, usuarios(nome)")
      .eq("relatorio_enviado", false)
      .lte("ultima_atividade", limite);

    const relatorios: { usuario: string; resumo_sessao: string }[] = [];

    for (const sessao of sessoes ?? []) {
      const { data: logs } = await supabase
        .from("logs_desempenho")
        .select("capitulo, pergunta_id, resultado")
        .eq("usuario_id", sessao.usuario_id)
        .gte("timestamp", sessao.iniciada_em)
        .lte("timestamp", sessao.ultima_atividade);

      const nome = (sessao as any).usuarios?.nome ?? "Aluno";
      relatorios.push({
        usuario: nome,
        resumo_sessao: consolidarResumoSessao(logs ?? []),
      });

      await supabase
        .from("sessoes_quiz")
        .update({ relatorio_enviado: true, enviado_em: new Date().toISOString() })
        .eq("id", sessao.id);
    }

    /* ---------- 2) Duelos finalizados não notificados ---------- */
    let duelos: { texto: string }[] = [];
    const duelosRes = await supabase
      .from("desafios")
      .select(
        "id, capitulo, total_perguntas, pontos_desafiante, pontos_desafiado, vencedor_id, desafiante_id, desafiado_id, desafiante:usuarios!desafios_desafiante_id_fkey(nome), desafiado:usuarios!desafios_desafiado_id_fkey(nome)"
      )
      .eq("status", "finalizado")
      .eq("notificado", false);

    // se a coluna 'notificado' ainda não existir, ignora os duelos sem quebrar
    if (!duelosRes.error && duelosRes.data) {
      for (const d of duelosRes.data) {
        const n1 = (d as any).desafiante?.nome ?? "?";
        const n2 = (d as any).desafiado?.nome ?? "?";
        const vencedor =
          d.vencedor_id === null
            ? "empate"
            : d.vencedor_id === d.desafiante_id
            ? `vencedor: ${n1}`
            : `vencedor: ${n2}`;
        duelos.push({
          texto: `⚔️ Duelo Cap ${d.capitulo}: ${n1} ${d.pontos_desafiante} x ${d.pontos_desafiado} ${n2} — ${vencedor}`,
        });
        await supabase.from("desafios").update({ notificado: true }).eq("id", d.id);
      }
    }

    /* ---------- 3) Mensagem pronta para a Zapia encaminhar ---------- */
    const partes: string[] = [];
    if (relatorios.length) {
      partes.push(
        "📚 Relatórios de estudo — Êxodo Quest:\n" +
          relatorios.map((r) => `• ${r.usuario}: ${r.resumo_sessao}`).join("\n")
      );
    }
    if (duelos.length) {
      partes.push("⚔️ Duelos finalizados:\n" + duelos.map((d) => `• ${d.texto}`).join("\n"));
    }

    return NextResponse.json({
      tem_novidades: partes.length > 0,
      relatorios,
      duelos,
      mensagem_pronta: partes.length
        ? partes.join("\n\n")
        : "Nenhuma novidade desde a última verificação.",
    });
  } catch (e: any) {
    console.error("[api/relatorios-pendentes]", e);
    return NextResponse.json({ erro: "Erro ao buscar relatórios." }, { status: 500 });
  }
}
