import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const TOTAL_CAPITULOS = 20;

/**
 * GET /api/admin/metricas
 * Métricas completas para o painel /admin-dashboard:
 *  - visão geral (alunos, respostas, taxa, ativos hoje/semana)
 *  - desempenho por capítulo (acertos, erros, taxa, alunos que estudaram)
 *  - desempenho detalhado por aluno (por capítulo, progresso, última atividade)
 *  - perguntas mais erradas (top 10)
 *  - atividade recente (últimas 20 respostas)
 *  - mensagens recentes
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const [usuariosRes, logsRes, msgsRes] = await Promise.all([
      supabase.from("usuarios").select("id, nome, criado_em").order("criado_em", { ascending: false }),
      supabase
        .from("logs_desempenho")
        .select("usuario_id, capitulo, pergunta_id, resultado, timestamp")
        .order("timestamp", { ascending: false })
        .limit(5000),
      supabase
        .from("mensagens_admin")
        .select("id, mensagem, lida, criado_em, usuario_id")
        .order("criado_em", { ascending: false })
        .limit(30),
    ]);

    const usuarios = usuariosRes.data ?? [];
    const logs = logsRes.data ?? [];
    const nomePorId = new Map(usuarios.map((u) => [u.id, u.nome]));

    /* ---------- Visão geral ---------- */
    const totalRespostas = logs.length;
    const totalAcertos = logs.filter((l) => l.resultado).length;
    const taxaAcerto = totalRespostas ? Math.round((totalAcertos / totalRespostas) * 100) : 0;

    const agora = Date.now();
    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);
    const seteDias = agora - 7 * 24 * 60 * 60 * 1000;

    const ativosHoje = new Set(
      logs.filter((l) => new Date(l.timestamp).getTime() >= inicioHoje.getTime()).map((l) => l.usuario_id)
    ).size;
    const ativosSemana = new Set(
      logs.filter((l) => new Date(l.timestamp).getTime() >= seteDias).map((l) => l.usuario_id)
    ).size;
    const respostasHoje = logs.filter(
      (l) => new Date(l.timestamp).getTime() >= inicioHoje.getTime()
    ).length;

    /* ---------- Por capítulo ---------- */
    const porCapitulo: Record<
      number,
      { total: number; acertos: number; erros: number; taxa: number; alunos: number }
    > = {};
    const alunosPorCap: Record<number, Set<string>> = {};
    for (const l of logs) {
      porCapitulo[l.capitulo] ??= { total: 0, acertos: 0, erros: 0, taxa: 0, alunos: 0 };
      alunosPorCap[l.capitulo] ??= new Set();
      porCapitulo[l.capitulo].total++;
      l.resultado ? porCapitulo[l.capitulo].acertos++ : porCapitulo[l.capitulo].erros++;
      alunosPorCap[l.capitulo].add(l.usuario_id);
    }
    for (const cap of Object.keys(porCapitulo)) {
      const c = porCapitulo[Number(cap)];
      c.taxa = c.total ? Math.round((c.acertos / c.total) * 100) : 0;
      c.alunos = alunosPorCap[Number(cap)].size;
    }

    // Capítulo mais difícil / mais fácil (mín. 3 respostas)
    let capituloMaisDificil: number | null = null;
    let capituloMaisFacil: number | null = null;
    let piorTaxa = 101, melhorTaxa = -1;
    for (const [cap, st] of Object.entries(porCapitulo)) {
      if (st.total >= 3) {
        if (st.taxa < piorTaxa) { piorTaxa = st.taxa; capituloMaisDificil = Number(cap); }
        if (st.taxa > melhorTaxa) { melhorTaxa = st.taxa; capituloMaisFacil = Number(cap); }
      }
    }

    /* ---------- Perguntas mais erradas (top 10) ---------- */
    const porPergunta: Record<string, { capitulo: number; total: number; erros: number }> = {};
    for (const l of logs) {
      porPergunta[l.pergunta_id] ??= { capitulo: l.capitulo, total: 0, erros: 0 };
      porPergunta[l.pergunta_id].total++;
      if (!l.resultado) porPergunta[l.pergunta_id].erros++;
    }
    const perguntasMaisErradas = Object.entries(porPergunta)
      .filter(([, p]) => p.erros > 0)
      .map(([id, p]) => ({
        pergunta_id: id,
        capitulo: p.capitulo,
        total: p.total,
        erros: p.erros,
        taxa_erro: Math.round((p.erros / p.total) * 100),
      }))
      .sort((a, b) => b.taxa_erro - a.taxa_erro || b.erros - a.erros)
      .slice(0, 10);

    /* ---------- Por aluno (detalhado) ---------- */
    const porUsuario: Record<
      string,
      {
        acertos: number;
        erros: number;
        ultimaAtividade: string | null;
        capitulos: Record<number, { acertos: number; erros: number; taxa: number }>;
      }
    > = {};
    for (const l of logs) {
      porUsuario[l.usuario_id] ??= { acertos: 0, erros: 0, ultimaAtividade: null, capitulos: {} };
      const u = porUsuario[l.usuario_id];
      l.resultado ? u.acertos++ : u.erros++;
      if (!u.ultimaAtividade || l.timestamp > u.ultimaAtividade) u.ultimaAtividade = l.timestamp;
      u.capitulos[l.capitulo] ??= { acertos: 0, erros: 0, taxa: 0 };
      l.resultado ? u.capitulos[l.capitulo].acertos++ : u.capitulos[l.capitulo].erros++;
    }
    for (const u of Object.values(porUsuario)) {
      for (const c of Object.values(u.capitulos)) {
        const t = c.acertos + c.erros;
        c.taxa = t ? Math.round((c.acertos / t) * 100) : 0;
      }
    }

    const usuariosDetalhados = usuarios.map((u) => {
      const d = porUsuario[u.id];
      const total = d ? d.acertos + d.erros : 0;
      const capsEstudados = d ? Object.keys(d.capitulos).length : 0;
      return {
        id: u.id,
        nome: u.nome,
        criado_em: u.criado_em,
        total_respostas: total,
        acertos: d?.acertos ?? 0,
        erros: d?.erros ?? 0,
        taxa: total ? Math.round(((d?.acertos ?? 0) / total) * 100) : null,
        capitulos_estudados: capsEstudados,
        progresso_pct: Math.round((capsEstudados / TOTAL_CAPITULOS) * 100),
        ultima_atividade: d?.ultimaAtividade ?? null,
        por_capitulo: d?.capitulos ?? {},
      };
    });

    /* ---------- Atividade recente ---------- */
    const atividadeRecente = logs.slice(0, 20).map((l) => ({
      aluno: nomePorId.get(l.usuario_id) ?? "?",
      capitulo: l.capitulo,
      pergunta_id: l.pergunta_id,
      resultado: l.resultado,
      timestamp: l.timestamp,
    }));

    return NextResponse.json({
      // visão geral
      totalUsuarios: usuarios.length,
      totalRespostas,
      totalAcertos,
      totalErros: totalRespostas - totalAcertos,
      taxaAcerto,
      ativosHoje,
      ativosSemana,
      respostasHoje,
      capituloMaisDificil,
      capituloMaisFacil,
      // detalhes
      porCapitulo,
      perguntasMaisErradas,
      usuarios: usuariosDetalhados,
      atividadeRecente,
      mensagensRecentes: msgsRes.data ?? [],
    });
  } catch (e: any) {
    console.error("[api/admin/metricas]", e);
    return NextResponse.json({ erro: "Erro ao carregar métricas." }, { status: 500 });
  }
}
