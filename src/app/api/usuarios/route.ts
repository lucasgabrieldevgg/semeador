import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const NOMES_ADMIN = ["adalberto", "batalha2026"];

/**
 * POST /api/usuarios
 * Onboarding: cadastra (ou recupera) o usuário pelo nome.
 * Se o nome for "adalberto" ou "batalha2026" => retorna { admin: true }
 * e o front redireciona para /admin-dashboard (backdoor).
 */
export async function POST(req: Request) {
  try {
    const { nome } = await req.json();
    const nomeLimpo = String(nome ?? "").trim();

    if (!nomeLimpo || nomeLimpo.length < 2 || nomeLimpo.length > 40) {
      return NextResponse.json(
        { erro: "Informe um nome válido (2 a 40 caracteres)." },
        { status: 400 }
      );
    }

    // 🔑 BACKDOOR DE ADMIN — não cria usuário, apenas sinaliza redirect
    if (NOMES_ADMIN.includes(nomeLimpo.toLowerCase())) {
      return NextResponse.json({ admin: true });
    }

    const supabase = getSupabaseAdmin();

    // Busca usuário existente (case-insensitive)
    const { data: existente } = await supabase
      .from("usuarios")
      .select("id, nome, criado_em")
      .ilike("nome", nomeLimpo)
      .maybeSingle();

    if (existente) {
      return NextResponse.json({ admin: false, usuario: existente, novo: false });
    }

    const { data: criado, error } = await supabase
      .from("usuarios")
      .insert({ nome: nomeLimpo })
      .select("id, nome, criado_em")
      .single();

    if (error) throw error;

    return NextResponse.json({ admin: false, usuario: criado, novo: true });
  } catch (e: any) {
    console.error("[api/usuarios]", e);
    return NextResponse.json({ erro: "Erro interno ao cadastrar usuário." }, { status: 500 });
  }
}
