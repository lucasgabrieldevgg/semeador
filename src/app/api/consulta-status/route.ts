import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { validarApiKeyZapia } from "@/lib/zapia";

export const dynamic = "force-dynamic";

/**
 * GET /api/consulta-status?nome=Lucas&capitulo=3
 * (Zapia Max ➡️ Site — Custom Action)
 *
 * Permite à Zapia buscar o histórico de um usuário quando o Adalberto
 * pergunta no WhatsApp. Protegido por header "x-api-key: <ZAPIA_API_KEY>".
 *
 * Resposta (exemplo):
 * {
 *   "usuario": "Lucas",
 *   "capitulo": 3,
 *   "total_respostas": 5, "acertos": 3, "erros": 2,
 *   "taxa_acerto": "60%",
 *   "resumo_humanizado": "Lucas respondeu 5 perguntas no Cap 3: 3 acertos e 2 erros (60% de acerto).",
 *   "historico": [...]
 * }
 */
export async function GET(req: Request) {
  if (!validarApiKeyZapia(req)) {
    return NextResponse.json({ erro: "API key inválida ou ausente." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const nome = searchParams.get("nome")?.trim();
  const capituloParam = searchParams.get("capitulo");

  if (!nome) {
    return NextResponse.json({ erro: "Parâmetro 'nome' é obrigatório." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id, nome, criado_em")
      .ilike("nome", nome)
      .maybeSingle();

    if (!usuario) {
      return NextResponse.json(
        {
          encontrado: false,
          resumo_humanizado: `Nenhum aluno chamado "${nome}" foi encontrado no app.`,
        },
        { status: 404 }
      );
    }

    let query = supabase
      .from("logs_desempenho")
      .select("capitulo, pergunta_id, resultado, timestamp")
      .eq("usuario_id", usuario.id)
      .order("timestamp", { ascending: false })
      .limit(200);

    const capitulo = capituloParam ? Number(capituloParam) : null;
    if (capitulo) query = query.eq("capitulo", capitulo);

    const { data: logs, error } = await query;
    if (error) throw error;

    const total = logs?.length ?? 0;
    const acertos = logs?.filter((l) => l.resultado).length ?? 0;
    const erros = total - acertos;
    const taxa = total ? Math.round((acertos / total) * 100) : 0;

    // Resumo por capítulo (quando não filtra capítulo específico)
    const porCapitulo: Record<number, { acertos: number; erros: number }> = {};
    for (const l of logs ?? []) {
      porCapitulo[l.capitulo] ??= { acertos: 0, erros: 0 };
      l.resultado ? porCapitulo[l.capitulo].acertos++ : porCapitulo[l.capitulo].erros++;
    }

    const escopo = capitulo ? `no Cap ${capitulo}` : "em todos os capítulos";
    const resumoHumanizado = total
      ? `${usuario.nome} respondeu ${total} pergunta(s) ${escopo}: ${acertos} acerto(s) e ${erros} erro(s) (${taxa}% de acerto).`
      : `${usuario.nome} ainda não respondeu nenhuma pergunta ${escopo}.`;

    return NextResponse.json({
      encontrado: true,
      usuario: usuario.nome,
      capitulo: capitulo ?? "todos",
      total_respostas: total,
      acertos,
      erros,
      taxa_acerto: `${taxa}%`,
      resumo_humanizado: resumoHumanizado,
      desempenho_por_capitulo: porCapitulo,
      historico: logs,
    });
  } catch (e: any) {
    console.error("[api/consulta-status]", e);
    return NextResponse.json({ erro: "Erro interno na consulta." }, { status: 500 });
  }
}
