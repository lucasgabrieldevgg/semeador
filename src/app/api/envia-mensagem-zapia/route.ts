import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { validarApiKeyZapia } from "@/lib/zapia";

export const dynamic = "force-dynamic";

/**
 * POST /api/envia-mensagem-zapia
 * (Zapia Max ➡️ Site — Custom Action)
 *
 * O Adalberto manda um comando no WhatsApp ("Avise o Lucas que..."),
 * a Zapia chama este endpoint e a mensagem é gravada em mensagens_admin,
 * aparecendo como aviso/tutor dentro do app do aluno.
 *
 * Headers: x-api-key: <ZAPIA_API_KEY>
 * Body: { "nome": "Lucas", "mensagem": "Parabéns pelo Cap 4! Revise o Cap 3." }
 *        (nome omitido ou "todos" => broadcast para todos os alunos)
 */
export async function POST(req: Request) {
  if (!validarApiKeyZapia(req)) {
    return NextResponse.json({ erro: "API key inválida ou ausente." }, { status: 401 });
  }

  try {
    const { nome, mensagem } = await req.json();
    const texto = String(mensagem ?? "").trim();

    if (!texto) {
      return NextResponse.json({ erro: "Campo 'mensagem' é obrigatório." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let usuarioId: string | null = null;
    let destino = "todos os alunos (broadcast)";

    if (nome && String(nome).trim().toLowerCase() !== "todos") {
      const { data: usuario } = await supabase
        .from("usuarios")
        .select("id, nome")
        .ilike("nome", String(nome).trim())
        .maybeSingle();

      if (!usuario) {
        return NextResponse.json(
          { ok: false, erro: `Aluno "${nome}" não encontrado.` },
          { status: 404 }
        );
      }
      usuarioId = usuario.id;
      destino = usuario.nome;
    }

    const { data, error } = await supabase
      .from("mensagens_admin")
      .insert({ usuario_id: usuarioId, mensagem: texto })
      .select("id, criado_em")
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      mensagem_id: data.id,
      entregue_para: destino,
      confirmacao: `Mensagem registrada e será exibida no app para ${destino}.`,
    });
  } catch (e: any) {
    console.error("[api/envia-mensagem-zapia]", e);
    return NextResponse.json({ erro: "Erro interno ao gravar mensagem." }, { status: 500 });
  }
}
