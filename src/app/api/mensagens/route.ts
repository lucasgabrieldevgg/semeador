import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * GET /api/mensagens?usuarioId=<uuid>
 * Lista mensagens do admin para o aluno (diretas + broadcast não lidas).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const usuarioId = searchParams.get("usuarioId");
  if (!usuarioId) {
    return NextResponse.json({ erro: "usuarioId obrigatório." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("mensagens_admin")
      .select("id, mensagem, lida, criado_em, usuario_id")
      .or(`usuario_id.eq.${usuarioId},usuario_id.is.null`)
      .order("criado_em", { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json({ mensagens: data ?? [] });
  } catch (e: any) {
    console.error("[api/mensagens GET]", e);
    return NextResponse.json({ erro: "Erro ao buscar mensagens." }, { status: 500 });
  }
}

/**
 * PATCH /api/mensagens
 * Marca mensagem como lida. Body: { mensagemId }
 */
export async function PATCH(req: Request) {
  try {
    const { mensagemId } = await req.json();
    if (!mensagemId) {
      return NextResponse.json({ erro: "mensagemId obrigatório." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("mensagens_admin")
      .update({ lida: true })
      .eq("id", mensagemId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[api/mensagens PATCH]", e);
    return NextResponse.json({ erro: "Erro ao atualizar mensagem." }, { status: 500 });
  }
}
