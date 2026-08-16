import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * GET /api/desafios/estado?id=<uuid>
 * Estado de um desafio (polling do placar ao vivo durante o duelo).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "id obrigatório." }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("desafios")
      .select(
        "id, desafiante_id, desafiado_id, capitulo, status, total_perguntas, pontos_desafiante, pontos_desafiado, prog_desafiante, prog_desafiado, vencedor_id, desafiante:usuarios!desafios_desafiante_id_fkey(nome), desafiado:usuarios!desafios_desafiado_id_fkey(nome)"
      )
      .eq("id", id)
      .single();
    if (error || !data) return NextResponse.json({ erro: "Desafio não encontrado." }, { status: 404 });

    return NextResponse.json({
      ...data,
      desafiante_nome: (data as any).desafiante?.nome ?? "?",
      desafiado_nome: (data as any).desafiado?.nome ?? "?",
    });
  } catch (e) {
    return NextResponse.json({ erro: "Erro ao buscar desafio." }, { status: 500 });
  }
}
