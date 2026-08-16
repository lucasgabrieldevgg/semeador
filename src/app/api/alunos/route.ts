import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { validarApiKeyZapia } from "@/lib/zapia";

export const dynamic = "force-dynamic";

const ONLINE_LIMIAR_MS = 75_000;

/**
 * GET /api/alunos
 * (Zapia Max ➡️ Site — Custom Action)
 * Lista todos os alunos com online/offline, respostas e taxa de acerto.
 * Header: x-api-key: <ZAPIA_API_KEY>
 */
export async function GET(req: Request) {
  if (!validarApiKeyZapia(req)) {
    return NextResponse.json({ erro: "API key inválida ou ausente." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const [usuariosRes, logsRes] = await Promise.all([
      supabase.from("usuarios").select("id, nome, criado_em, ultima_presenca").order("nome"),
      supabase.from("logs_desempenho").select("usuario_id, resultado").limit(10000),
    ]);

    const stats: Record<string, { total: number; acertos: number }> = {};
    for (const l of logsRes.data ?? []) {
      stats[l.usuario_id] ??= { total: 0, acertos: 0 };
      stats[l.usuario_id].total++;
      if (l.resultado) stats[l.usuario_id].acertos++;
    }

    const agora = Date.now();
    const alunos = (usuariosRes.data ?? []).map((u) => {
      const s = stats[u.id];
      return {
        nome: u.nome,
        online: u.ultima_presenca
          ? agora - new Date(u.ultima_presenca).getTime() < ONLINE_LIMIAR_MS
          : false,
        total_respostas: s?.total ?? 0,
        taxa_acerto: s?.total ? `${Math.round((s.acertos / s.total) * 100)}%` : null,
        cadastrado_em: u.criado_em,
      };
    });

    const onlines = alunos.filter((a) => a.online).length;
    const linhas = alunos.map(
      (a) =>
        `${a.online ? "🟢" : "⚫"} ${a.nome} — ${
          a.total_respostas ? `${a.taxa_acerto} em ${a.total_respostas} resposta(s)` : "sem atividade"
        }`
    );

    return NextResponse.json({
      total: alunos.length,
      online_agora: onlines,
      alunos,
      mensagem_pronta: alunos.length
        ? `👥 Alunos cadastrados (${alunos.length}) — ${onlines} online agora:\n` + linhas.join("\n")
        : "Nenhum aluno cadastrado ainda.",
    });
  } catch (e: any) {
    console.error("[api/alunos]", e);
    return NextResponse.json({ erro: "Erro interno." }, { status: 500 });
  }
}
