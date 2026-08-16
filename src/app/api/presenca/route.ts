import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const ONLINE_LIMIAR_MS = 75_000; // online = batimento nos últimos 75s

/**
 * POST /api/presenca  { usuarioId }
 * Batimento de presença (o app envia a cada 30s).
 */
export async function POST(req: Request) {
  try {
    const { usuarioId } = await req.json();
    if (!usuarioId) return NextResponse.json({ erro: "usuarioId obrigatório." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    await supabase
      .from("usuarios")
      .update({ ultima_presenca: new Date().toISOString() })
      .eq("id", usuarioId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ erro: "Erro no batimento." }, { status: 500 });
  }
}

/**
 * GET /api/presenca
 * Lista todos os usuários com status online/offline.
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nome, ultima_presenca")
      .order("nome");
    if (error) throw error;

    const agora = Date.now();
    const usuarios = (data ?? []).map((u) => ({
      id: u.id,
      nome: u.nome,
      online: u.ultima_presenca
        ? agora - new Date(u.ultima_presenca).getTime() < ONLINE_LIMIAR_MS
        : false,
      ultima_presenca: u.ultima_presenca,
    }));
    // online primeiro
    usuarios.sort((a, b) => Number(b.online) - Number(a.online) || a.nome.localeCompare(b.nome));
    return NextResponse.json({ usuarios });
  } catch (e) {
    return NextResponse.json({ erro: "Erro ao listar usuários." }, { status: 500 });
  }
}
