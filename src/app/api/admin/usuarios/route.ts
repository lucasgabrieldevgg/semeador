import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const NOMES_RESERVADOS = ["adalberto", "batalha2026"];

/**
 * GERENCIAMENTO COMPLETO DE CONTAS (Painel Admin)
 *
 * GET    /api/admin/usuarios
 *        Lista todas as contas com dados completos (criação, presença,
 *        online, nº de respostas, taxa, mensagens não lidas).
 *
 * POST   /api/admin/usuarios   { nome }
 *        Cria uma conta manualmente.
 *
 * PATCH  /api/admin/usuarios   { usuarioId, acao: "renomear", novoNome }
 *        /api/admin/usuarios   { usuarioId, acao: "limpar_progresso" }
 *
 * DELETE /api/admin/usuarios   { usuarioId }            (uma conta)
 *        /api/admin/usuarios   { usuarioIds: [...] }    (várias contas)
 */

const ONLINE_LIMIAR_MS = 75_000;

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [usuariosRes, logsRes, msgsRes] = await Promise.all([
      supabase
        .from("usuarios")
        .select("id, nome, criado_em, ultima_presenca")
        .order("criado_em", { ascending: false }),
      supabase
        .from("logs_desempenho")
        .select("usuario_id, resultado")
        .limit(10000),
      supabase
        .from("mensagens_admin")
        .select("usuario_id, lida")
        .eq("lida", false),
    ]);

    const logs = logsRes.data ?? [];
    const stats: Record<string, { total: number; acertos: number }> = {};
    for (const l of logs) {
      stats[l.usuario_id] ??= { total: 0, acertos: 0 };
      stats[l.usuario_id].total++;
      if (l.resultado) stats[l.usuario_id].acertos++;
    }

    const msgsNaoLidas: Record<string, number> = {};
    for (const m of msgsRes.data ?? []) {
      if (m.usuario_id) msgsNaoLidas[m.usuario_id] = (msgsNaoLidas[m.usuario_id] ?? 0) + 1;
    }

    const agora = Date.now();
    const contas = (usuariosRes.data ?? []).map((u) => {
      const s = stats[u.id];
      return {
        id: u.id,
        nome: u.nome,
        criado_em: u.criado_em,
        ultima_presenca: u.ultima_presenca,
        online: u.ultima_presenca
          ? agora - new Date(u.ultima_presenca).getTime() < ONLINE_LIMIAR_MS
          : false,
        total_respostas: s?.total ?? 0,
        taxa: s?.total ? Math.round((s.acertos / s.total) * 100) : null,
        mensagens_nao_lidas: msgsNaoLidas[u.id] ?? 0,
      };
    });

    return NextResponse.json({ contas });
  } catch (e: any) {
    console.error("[api/admin/usuarios GET]", e);
    return NextResponse.json({ erro: "Erro ao listar contas." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { nome } = await req.json();
    const nomeLimpo = String(nome ?? "").trim();
    if (nomeLimpo.length < 2 || nomeLimpo.length > 40) {
      return NextResponse.json({ erro: "Nome deve ter de 2 a 40 caracteres." }, { status: 400 });
    }
    if (NOMES_RESERVADOS.includes(nomeLimpo.toLowerCase())) {
      return NextResponse.json({ erro: "Esse nome é reservado." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { data: existente } = await supabase
      .from("usuarios")
      .select("id")
      .ilike("nome", nomeLimpo)
      .maybeSingle();
    if (existente) {
      return NextResponse.json({ erro: "Já existe um aluno com esse nome." }, { status: 409 });
    }
    const { data, error } = await supabase
      .from("usuarios")
      .insert({ nome: nomeLimpo })
      .select("id, nome")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, mensagem: `Conta "${data.nome}" criada.`, usuario: data });
  } catch (e: any) {
    console.error("[api/admin/usuarios POST]", e);
    return NextResponse.json({ erro: "Erro ao criar conta." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { usuarioId, acao, novoNome } = await req.json();
    if (!usuarioId || !acao) {
      return NextResponse.json({ erro: "usuarioId e acao são obrigatórios." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();

    if (acao === "renomear") {
      const nome = String(novoNome ?? "").trim();
      if (nome.length < 2 || nome.length > 40) {
        return NextResponse.json({ erro: "Nome deve ter de 2 a 40 caracteres." }, { status: 400 });
      }
      if (NOMES_RESERVADOS.includes(nome.toLowerCase())) {
        return NextResponse.json({ erro: "Esse nome é reservado." }, { status: 400 });
      }
      const { data: existente } = await supabase
        .from("usuarios")
        .select("id")
        .ilike("nome", nome)
        .neq("id", usuarioId)
        .maybeSingle();
      if (existente) {
        return NextResponse.json({ erro: "Já existe um aluno com esse nome." }, { status: 409 });
      }
      const { error } = await supabase.from("usuarios").update({ nome }).eq("id", usuarioId);
      if (error) throw error;
      return NextResponse.json({ ok: true, mensagem: `Aluno renomeado para "${nome}".` });
    }

    if (acao === "limpar_progresso") {
      const r1 = await supabase.from("logs_desempenho").delete().eq("usuario_id", usuarioId);
      if (r1.error) throw r1.error;
      const r2 = await supabase.from("sessoes_quiz").delete().eq("usuario_id", usuarioId);
      if (r2.error) throw r2.error;
      return NextResponse.json({ ok: true, mensagem: "Progresso de quiz zerado." });
    }

    return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
  } catch (e: any) {
    console.error("[api/admin/usuarios PATCH]", e);
    return NextResponse.json({ erro: "Erro ao atualizar usuário." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const ids: string[] = body.usuarioIds ?? (body.usuarioId ? [body.usuarioId] : []);
    if (!ids.length) {
      return NextResponse.json({ erro: "Informe usuarioId ou usuarioIds." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();

    const { data: usuarios } = await supabase
      .from("usuarios")
      .select("id, nome")
      .in("id", ids);
    if (!usuarios?.length) {
      return NextResponse.json({ erro: "Nenhuma conta encontrada." }, { status: 404 });
    }

    // vencedor_id em desafios não tem CASCADE — limpa antes
    await supabase.from("desafios").update({ vencedor_id: null }).in("vencedor_id", ids);

    const { error } = await supabase.from("usuarios").delete().in("id", ids);
    if (error) throw error;

    const nomes = usuarios.map((u) => u.nome).join(", ");
    return NextResponse.json({
      ok: true,
      excluidos: usuarios.length,
      mensagem:
        usuarios.length === 1
          ? `Aluno "${nomes}" e todos os seus dados foram excluídos.`
          : `${usuarios.length} contas excluídas (${nomes}) com todos os seus dados.`,
    });
  } catch (e: any) {
    console.error("[api/admin/usuarios DELETE]", e);
    return NextResponse.json({ erro: "Erro ao excluir conta(s)." }, { status: 500 });
  }
}
