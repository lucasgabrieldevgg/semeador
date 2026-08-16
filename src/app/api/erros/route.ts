import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { validarApiKeyZapia } from "@/lib/zapia";
import { getCapitulo } from "@/data/capitulos";

export const dynamic = "force-dynamic";

const LETRAS = ["A", "B", "C", "D"];

/**
 * GET /api/erros?nome=Lucas&capitulo=3
 * (Zapia Max ➡️ Site — Custom Action)
 *
 * Retorna as questões com erro PENDENTE do aluno (última resposta foi erro):
 * pergunta, alternativa que marcou, alternativa correta e nº de erros.
 * Header: x-api-key: <ZAPIA_API_KEY>
 */
export async function GET(req: Request) {
  if (!validarApiKeyZapia(req)) {
    return NextResponse.json({ erro: "API key inválida ou ausente." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const nome = searchParams.get("nome")?.trim();
  const capituloParam = searchParams.get("capitulo");
  const capitulo = capituloParam ? Number(capituloParam) : null;

  if (!nome) {
    return NextResponse.json({ erro: "Parâmetro 'nome' é obrigatório." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id, nome")
      .ilike("nome", nome)
      .maybeSingle();

    if (!usuario) {
      return NextResponse.json(
        { encontrado: false, mensagem_pronta: `Nenhum aluno chamado "${nome}" foi encontrado no app.` },
        { status: 404 }
      );
    }

    let query = supabase
      .from("logs_desempenho")
      .select("capitulo, pergunta_id, resultado, resposta_marcada, timestamp")
      .eq("usuario_id", usuario.id)
      .order("timestamp", { ascending: true })
      .limit(3000);
    if (capitulo) query = query.eq("capitulo", capitulo);

    const { data: logs, error } = await query;
    if (error) throw error;

    if (!logs?.length) {
      const escopo = capitulo ? ` no capítulo ${capitulo}` : "";
      return NextResponse.json({
        encontrado: true,
        usuario: usuario.nome,
        erros_pendentes: [],
        mensagem_pronta: `${usuario.nome} ainda não respondeu nenhuma pergunta${escopo}.`,
      });
    }

    // Estado por pergunta: pendente se a ÚLTIMA resposta foi erro
    const ultima = new Map<
      string,
      { capitulo: number; resultado: boolean; marcadaNoErro: number | null }
    >();
    const vezesErrou = new Map<string, number>();
    for (const l of logs) {
      const ant = ultima.get(l.pergunta_id);
      ultima.set(l.pergunta_id, {
        capitulo: l.capitulo,
        resultado: l.resultado,
        marcadaNoErro: !l.resultado
          ? typeof l.resposta_marcada === "number" ? l.resposta_marcada : null
          : ant?.marcadaNoErro ?? null,
      });
      if (!l.resultado) vezesErrou.set(l.pergunta_id, (vezesErrou.get(l.pergunta_id) ?? 0) + 1);
    }

    const pendentes = Array.from(ultima.entries())
      .filter(([, v]) => !v.resultado)
      .sort((a, b) => a[1].capitulo - b[1].capitulo);

    const escopo = capitulo ? ` no Cap ${capitulo}` : "";
    if (!pendentes.length) {
      return NextResponse.json({
        encontrado: true,
        usuario: usuario.nome,
        erros_pendentes: [],
        mensagem_pronta: `🎉 ${usuario.nome} não tem erros pendentes${escopo}! Todas as questões que errou já foram corrigidas depois.`,
      });
    }

    const detalhes = pendentes.map(([pid, info]) => {
      const cap = getCapitulo(info.capitulo);
      const q = cap?.quiz.find((x) => x.id === pid);
      const vezes = vezesErrou.get(pid) ?? 1;
      return {
        capitulo: info.capitulo,
        pergunta: q?.pergunta ?? pid,
        marcou:
          q && info.marcadaNoErro !== null && info.marcadaNoErro !== undefined
            ? `${LETRAS[info.marcadaNoErro] ?? "?"}) ${q.opcoes[info.marcadaNoErro] ?? "?"}`
            : null,
        correta: q ? `${LETRAS[q.correta]}) ${q.opcoes[q.correta]}` : null,
        vezes_errou: vezes,
      };
    });

    const LIMITE = 10;
    const linhas = detalhes.slice(0, LIMITE).map((d) => {
      let s = `• Cap ${d.capitulo}: ${d.pergunta}`;
      if (d.marcou) s += `\n   ❌ Marcou: ${d.marcou}`;
      if (d.correta) s += `\n   ✅ Certa: ${d.correta}`;
      if (d.vezes_errou > 1) s += `\n   🔁 Errou ${d.vezes_errou}x`;
      return s;
    });
    let mensagem =
      `❌ Erros pendentes de ${usuario.nome}${escopo} (${pendentes.length} questões):\n\n` +
      linhas.join("\n\n");
    if (detalhes.length > LIMITE) {
      mensagem += `\n\n…e mais ${detalhes.length - LIMITE}. Filtre por capítulo para ver o restante.`;
    }
    mensagem += `\n\n💡 Sugestão: peça para ${usuario.nome} usar a Revisão Inteligente 🧠 no app.`;

    return NextResponse.json({
      encontrado: true,
      usuario: usuario.nome,
      capitulo: capitulo ?? "todos",
      total_pendentes: pendentes.length,
      erros_pendentes: detalhes,
      mensagem_pronta: mensagem,
    });
  } catch (e: any) {
    console.error("[api/erros]", e);
    return NextResponse.json({ erro: "Erro interno." }, { status: 500 });
  }
}
