import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * GET /api/revisao?usuarioId=<uuid>
 * 🧠 MODO REVISÃO INTELIGENTE (repetição espaçada simplificada)
 *
 * Retorna os IDs das perguntas que o aluno mais precisa revisar:
 *  - perguntas cuja ÚLTIMA resposta foi erro (prioridade máxima);
 *  - perguntas com histórico de erros (mesmo que a última tenha sido acerto,
 *    entram com prioridade menor — reforço);
 * Ordenadas por: mais erros primeiro, erro mais recente primeiro.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const usuarioId = searchParams.get("usuarioId");
  if (!usuarioId) return NextResponse.json({ erro: "usuarioId obrigatório." }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();
    const { data: logs, error } = await supabase
      .from("logs_desempenho")
      .select("capitulo, pergunta_id, resultado, timestamp")
      .eq("usuario_id", usuarioId)
      .order("timestamp", { ascending: true })
      .limit(3000);
    if (error) throw error;

    // Estado por pergunta: última resposta + contagem de erros
    const estado = new Map<
      string,
      { capitulo: number; erros: number; acertos: number; ultimaCorreta: boolean; ultimoErro: string | null }
    >();
    for (const l of logs ?? []) {
      const e = estado.get(l.pergunta_id) ?? {
        capitulo: l.capitulo, erros: 0, acertos: 0, ultimaCorreta: true, ultimoErro: null,
      };
      if (l.resultado) e.acertos++;
      else { e.erros++; e.ultimoErro = l.timestamp; }
      e.ultimaCorreta = l.resultado;
      e.capitulo = l.capitulo;
      estado.set(l.pergunta_id, e);
    }

    const paraRevisar = Array.from(estado.entries())
      .filter(([, e]) => e.erros > 0) // só perguntas que já errou alguma vez
      .map(([id, e]) => ({
        pergunta_id: id,
        capitulo: e.capitulo,
        erros: e.erros,
        acertos: e.acertos,
        pendente: !e.ultimaCorreta, // última foi erro => ainda não dominou
        ultimo_erro: e.ultimoErro,
      }))
      .sort((a, b) => {
        if (a.pendente !== b.pendente) return a.pendente ? -1 : 1;
        if (b.erros !== a.erros) return b.erros - a.erros;
        return (b.ultimo_erro ?? "").localeCompare(a.ultimo_erro ?? "");
      })
      .slice(0, 20); // sessão de revisão: até 20 perguntas

    return NextResponse.json({
      total: paraRevisar.length,
      pendentes: paraRevisar.filter((p) => p.pendente).length,
      perguntas: paraRevisar,
    });
  } catch (e) {
    console.error("[api/revisao]", e);
    return NextResponse.json({ erro: "Erro ao montar revisão." }, { status: 500 });
  }
}
