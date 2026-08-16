import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/** Notifica o grupo de relatórios no WhatsApp quando um duelo termina */
async function notificarDueloFinalizado(desafioId: string) {
  try {
    const id = process.env.ZAPI_INSTANCE_ID;
    const token = process.env.ZAPI_INSTANCE_TOKEN;
    const clientToken = process.env.ZAPI_CLIENT_TOKEN;
    const destino = process.env.REPORT_GROUP_ID || process.env.ADMIN_PHONE;
    if (!id || !token || !destino) return;

    const supabase = getSupabaseAdmin();
    const { data: d } = await supabase
      .from("desafios")
      .select(
        "capitulo, total_perguntas, pontos_desafiante, pontos_desafiado, vencedor_id, desafiante_id, desafiado_id, desafiante:usuarios!desafios_desafiante_id_fkey(nome), desafiado:usuarios!desafios_desafiado_id_fkey(nome)"
      )
      .eq("id", desafioId)
      .single();
    if (!d) return;

    const n1 = (d as any).desafiante?.nome ?? "?";
    const n2 = (d as any).desafiado?.nome ?? "?";
    const resultado =
      d.vencedor_id === null
        ? "🤝 *Empate!*"
        : `🏆 Vencedor: *${d.vencedor_id === d.desafiante_id ? n1 : n2}*`;

    await fetch(`https://api.z-api.io/instances/${id}/token/${token}/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(clientToken ? { "Client-Token": clientToken } : {}),
      },
      body: JSON.stringify({
        phone: destino,
        message:
          `⚔️ *Duelo finalizado — Êxodo Quest*\n\n` +
          `📖 Capítulo ${d.capitulo} · ${d.total_perguntas} perguntas\n` +
          `${n1}: *${d.pontos_desafiante}* ✕ *${d.pontos_desafiado}* :${n2}\n\n` +
          resultado,
      }),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => {});
  } catch (e) {
    console.error("[desafios] falha ao notificar duelo:", e);
  }
}

/**
 * GET /api/desafios?usuarioId=<uuid>
 * Lista desafios do usuário:
 *  - convites pendentes recebidos (para a notificação)
 *  - desafios ativos (aceitos, em andamento)
 *  - histórico recente finalizado
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const usuarioId = searchParams.get("usuarioId");
  if (!usuarioId) return NextResponse.json({ erro: "usuarioId obrigatório." }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("desafios")
      .select(
        "id, desafiante_id, desafiado_id, capitulo, status, total_perguntas, pontos_desafiante, pontos_desafiado, prog_desafiante, prog_desafiado, vencedor_id, criado_em, desafiante:usuarios!desafios_desafiante_id_fkey(nome), desafiado:usuarios!desafios_desafiado_id_fkey(nome)"
      )
      .or(`desafiante_id.eq.${usuarioId},desafiado_id.eq.${usuarioId}`)
      .order("criado_em", { ascending: false })
      .limit(30);
    if (error) throw error;

    const desafios = (data ?? []).map((d: any) => ({
      ...d,
      desafiante_nome: d.desafiante?.nome ?? "?",
      desafiado_nome: d.desafiado?.nome ?? "?",
    }));

    return NextResponse.json({
      pendentes_recebidos: desafios.filter(
        (d) => d.status === "pendente" && d.desafiado_id === usuarioId
      ),
      pendentes_enviados: desafios.filter(
        (d) => d.status === "pendente" && d.desafiante_id === usuarioId
      ),
      ativos: desafios.filter((d) => d.status === "aceito"),
      finalizados: desafios.filter((d) => d.status === "finalizado").slice(0, 10),
    });
  } catch (e) {
    console.error("[api/desafios GET]", e);
    return NextResponse.json({ erro: "Erro ao listar desafios." }, { status: 500 });
  }
}

/**
 * POST /api/desafios
 * Ações sobre desafios. Body: { acao, ... }
 *  - { acao: "criar", desafianteId, desafiadoId, capitulo }
 *  - { acao: "aceitar", desafioId }
 *  - { acao: "recusar", desafioId }
 *  - { acao: "responder", desafioId, usuarioId, acertou }   -> grava 1 resposta no duelo
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    switch (body.acao) {
      case "criar": {
        const { desafianteId, desafiadoId, capitulo } = body;
        if (!desafianteId || !desafiadoId || !capitulo || desafianteId === desafiadoId) {
          return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
        }
        // evita duplicar convite pendente entre os mesmos jogadores
        const { data: existente } = await supabase
          .from("desafios")
          .select("id")
          .eq("desafiante_id", desafianteId)
          .eq("desafiado_id", desafiadoId)
          .in("status", ["pendente", "aceito"])
          .maybeSingle();
        if (existente) {
          return NextResponse.json(
            { erro: "Já existe um desafio em aberto com esse jogador." },
            { status: 409 }
          );
        }
        const { data, error } = await supabase
          .from("desafios")
          .insert({
            desafiante_id: desafianteId,
            desafiado_id: desafiadoId,
            capitulo: Number(capitulo),
            total_perguntas: 10,
          })
          .select("id")
          .single();
        if (error) throw error;
        return NextResponse.json({ ok: true, desafioId: data.id });
      }

      case "aceitar":
      case "recusar": {
        const { desafioId } = body;
        const status = body.acao === "aceitar" ? "aceito" : "recusado";
        const { error } = await supabase
          .from("desafios")
          .update({ status, atualizado_em: new Date().toISOString() })
          .eq("id", desafioId)
          .eq("status", "pendente");
        if (error) throw error;
        return NextResponse.json({ ok: true, status });
      }

      case "responder": {
        const { desafioId, usuarioId, acertou } = body;
        const { data: d, error: dErr } = await supabase
          .from("desafios")
          .select("*")
          .eq("id", desafioId)
          .single();
        if (dErr || !d) return NextResponse.json({ erro: "Desafio não encontrado." }, { status: 404 });
        if (d.status !== "aceito") {
          return NextResponse.json({ erro: "Desafio não está ativo." }, { status: 400 });
        }

        const souDesafiante = d.desafiante_id === usuarioId;
        const souDesafiado = d.desafiado_id === usuarioId;
        if (!souDesafiante && !souDesafiado) {
          return NextResponse.json({ erro: "Você não participa deste desafio." }, { status: 403 });
        }

        const upd: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
        if (souDesafiante) {
          if (d.prog_desafiante >= d.total_perguntas) {
            return NextResponse.json({ erro: "Você já terminou suas perguntas." }, { status: 400 });
          }
          upd.prog_desafiante = d.prog_desafiante + 1;
          if (acertou) upd.pontos_desafiante = d.pontos_desafiante + 1;
        } else {
          if (d.prog_desafiado >= d.total_perguntas) {
            return NextResponse.json({ erro: "Você já terminou suas perguntas." }, { status: 400 });
          }
          upd.prog_desafiado = d.prog_desafiado + 1;
          if (acertou) upd.pontos_desafiado = d.pontos_desafiado + 1;
        }

        // verifica fim de jogo
        const progDesafiante = (upd.prog_desafiante as number) ?? d.prog_desafiante;
        const progDesafiado = (upd.prog_desafiado as number) ?? d.prog_desafiado;
        const ptsDesafiante = (upd.pontos_desafiante as number) ?? d.pontos_desafiante;
        const ptsDesafiado = (upd.pontos_desafiado as number) ?? d.pontos_desafiado;

        if (progDesafiante >= d.total_perguntas && progDesafiado >= d.total_perguntas) {
          upd.status = "finalizado";
          upd.vencedor_id =
            ptsDesafiante > ptsDesafiado
              ? d.desafiante_id
              : ptsDesafiado > ptsDesafiante
              ? d.desafiado_id
              : null; // empate
        }

        const { error: upErr } = await supabase.from("desafios").update(upd).eq("id", desafioId);
        if (upErr) throw upErr;

        // 📣 Duelo terminou? Avisa o grupo de relatórios no WhatsApp
        if (upd.status === "finalizado") {
          await notificarDueloFinalizado(desafioId);
        }

        return NextResponse.json({ ok: true, finalizado: upd.status === "finalizado" });
      }

      default:
        return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
    }
  } catch (e) {
    console.error("[api/desafios POST]", e);
    return NextResponse.json({ erro: "Erro no desafio." }, { status: 500 });
  }
}

/**
 * GET para um desafio específico é feito via /api/desafios/estado?id=<uuid>
 * (ver rota própria) — usado no polling do placar ao vivo.
 */
