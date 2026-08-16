import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * GET /api/chat?u1=<uuid>&u2=<uuid>
 * Conversa entre dois usuários (últimas 100 mensagens, ordem cronológica).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const u1 = searchParams.get("u1");
  const u2 = searchParams.get("u2");
  if (!u1 || !u2) return NextResponse.json({ erro: "u1 e u2 obrigatórios." }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("mensagens_chat")
      .select("id, de_usuario, para_usuario, mensagem, criado_em")
      .or(
        `and(de_usuario.eq.${u1},para_usuario.eq.${u2}),and(de_usuario.eq.${u2},para_usuario.eq.${u1})`
      )
      .order("criado_em", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ mensagens: (data ?? []).reverse() });
  } catch (e) {
    return NextResponse.json({ erro: "Erro ao buscar conversa." }, { status: 500 });
  }
}

/**
 * POST /api/chat  { de, para, mensagem }
 */
export async function POST(req: Request) {
  try {
    const { de, para, mensagem } = await req.json();
    const texto = String(mensagem ?? "").trim();
    if (!de || !para || !texto || texto.length > 500) {
      return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("mensagens_chat")
      .insert({ de_usuario: de, para_usuario: para, mensagem: texto })
      .select("id, criado_em")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    return NextResponse.json({ erro: "Erro ao enviar mensagem." }, { status: 500 });
  }
}
