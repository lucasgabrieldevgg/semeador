import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/mensagem
 * Painel do Admin (no app): Adalberto envia mensagem direta para um aluno
 * (ou broadcast). Grava em mensagens_admin.
 *
 * Body: { usuarioId?: uuid | null, mensagem: string }
 *   usuarioId null/ausente => broadcast para todos.
 */
export async function POST(req: Request) {
  try {
    const { usuarioId, mensagem } = await req.json();
    const texto = String(mensagem ?? "").trim();

    if (!texto) {
      return NextResponse.json({ erro: "Mensagem vazia." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("mensagens_admin")
      .insert({ usuario_id: usuarioId ?? null, mensagem: texto })
      .select("id, criado_em")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, mensagem_id: data.id });
  } catch (e: any) {
    console.error("[api/admin/mensagem]", e);
    return NextResponse.json({ erro: "Erro ao enviar mensagem." }, { status: 500 });
  }
}
